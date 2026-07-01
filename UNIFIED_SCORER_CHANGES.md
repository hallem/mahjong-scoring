# Unified Scorer — What Changed and Why

`chinese_classical_scoring_worksheet_unified.html` is a new file, copied from
`chinese_classical_scoring_worksheet_dynamic.html` (which is untouched).
This document explains exactly what was changed, why, and the judgment
calls made where the original request left room for interpretation — so
corrections are easy without having to re-diff the whole file.

## 1. Mini Points split into Concealed / Exposed

The old single `Mini Points` section interleaved exposed and concealed
variants as separate rows (`Pung of Simples` / `Pung of Simples (c)`). It's
now two sections:

- **`Mini Points — Exposed`** (`HAND_SECTIONS[2]`, `id: 'mini-exposed'`) —
  the un-suffixed values from the old list, plus the three items that have
  no concealed/exposed distinction at all (Pair of Seat/Round Winds, Pair
  of Dragons, Each Seat Flower or Season). **Judgment call:** these three
  pair/bonus items don't have a "(c)" counterpart in the original data, so
  there was no natural home for them in a Concealed section — they're kept
  in Exposed as the default/general category. If you'd rather they sit in
  their own un-suffixed row visible regardless of section, flag it and
  they can be pulled into a third small section.
- **`Mini Points — Concealed`** (`HAND_SECTIONS[3]`, `id: 'mini-concealed'`)
  — the old `(c)`-suffixed items, with the suffix dropped from the label
  (the section heading now conveys "concealed," so the inline marker is
  redundant). Point values and max quantities are copied over unchanged.

**Judgment call:** Exposed is listed before Concealed. No preference was
stated either way; swap the two objects in the `HAND_SECTIONS` array if you
want Concealed first.

### New section index layout

| Index | `id` | `label` | `winnerOnly` |
|---|---|---|---|
| 0 | `limit` | Limit Hands | true |
| 1 | `doubles` | Doubles | false |
| 2 | `mini-exposed` | Mini Points — Exposed | false |
| 3 | `mini-concealed` | Mini Points — Concealed | false |
| 4 | `mini-winner` | Mini Points — Winner Only | true |

This shifted `mini-winner` from index 3 (in the original file) to index 4.
Every place that used to hardcode a numeric section index for it (`Base
Win` at item 0, `Self-Drawn Win` at item 5) has been changed to derive the
index from the section's `id` instead of a hardcoded number, specifically
so this kind of reshuffle can't silently break them again:

```js
const LIMIT_SECTION_INDEX = HAND_SECTIONS.findIndex(s => s.id === 'limit');
const DOUBLES_SECTION_INDEX = HAND_SECTIONS.findIndex(s => s.id === 'doubles');
const WINNER_SECTION_INDEX = HAND_SECTIONS.findIndex(s => s.id === 'mini-winner');
const BASE_WIN_ITEM_INDEX = 0;   // 'Base Win' position within mini-winner.items
const SELF_DRAWN_ITEM_INDEX = 5; // 'Self-Drawn Win' position within mini-winner.items
```

`getSeatHandValues`'s limit-hand lookup and the "limit hides doubles"
section-clearing logic in `calculateScores` both switched from the
hardcoded `HAND_SECTIONS[0]` / `HAND_SECTIONS[1]` to
`HAND_SECTIONS[LIMIT_SECTION_INDEX]` / `HAND_SECTIONS[DOUBLES_SECTION_INDEX]`
for the same reason, even though those two indices happen to be unchanged
this time — they're just as fragile against a future reorder.

## 2. Unified hand-selection UI with a player switcher

**Before:** each of the 4 seat cards had its own independent, always-in-DOM
hand-selection accordion (`buildSeatScorer` rendered one full copy per
seat). All 4 could be expanded/collapsed independently and simultaneously.

**After:** each seat now has a compact header card — Mini Points, Doubles,
and Point Total (with the East x2 / Limit badges) — that's always visible
for all 4 players at once. Below the 4 header cards sits **one** shared
hand-selection panel. Tapping any header card makes that seat "active":
the card gets a blue ring (`.seat-scorer.active-edit`), the panel's title
updates ("Hand Selection — SOUTH"), and the panel repopulates with that
seat's previously-entered selections. Tapping a different card at any time
switches back with all prior selections intact — nothing is lost by
switching away.

### Why this required a data-model change

The old file had no JS-level state at all — the checkboxes/steppers *were*
the state, since all 4 seats' DOM existed permanently. Once only the
active seat's picker DOM exists at a time, something has to hold the other
3 seats' selections while their DOM is gone. So this introduces:

```js
let handState = {}; // { EAST: {checks:{}, qtys:{}}, SOUTH: {...}, ... }
```

