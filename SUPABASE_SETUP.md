# Supabase Setup — Shared Scoring Backend

These steps set up the Supabase project that the shared (multi-device) scorer
will use. See `/Users/michael/.claude/plans/cheerful-scribbling-noodle.md`
for the full design this supports.

## 1. Create an account and project

1. Sign up at [supabase.com](https://supabase.com) (free tier is enough).
2. Create a new project — any name (e.g. `mahjong-scorer`), pick a region
   close to you, and set a database password (save it somewhere safe; you
   won't need it day-to-day since we don't touch raw SQL connections
   directly outside the dashboard).

## 2. Grab your API credentials

In **Project Settings → API**, copy:

- **Project URL**
- **anon public key**

These are safe to embed directly in the static HTML/JS. The anon key is
designed for client-side exposure — it identifies the project, not a secret
permission level. The real protection comes from the Row Level Security
(RLS) policies in step 4. (Never expose the separate **service_role** key —
that one bypasses RLS entirely and must stay server-side only. We don't use
it anywhere in this design.)

## 3. Create the tables

Run this in the **SQL Editor**:

```sql
create table games (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  created_at timestamptz default now(),
  rules jsonb not null default '{}'::jsonb,
  current_hand_id uuid,
  status text not null default 'active'
);

create table seats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id),
  seat text not null check (seat in ('EAST','SOUTH','WEST','NORTH')),
  device_token text not null,
  claimed_at timestamptz default now(),
  unique (game_id, seat)
);

create table hands (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id),
  hand_number int not null,
  winner_seat text,
  discarded_by text,
  status text not null default 'collecting',
  created_at timestamptz default now()
);

create table hand_submissions (
  id uuid primary key default gen_random_uuid(),
  hand_id uuid not null references hands(id),
  seat text not null,
  device_token text not null,
  selections jsonb not null,
  submitted_at timestamptz default now(),
  unique (hand_id, seat)
);
```

## 4. Enable RLS and add tightened policies

Enable RLS on all four tables (**Authentication → Policies**, or via SQL:
`alter table <name> enable row level security;`), then add policies. Since
there's no real user auth, the `room_code` itself is the access boundary —
treat it like an unguessable capability token. Don't use blanket
`USING (true)` policies; scope each one as tightly as the operation allows:

**`games`**
- `select`: open (`USING (true)`) — needed to resolve a room code to a game.
- `insert`: open — anyone can create a game.
- `update`: only allow changing `rules`, `current_hand_id`, `status` — assert
  `room_code` and `id` are unchanged via a `WITH CHECK` comparing to `OLD`,
  so a client can't hijack a different game's identity fields.
- `delete`: **no policy** — games are closed via `status='closed'`, never
  deleted by a client.

**`seats`**
- `select`: open.
- `insert`: only when no row already exists for `(game_id, seat)` (enforced
  by the unique constraint) and `device_token` is non-null.
- `delete`: only when the request's `device_token` matches the row being
  deleted (the "release seat" action) — never let a client delete someone
  else's claim.
- `update`: no policy needed (claims are insert-once / delete-to-release).

**`hands`**
- `select`: open.
- `insert`: open — any claimed seat can start the next hand.
- `update` (`winner_seat`, `discarded_by`, `status`): only while
  `status != 'complete'` — a finished hand's result becomes immutable from
  the client's perspective.
- `delete`: no policy.

**`hand_submissions`**
- `select`: open.
- `insert` / `update`: only when the row's `device_token` matches an
  existing `seats` row for that exact `(game_id, seat)`, **and** the parent
  `hands.status = 'collecting'` — a client can only write its own seat's
  data, and only before the hand is finalized.
- `delete`: no policy.

This is all just Postgres policy configuration on the project you already
created — it adds no extra cost no matter how tight you make it.

## 5. Enable Realtime

In **Database → Replication**, turn on Realtime for the `games` and
`hand_submissions` tables so live-sync subscriptions work.

## 6. Hand off credentials

Once you have the **Project URL** and **anon key**, share them (paste in
chat, or drop into a local untracked file like `supabase-config.local.js`
in the repo) so they can be wired into the shared scorer instead of left as
placeholders.
