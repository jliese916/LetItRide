# Casa del Jefe — Let It Ride Lounge v19

A self-contained browser trainer for the standard Let It Ride paytable:
1000 / 200 / 50 / 11 / 8 / 5 / 3 / 2 / 1 for royal flush through pair of tens or better.

## Modes

- **Play**: three-unit bankroll simulation, full-hand accuracy, incorrect-decision review, and actual-vs-optimal bankroll chart.
- **Train**: complete-hand practice with concise Correct/Incorrect feedback.
- **Look Up**: three-card and four-card strategy lookup with plain-English explanations.
- **El Jefe Challenge**: 200 complete hands; 196/200 passes and 200/200 earns Grand Master.

Indifferent second-decision states accept either action as correct.

## v15 update

- Centered the three-chip group beneath the player cards.
- The middle `2` spot is directly below the middle player card, with `$` and `1` equally spaced on either side.
- Kept the tighter horizontal action-button layout.
- Added a very brief 120 ms transition lock after Decision 1 so a fast double-click cannot accidentally submit Decision 2.


## v16 update

- Reworked the Train table so the cream arc passes between the community and player cards.
- Lowered the player cards slightly to match the Play table geometry.
- Compressed the betting and feedback area so the New Hand button sits closer to the action.

## Verification

- All 1,755 canonical three-card states: zero mismatches.
- All 16,432 canonical four-card states: zero mismatches.
- Conventional house edge: approximately 3.505679%.

Open `index.html` directly, or serve this directory from any static web host.


### v14 layout fix
The middle betting chip is aligned at runtime to the center of the middle player card, making the layout consistent across browsers, zoom levels, and responsive widths. Static assets use versioned URLs to prevent stale hosted CSS or JavaScript.


### v15 button hit-area fix
The active Pull Back and Let It Ride controls are raised above neighboring chip columns, so every visible point inside either button responds to clicks and taps.


## v17 update

- Tightened the three-chip rail at mobile widths while preserving exact center alignment beneath the middle player card.
- Reduced the mobile action-button gap and width so the full Pull Back and Let It Ride controls remain inside the viewport, including on 320 px screens.

## v18 update

- Brought all three betting chips slightly closer to center.
- Preserved exact alignment of the middle `2` chip beneath the middle player card.
- Tightened mobile spacing further so the full decision controls remain on-screen.

## v19 update

- Widened the Pull Back and Let It Ride buttons after tightening the chip rail.
- Preserved narrower responsive widths for small and very small phones.
- Kept the middle chip anchored beneath the middle player card.
