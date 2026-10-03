# Track map performance

The maps hold 60 fps while a replay plays at 1× and 10× on the Pit wall preset at 2560 px, with
the main thread busy about 5% of the time, and still about 58.5 fps with the CPU slowed four
times. Six maps at once (the Track preset) hold 59 to 60 fps.

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
| 1×    | 1           | ×1  | 60.0 | 17 ms         | 5.2%             | 1.5%   | 0.24 ms            |
| 10×   | 1           | ×1  | 60.0 | 17 ms         | 5.6%             | 1.7%   | 0.26 ms            |
| 1×    | 2           | ×1  | 59.9 | 33 ms         | 10.3%            | 1.7%   | 0.26 ms            |
| 10×   | 2           | ×1  | 59.6 | 50 ms         | 13.3%            | 2.5%   | 0.39 ms            |
| 1×    | 1           | ×4  | 58.6 | 183 ms        | 25.7%            | 8.9%   | 1.38 ms            |
| 10×   | 1           | ×4  | 58.8 | 133 ms        | 25.4%            | 8.4%   | 1.32 ms            |
| 1×    | 2           | ×4  | 58.5 | 200 ms        | 46.0%            | 8.9%   | 1.33 ms            |
| 10×   | 2           | ×4  | 58.3 | 233 ms        | 45.9%            | 8.2%   | 1.30 ms            |

## Track preset: six maps at once

| Speed | Pixel ratio | CPU | fps  | Main thread busy | Map draws a second | Draw per map frame |
| ----- | ----------- | --- | ---- | ---------------- | ------------------ | ------------------ |
| 10×   | 1           | ×1  | 59.9 | 20.7%            | 312                | 0.17 ms            |
| 10×   | 1           | ×4  | 58.9 | 72.7%            | 312                | 0.63 ms            |

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
- The slowest single frames under ×4 throttling (130 to 230 ms) were not traced to a cause; they
  come a few times in 8 s and the average stays at 58 to 59 fps.
