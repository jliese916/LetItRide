# Casa del Jefe — Let It Ride Lounge v30

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


## v20 update

- Replaced the moving, per-chip action buttons with a fixed centered Blackjack-style button pair.
- Added a moving upward arrow and “Choose decision 1/2” cue beneath the active removable chip.
- Added red `P` and green `R` action symbols matching the strategy-guide language.
- Kept the full button surfaces clickable and preserved the brief 120 ms transition lock.


## v21 update

- Corrected the physical wager order: Decision 1 now points to and removes the right-hand `1` chip.
- Decision 2 then moves to and removes the middle `2` chip.
- The left `$` chip remains mandatory throughout the hand.
- Applied the corrected order consistently in Play, Train, and the El Jefe Challenge.


## v22 update

- Changed the decision cue text to white and centered it beneath the arrow.
- Added a little more space between the arrow and the decision label.
- Removed `(-3)` from the Deal and New Hand button labels.
- Tightened the empty space between the decision controls and the Deal/New Hand button.
- Added Enter-key support for dealing a hand in Play and starting a new hand in Train.
- Made the masthead crest a link back to Casa del Jefe.


## v23 update

- Reserved a fixed-height result area in Play.
- Final hand text no longer changes the table height, so the cards, chips, cream arc, and perspective lines stay perfectly still when the result appears.


## v24 update

- Renamed the suited first-decision category to “Certain three-card straight flush draws.”
- Uses “qualifying three-card straight flush draw” consistently in lookup explanations.
- Renamed the first second-decision category to “Guaranteed winners” and lists its made hands beneath it.
- Standardized visible labels to “First Decision” and “Second Decision.”
- Rebuilt the Lookup card layout so the plus sign is centered exactly between the adjacent cards on desktop and centered both horizontally and vertically on mobile.


## v25 update

- Shortened the lookup labels to **Player** and **Community**.
- Enlarged and padded the lookup card container so its labels remain fully contained.
- Raised the mobile plus sign slightly while keeping it horizontally centered.


## v26 update

Restored the Play accuracy feedback indicator. After each completed hand, a green `+` appears when both decisions were optimal and a red `−` appears when either decision was incorrect. The accuracy percentage remains hand-based and updates only after the hand is complete.


## v27 update

- Added an **Observational Plays** addendum at the bottom of Complete Optimal Strategy.
- Documents first-decision deviations for T-J-Q, the other three-rank combinations from T/J/Q/K, and low pairs when complete opposing hands reveal no matching ranks.
- Clarifies that the main guide assumes only the player's cards and community cards are known.


## v29 update

- Reserved a stable vertical-scrollbar gutter so Play, Train, and Look Up remain on the exact same horizontal centerline when switching modes.
- Advanced cache-busting asset URLs and the service-worker cache to v29.


## v30 update

- Standardized Play statistics as Balance / Accuracy / Bet.
- Moved Train statistics to the top of the felt as Hands / Accuracy.
- Added the shared Training Room wordmark and retained the Casa del Jefe Hall of Masters Grand Master certificate.
- Advanced cache-busting asset URLs and the service-worker cache to v30.