`checks`/`qtys` are keyed by `"<sectionIndex>-<itemIndex>"`, exactly the
same shape used by the multiplayer engine's `hand_submissions.selections`
column (see §4) — not a coincidence, this is the one piece of the
multiplayer architecture that got reused here, because item 2's
requirements (persist a seat's data while its DOM doesn't exist) are
functionally the same problem the multiplayer version solved (persist a
seat's data while it's on a different device entirely).

### Key functions

- `setCheck(seat, si, ii, checked)` / `setQty(seat, si, ii, qty)` — the only
  two places that mutate `handState`.
- `clearHandItem(seat, si, ii)` — dispatches to `setCheck`/`setQty` based on
  the item's `ui` type; used when zeroing out winner-only fields for
  non-winners and when a limit hand clears a seat's doubles.
- `getSeatHandValues(seat, winner)` — same shape/purpose as before, but now
  reads from `handState[seat]` instead of the DOM.
- `buildSeatHeaderCard(seat)` — the always-visible summary card (replaces
  the header portion of the old `buildSeatScorer`).
- `buildHandPanel(seat)` — renders the picker markup for one seat, seeding
  each checkbox/stepper's initial state from `handState[seat]` (this is
  what makes "switch back and see your prior entries" work).
- `switchActiveSeat(seat)` — sets `activeSeat`, moves the `.active-edit`
  ring, updates the panel title, and calls `renderActiveHandPanel()`.
