# Casa del Jefe — Let It Ride Lounge

A self-contained browser trainer for the standard Let It Ride paytable:
1000 / 200 / 50 / 11 / 8 / 5 / 3 / 2 / 1 for royal flush through pair of tens or better.

## Modes

- **Play**: three-unit bankroll simulation, decision accuracy, mistake review, and actual-vs-optimal bankroll chart.
- **Train**: practices complete hands and scores the hand only when both decisions are optimal.
- **Look Up**: accepts three player cards, plus an optional revealed community card, and reports the exact decision and one-unit ride EV.
- **El Jefe Challenge**: 100 complete hands without immediate feedback.

Indifferent second-decision states accept Pull or Let It Ride as correct.

## Files

Open `index.html` directly, or serve this directory from any static web host. The service worker is active only when served over HTTP/HTTPS.

## Keyboard shortcuts

During Play, Train, or Challenge:

- `P`: Pull Back
- `R`: Let It Ride
