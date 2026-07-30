# Casa del Jefe — Let It Ride Lounge v13

A self-contained browser trainer for the standard Let It Ride paytable:
1000 / 200 / 50 / 11 / 8 / 5 / 3 / 2 / 1 for royal flush through pair of tens or better.

## Modes

- **Play**: three-unit bankroll simulation, full-hand accuracy, incorrect-decision review, and actual-vs-optimal bankroll chart.
- **Train**: complete-hand practice with concise Correct/Incorrect feedback.
- **Look Up**: three-card and four-card strategy lookup with plain-English explanations.
- **El Jefe Challenge**: 200 complete hands; 196/200 passes and 200/200 earns Grand Master.

Indifferent second-decision states accept either action as correct.

## v13 update

- Centered the three-chip group beneath the player cards.
- The middle `2` spot is directly below the middle player card, with `$` and `1` equally spaced on either side.
- Kept the tighter horizontal action-button layout.
- Added a very brief 120 ms transition lock after Decision 1 so a fast double-click cannot accidentally submit Decision 2.

## Verification

- All 1,755 canonical three-card states: zero mismatches.
- All 16,432 canonical four-card states: zero mismatches.
- Conventional house edge: approximately 3.505679%.

Open `index.html` directly, or serve this directory from any static web host.
