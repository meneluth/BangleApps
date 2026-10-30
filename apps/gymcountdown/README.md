# Gym Countdown

Four one-tap rest timers for gym sessions, built for the Bangle.js 2.

## Usage

The app opens on a grid of four coloured quadrants:

| Quadrant     | Duration | Colour |
| ------------ | -------- | ------ |
| Top left     | 20 s     | Red    |
| Top right    | 30 s     | Blue   |
| Bottom left  | 60 s     | Yellow |
| Bottom right | 90 s     | Green  |

Tap a quadrant to start its countdown. The whole screen takes that quadrant's
colour and shows the remaining time, and the display is kept on for the
duration of the timer.

From the grid the labels read as plain seconds, while the countdown itself is
always shown as `mm:ss` — a 20-second timer starts at `00:20` and a 90-second
one at `01:30`, both ending on `00:00`.

When the countdown reaches zero the watch vibrates once and emits a single
short beep. The screen stays on `00:00` so a finished timer is still obvious at
a glance.

Underneath the running time, a smaller label repeats the value the timer
started from, also in `mm:ss` (`00:20`, `00:30`, `01:00`, `01:30`), in the same
font and colour, so the original duration is clear at a glance.

Tap anywhere to go back to the grid. This works whether the timer has finished
or is still running — a running timer is simply cancelled.

The back button behaves the same way during a countdown, and exits the app from
the grid.