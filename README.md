# Casa del Jefe — Let It Ride Lounge v7

A self-contained browser trainer for the standard Let It Ride paytable:
1000 / 200 / 50 / 11 / 8 / 5 / 3 / 2 / 1 for royal flush through pair of tens or better.

## Modes

- **Play**: three-unit bankroll simulation, full-hand accuracy, incorrect-decision review, and actual-vs-optimal bankroll chart. A hand is accurate only when both decisions are optimal.
- **Train**: practices complete hands. Each choice receives only `Correct!` or `Incorrect!`; the score is recorded after the full hand.
- **Look Up**: accepts three player cards, plus an optional revealed community card, and reports the decision with a plain-English explanation. The reference guide includes visual examples for every Ride, Either, and Pull category.
- **El Jefe Challenge**: 200 complete hands without immediate feedback. A score of 196/200 (98%) passes; 200/200 earns the Let It Ride Grand Master certificate.

Indifferent second-decision states accept Pull or Let It Ride as correct.

## Table layout

The three betting spots are marked `$`, `2`, and `1`. The chips themselves are intentionally unlabeled. The decision controls begin below the middle chip and move below the right chip after the first community card is revealed.

## Verification

- All 1,755 canonical three-card states: zero mismatches.
- All 16,432 canonical four-card states: zero mismatches.
- Exact optimal expected loss: `37963 / 1082900` base units per hand.
- Conventional house edge: approximately `3.505679%`.

## Files

Open `index.html` directly, or serve this directory from any static web host. The service worker is active only when served over HTTP/HTTPS.

## Keyboard shortcuts

During Play, Train, or Challenge:

- `P`: Pull Back
- `R`: Let It Ride

## v7 update

- Added a subtle single-player cream wedge and curved dealer-area stripe inspired by a physical Let It Ride table.
- Community-card positions now use yellow casino-style frames.
- The `$`, `2`, and `1` betting positions follow a slight diagonal while decision controls remain centered on the active chip.
