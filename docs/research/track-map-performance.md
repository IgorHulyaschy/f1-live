# Track map performance

The maps hold 60 fps while a replay plays at 1× and 10× on the Pit wall preset at 2560 px, with
the main thread busy 6% of the time, and still about 59 fps with the CPU slowed four times. Six
maps at once (the Track preset) hold 58 to 60 fps.

## Method

- A production build (`vite build`, served by `vite preview`) on the e2e fixture of the 2025 Las
  Vegas race, opened at lap 30 with car positions from the replay chunks.
- Headless Chromium 2560×1440, device pixel ratio 1 or 2, through Playwright on an Apple M3 Pro
  laptop (12 cores), with other test runs sharing the machine. "CPU ×4" is Chrome's CPU
  throttling, a stand-in for a mid laptop or a phone.
- Play pressed, then 8 s measured: frames from a `requestAnimationFrame` counter, main-thread
  time from the DevTools `Performance.getMetrics` task duration, and the map's own draw time
  from `window.pitwallMapStats` (`client/src/features/track/track-canvas.tsx`).
- Each row is one run.

## Pit wall: timing, track map, gap chart, focus, race control

| Speed | Pixel ratio | CPU | fps  | Slowest frame | Main thread busy | Script | Map draw per frame |
| ----- | ----------- | --- | ---- | ------------- | ---------------- | ------ | ------------------ |
| 1×    | 1           | ×1  | 60.0 | 17 ms         | 5.7%             | 1.9%   | 0.29 ms            |
| 10×   | 1           | ×1  | 59.9 | 33 ms         | 5.7%             | 1.9%   | 0.29 ms            |
| 1×    | 2           | ×1  | 60.0 | 17 ms         | 11.2%            | 2.1%   | 0.33 ms            |
| 10×   | 2           | ×1  | 60.0 | 17 ms         | 10.9%            | 2.1%   | 0.31 ms            |
| 1×    | 1           | ×4  | 59.3 | 100 ms        | 24.3%            | 8.4%   | 1.30 ms            |
| 10×   | 1           | ×4  | 59.0 | 133 ms        | 24.1%            | 8.0%   | 1.29 ms            |
| 1×    | 2           | ×4  | 58.7 | 167 ms        | 42.7%            | 7.6%   | 1.18 ms            |
| 10×   | 2           | ×4  | 58.4 | 217 ms        | 44.4%            | 8.5%   | 1.36 ms            |

## Track preset: six maps at once

| Speed | Pixel ratio | CPU | fps  | Main thread busy | Map draws a second | Draw per map frame |
| ----- | ----------- | --- | ---- | ---------------- | ------------------ | ------------------ |
| 10×   | 1           | ×1  | 59.3 | 22.2%            | 314                | 0.21 ms            |
| 10×   | 1           | ×4  | 58.2 | 80.3%            | 307                | 0.80 ms            |

Before the circuit was drawn once per still camera and copied, the same ×4 run held 34 fps with
the main thread 98% busy.

## What keeps it cheap

- A camera that stands still draws the circuit, its painted stretches and marks once into a
  layer and copies it; a frame then draws only the cars and their labels.
- Replay chunks are expanded once into typed arrays; a frame samples 22 cars on a curve through
  their 250 ms samples.
- Readings beside the maps (gaps, the rejoin, the car list) update every 0.4 to 2 s, not every
  frame. A map off screen stops its frame loop and draws only when its data changes.
- With reduced motion, a moving map is drawn once a second.

## Not measured

- A real phone and a real mid laptop: the CPU throttling is an estimate of them.
- The slowest single frames under ×4 throttling (100 to 217 ms) were not traced to a cause; they
  come a few times in 8 s and the average stays at 58 to 59 fps.
