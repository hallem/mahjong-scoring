# TODO — 4-player scoring page

Open items for the shared multiplayer scorer (`shared-lobby.html` /
`shared-game.html` / `shared-results.html`, backed by
`mahjong-scoring-engine.js`).

## Split mini points into concealed vs. exposed

- [ ] In `HAND_SECTIONS` (`mahjong-scoring-engine.js`), the `mini` section
      currently interleaves exposed and concealed variants as separate rows
      (e.g. "Pung of Simples" / "Pung of Simples (c)"). Split it into two
      sections/sub-groups — Exposed and Concealed — so they render as
      distinct collapsible groups instead of one long flat list.
- [ ] Decide: two separate top-level `HAND_SECTIONS` entries, or one section
      with a sub-grouping field the renderer understands? Two entries is the
      smaller change; a sub-grouping field is more general if other
      sections need the same treatment later.
- [ ] Update `buildSeatScorer()` (`shared-game.html`) to render the new
      grouping — no change needed to `getSeatHandValues`/`computePointTotal`
      since they iterate `HAND_SECTIONS` generically by section/item index.
- [ ] Double check `hand_submissions.selections` shape (`{checks, qtys}`
      keyed by `"<sectionIndex>-<itemIndex>"`) still round-trips correctly
      once section indices shift — old in-flight games with saved
      selections keyed to the old indices would misread after this change,
      so this is a breaking change for any game in progress at deploy time.

## Collapse hand selection into one area with player selection

- [ ] Clarify scope before starting: does "player selection" mean a
      seat-picker added to a page that currently shows all 4 players at
      once (the original single-device
      `chinese_classical_scoring_worksheet_dynamic.html`), letting you
      collapse 4 side-by-side hand-entry panels into one shared panel plus
      a seat switcher? Or something on the shared multiplayer pages, where
      each device already only ever shows its own single seat?
- [ ] Once scoped: replace the per-seat repeated hand-selection markup with
      a single hand-selection UI instance, driven by whichever seat is
      currently selected (dropdown/tabs), reusing `buildSeatScorer`'s
      section-rendering logic rather than duplicating it per seat.
- [ ] Make sure switching the selected player doesn't lose unsaved
      selections for the seat being switched away from.

## Persist in-progress hands to localStorage

- [ ] On `shared-game.html`, cache the local seat's in-progress (not yet
      submitted) `{checks, qtys}` selections to `localStorage` on every
      change (piggyback on `serializeSeatSelections()` / the existing
      `adjQty`/checkbox `onchange` handlers), keyed by room code + hand id
      + seat so stale data from a previous hand doesn't leak in.
- [ ] On page load, if a cached in-progress selection exists for the
      current room/hand/seat, restore it into the DOM before rendering
      (protects against a lost connection or accidental refresh mid-hand,
      per the original design doc's "connectivity loss mid-hand" risk).
- [ ] Clear the cached entry once `submitHand()` succeeds, and whenever
      `resetHandUI()`/`clearMyHand()` runs, so it doesn't resurface on a
      later hand.
- [ ] Decide whether this should also make already-submitted hands locally
      editable (re-open and resubmit before the hand completes) — current
      RLS already allows a reupsert while `hands.status = 'collecting'`,
      but there's no UI today to go back and edit after tapping Submit.
