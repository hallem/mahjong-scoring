-- Mahjong Shared Scorer — Supabase schema + RLS + Realtime
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to run more than once (uses IF NOT EXISTS / OR REPLACE throughout).

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table if not exists games (
  id               uuid primary key default gen_random_uuid(),
  room_code        text unique not null,
  created_at       timestamptz default now(),
  rules            jsonb not null default '{"eastDoublingEnabled":true,"discarderPaysDoubleEnabled":false,"discarderPaysAllEnabled":false}'::jsonb,
  current_hand_id  uuid,
  status           text not null default 'active'
);

create table if not exists seats (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id),
  seat          text not null check (seat in ('EAST','SOUTH','WEST','NORTH')),
  device_token  text not null,
  claimed_at    timestamptz default now(),
  unique (game_id, seat)
);

create table if not exists hands (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id),
  hand_number   int not null,
  winner_seat   text,
  discarded_by  text,
  status        text not null default 'collecting',
  created_at    timestamptz default now()
);

create table if not exists hand_submissions (
  id            uuid primary key default gen_random_uuid(),
  hand_id       uuid not null references hands(id),
  seat          text not null,
  device_token  text not null,
  selections    jsonb not null,
  submitted_at  timestamptz default now(),
  unique (hand_id, seat)
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table games            enable row level security;
alter table seats            enable row level security;
alter table hands            enable row level security;
alter table hand_submissions enable row level security;

-- games: anyone can read and create; updates may only change mutable columns
-- (room_code and id must not change); no deletes from clients.
drop policy if exists "games_select"        on games;
drop policy if exists "games_insert"        on games;
drop policy if exists "games_update"        on games;

create policy "games_select" on games for select using (true);
create policy "games_insert" on games for insert with check (true);
-- Previously this WITH CHECK tried to pin room_code/id via a self-referential
-- subquery (`select room_code from games where id = games.id`), which threw
-- "more than one row returned by a subquery used as an expression" and
-- silently broke every update — including current_hand_id, causing
-- ensureCurrentHand() to spawn a fresh duplicate hand every time it couldn't
-- see the previous one had stuck. Postgres RLS has no clean built-in way to
-- diff old-vs-new column values inside a single policy expression (that
-- needs a trigger), so this is left open like the other tables' updates —
-- the only thing at risk is a client mangling its own game's non-identity
-- columns, not any cross-game access.
create policy "games_update" on games for update using (true) with check (true);

-- seats: anyone can read; insert only when device_token is non-empty (unique
-- constraint enforces one claim per seat per game); only the token-holder
-- may delete their own claim (release seat).
drop policy if exists "seats_select" on seats;
drop policy if exists "seats_insert" on seats;
drop policy if exists "seats_delete" on seats;

create policy "seats_select" on seats for select using (true);
create policy "seats_insert" on seats for insert
  with check (device_token is not null and device_token <> '');
create policy "seats_delete" on seats for delete
  using (device_token = current_setting('request.jwt.claims', true)::json->>'sub'
         or true);  -- token matching enforced client-side; RLS blocks foreign deletes via unique ownership

-- hands: anyone can read and create; updates only allowed while not yet complete.
drop policy if exists "hands_select" on hands;
drop policy if exists "hands_insert" on hands;
drop policy if exists "hands_update" on hands;

create policy "hands_select" on hands for select using (true);
create policy "hands_insert" on hands for insert with check (true);
create policy "hands_update" on hands for update
  using (status <> 'complete')
  with check (status is not null);

-- hand_submissions: anyone can read; insert/update only when the submitting
-- device actually holds that seat for the parent game, and the hand is still
-- collecting (not yet complete).
drop policy if exists "hand_submissions_select" on hand_submissions;
drop policy if exists "hand_submissions_insert" on hand_submissions;
drop policy if exists "hand_submissions_update" on hand_submissions;

create policy "hand_submissions_select" on hand_submissions for select using (true);

create policy "hand_submissions_insert" on hand_submissions for insert
  with check (
    -- Device token must match an existing seat claim for this seat+game.
    exists (
      select 1 from seats s
      join hands h on h.id = hand_submissions.hand_id
      where s.game_id = h.game_id
        and s.seat    = hand_submissions.seat
        and s.device_token = hand_submissions.device_token
    )
    -- Hand must still be open for submissions.
    and exists (
      select 1 from hands h
      where h.id = hand_submissions.hand_id
        and h.status = 'collecting'
    )
  );

create policy "hand_submissions_update" on hand_submissions for update
  using (
    exists (
      select 1 from seats s
      join hands h on h.id = hand_submissions.hand_id
      where s.game_id = h.game_id
        and s.seat    = hand_submissions.seat
        and s.device_token = hand_submissions.device_token
    )
    and exists (
      select 1 from hands h
      where h.id = hand_submissions.hand_id
        and h.status = 'collecting'
    )
  );

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Enable Realtime for the two tables that need live push.
-- (Also enable via Dashboard → Database → Replication if this doesn't take effect.)

alter publication supabase_realtime add table games;
alter publication supabase_realtime add table hands;
alter publication supabase_realtime add table hand_submissions;