- `renderActiveHandPanel()` — rebuilds `#hand-panel`'s innerHTML from
  `buildHandPanel(activeSeat)`, toggles `.is-winner` on the panel (driving
  the `.winner-only-section` visibility, moved from
  `.seat-scorer.is-winner` since winner-only content now lives in the
  shared panel, not inside each seat's card), and re-applies the
  limit-hides-doubles visual state.
- `onHandCheckboxChange(dataId, checked)` / `adjQty(dataId, delta, max)` /
  `onExclusiveCheck(seat, si, ii, radioGroup)` — same responsibilities as
  before, but each now also writes into `handState` (previously they only
  touched the DOM and re-ran `calculateScores()`).

### DOM structure

```
#scores-container            <- 4 always-visible header cards
  .seat-scorer#scorer-EAST   (onclick="switchActiveSeat('EAST')")
  .seat-scorer#scorer-SOUTH
  .seat-scorer#scorer-WEST
  .seat-scorer#scorer-NORTH

.tap-hint                    <- "Tap a player above to enter or edit their hand"

.hand-panel-wrapper
  .hand-panel-title          <- "Hand Selection — <span id="hand-panel-seat-label">"
  #hand-panel                <- rebuilt on every switchActiveSeat() call
```

Checkbox/stepper element IDs still use the same `chk-${seat}-${si}-${ii}` /
`qty-${seat}-${si}-${ii}` convention as before — the only difference is
that only `activeSeat`'s versions of these IDs exist in the DOM at any
given moment.

### Judgment calls

- **Switching UI:** the request suggested "a segmented control or tab bar"
  as one option. Tapping the existing header card was used instead of
  adding a separate tab row, since the header cards already show each
  seat's name/total and are the natural target to say "I want to edit this
  one" — adding a second, redundant seat selector felt like clutter. If a
  dedicated tab bar is preferred instead of (or in addition to) tapping the
  cards, that's a small, isolated change to add.
- **Winner-only section visibility**, previously driven by
  `.seat-scorer.is-winner`, is now driven by `.hand-panel.is-winner` — the
  seat-scorer header cards no longer have any `is-winner`-specific styling
  since the winner-only picker content isn't inside them anymore. The
  `🏆 WINNER` tag on the header card (unrelated to this class) still works
  exactly as before via `updateSeatTags()`.

## 3. Preserved functionality

Everything else was carried over with no behavior change: winner/discarded-by
selection and their auto-derived Base Win / Self-Drawn Win checkboxes, all
three scoring rules (East doubling, discarder pays double, discarder pays
all), limit-hand mutual exclusivity, the East-doubling display cap
(500 normally, 1000 when East wins with doubling enabled), the "real value"
subline shown when a hand is capped, comma-formatted large numbers, and the
full payout/net-result matrix math — all copied verbatim from
`calculateScores()`/`computePointTotal()` in the original file, just now
reading from `handState` instead of the DOM.

## 4. Diff against the multiplayer engine — what was (and wasn't) ported

Compared `computePointTotal`, `calculateScores`'s payout-matrix logic, and
the East-doubling display logic in the original dynamic file against
`mahjong-scoring-engine.js`'s `computePointTotal`, `computeSeatDisplay`,
`computeAllBaseScores`, and `computePayoutMatrix` (plus their usage in
`shared-game.html`/`shared-results.html`).

**Finding: the scoring math is already identical between the two files.**
`mahjong-scoring-engine.js` was extracted from the dynamic file's logic
essentially verbatim during the multiplayer build-out — not rewritten or
corrected. Specifically checked and confirmed identical in both:

- `computePointTotal`'s cap: flat `500` in both, never East/1000-aware at
  this layer in either file.
- The East-doubling *display* cap (1000 for East when winning with
  doubling enabled) and the "real value" subline: present in the original
  dynamic file's `calculateScores()` (the block starting `// Item 3: east
  doubling on displayed total`) and in the engine's `computeSeatDisplay` —
  same formula, same variable names even.
- `realValue.toLocaleString('en-US')` comma formatting: already in the
  original dynamic file, not something added later only for multiplayer.
- The payout matrix: `baseScores` is intentionally the *undoubled* flat-500
  total in both files, with East-doubling applied independently at each
  payout calculation (self-draw, discarder-pays-double, discarder-pays-all,
  and the standard/default branch, plus the non-winner-vs-non-winner diff
  branch) — this pattern is byte-for-byte the same in both files.

So **there was nothing to port at the scoring-math level** — no bug fix,
cap correction, or edge-case handling exists in the multiplayer engine that
was missing here. The multiplayer-specific work that came after the initial
copy (RLS policies, room/hand lifecycle, the cumulative running-total
matrix across multiple hands, the hand-by-hand breakdown view, the
"set up next hand" card) is all backend/session-lifecycle logic tied to
Supabase and multi-device sync, explicitly out of scope for this
single-device file per the original request, and none of it touches the
actual point/payout math.

**What *was* carried over in spirit** is the architectural pattern, not a
fix: `handState`'s `{checks, qtys}` shape and the "pure function reads a
selections object, not the DOM" style of `getSeatHandValues`/
`computePointTotal` mirror `mahjong-scoring-engine.js`'s functions of the
same names. That reuse was necessary for item 2 (the unified panel) to
work at all, not something pulled in solely because item 4 asked for it —
but it does mean this file and the multiplayer engine are now closer in
shape than before, which should make it easier to backport future scoring
changes between them if that's ever useful.

## Verification performed

Using the Claude Preview MCP tooling against a local static server
(no backend involved — this file has none):

- Confirmed 5 hand sections render in the right order with the concealed
  suffix dropped and values unchanged.
- Entered a hand for East (Kong of Simples, exposed, 8 pts) → total showed
  8 correctly.
- Switched to South, entered a different hand (Kong of Simples, concealed,
  16 pts), switched back to East — East's header total and panel checkbox
  state were both still intact (8 pts), confirming no data loss on switch.
- Set South as winner → Base Win auto-checked for South once its panel
  was opened, winner-only section became visible via `.is-winner`, 🏆 tag
  appeared on South's header card.
- Checked a limit hand (Thirteen Orphans) for South → Doubles section
  correctly hid itself, doubles data cleared, total computed as
  300 (limit) + 16 (concealed mini) + 20 (Base Win) + 2 (Self-Drawn,
  auto-checked since discarded-by defaulted to self-draw) = 338, matching
  hand-verified arithmetic.
- Payout matrix cross-checked by hand for this scenario: East pays South
  676 (338 × 2, East-doubling applies since East is a party to the
  transfer), West and North each pay South 338 (undoubled, neither is
  East), East nets −644, South nets +1352 — all matched the on-screen
  matrix exactly.
- "Clear Scores" verified to reset winner to Wall, zero every seat's
  totals and matrix cells, clear `handState` for all 4 seats, and return
  the active/highlighted seat to East.

Not yet verified (needs manual check before relying on it further):
narrow-viewport/mobile layout of the new header-cards + shared-panel
stack (only checked at a ~800px-wide screenshot), and the "Doubles"
mutual-exclusion checkboxes within the Doubles section itself (Half
Flush / Pure Flush / All Honors) — logic is unchanged from the original
file and uses the same `onExclusiveCheck` path already exercised for the
Limit Hands radio group, so it's expected to work, but wasn't separately
spot-checked with its own test case.

## What to check before committing

1. Open `chinese_classical_scoring_worksheet_unified.html` on an actual
   phone-sized viewport and confirm the header cards + tap-to-select +
   panel flow feels right — this was only verified programmatically and
   with one screenshot at ~800px wide.
2. Decide on the two judgment calls above (pair/bonus item placement in
   Exposed vs. a third bucket; Exposed-before-Concealed ordering) if either
   isn't what you had in mind.
3. Decide whether the "tap a header card to select it" interaction is
   sufficient, or whether an explicit tab/segmented control should be
   added alongside or instead of it.
4. Play through a full multi-hand session by hand once to sanity check the
   feel, since only individual scoring scenarios were checked
   programmatically, not a full realistic session end-to-end.
