# Upright

**Are you sitting up straight?**

[English](README.md) | [简体中文](README.zh-CN.md)

Posture detection that runs entirely in your browser. Open the page, allow the camera, calibrate for three seconds, and Upright tints the page red and beeps whenever you lean into the screen, drop your head, tilt, slouch, lean to one side, or sit too long. Video never leaves your device and there is no server.

## Run

```bash
pnpm install
pnpm dev
```

Open the address Vite prints in Chrome. Camera access requires `localhost` or HTTPS.

1. Click **Start camera** and allow camera and notification access. The first run downloads two models (about 10 MB) from Google's model storage; later runs use the browser cache.
2. Sit upright and click **Calibrate**, holding still for three seconds. The baseline is stored in `localStorage` and reused on the next visit.
3. Switch to other tabs, or open the **Floating window** to keep the status panel on top.

Language, theme, sensitivity, sound and the calibration baseline all persist across reloads.

## How it works

```
camera → MediaPipe Face Landmarker + Pose Landmarker (WASM/WebGPU, on device)
       → metrics.ts      scale-free measurements
       → judge.ts        compare with the calibrated baseline, EMA smoothing, hysteresis, dwell time
       → alerts.ts       red page wash, beeps, tab title, system notification
```

| Check            | Signal                                                                                                                       | Default enter / exit    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Too close        | pupil distance in px / baseline − 1                                                                                          | 12% / 6%                |
| Head down        | head pitch from the facial transformation matrix (degrees) − baseline                                                        | 12° / 6°                |
| Head tilt        | absolute change in the eye-line angle (degrees)                                                                              | 12° / 6°                |
| Forward head     | (pupil distance / shoulder width) / baseline − 1; rises when only the head moves forward                                     | 18% / 9%                |
| Slouching        | 1 − (nose-to-shoulder height / shoulder width) / baseline; falls back to the nose sinking in frame when shoulders are hidden | 18% / 9% (fallback 40%) |
| Leaning sideways | the larger of shoulder-line tilt (10°) and lateral nose offset (20% of shoulder width)                                       | threshold / half        |
| Sitting too long | continuous time in frame; leaving for two minutes counts as standing up                                                      | 45 min                  |

- Every check is **relative to a personal baseline**, so camera angle, offset, height and chair height cancel out during calibration.
- A problem must persist for three seconds before the alarm fires, and clears after 1.5 seconds of good posture. Enter and exit thresholds differ to avoid flapping at the boundary.
- The **Sensitivity** control scales all thresholds and the dwell time: low ×1.4 / 4 s, normal ×1 / 3 s, high ×0.6 / 2 s. Sitting time is unaffected.
- Leaving the frame counts as good posture, so alarms clear when you walk away.
- Thresholds and time constants live in `src/config.ts`.

## Background tabs

Chrome neither discards nor freezes a tab that is capturing the camera, and exempts it from the once-a-minute intensive throttling, but timers are still aligned to roughly 1 Hz. The detection loop uses `setInterval` rather than `requestAnimationFrame` (which stops entirely in hidden tabs); about 1 fps in the background is enough for a three-second decision window. While a beep is playing the tab counts as audible, which relaxes throttling further.

For higher background frame rates, the next step is transferring the `MediaStreamTrack` to a Web Worker and reading frames with `MediaStreamTrackProcessor`.

## Known limits

- The sign of head pitch depends on MediaPipe's matrix layout (column-major, z toward the viewer). If the "Head pitch" deviation goes negative when you look down, set `HEAD_PITCH_SIGN` in `src/config.ts` to −1.
- Leaning and forward-head checks need both shoulders in frame.
- No multimodal model is involved. Sending a frame to a vision model when a check hovers near its threshold for a long time would be an optional refinement.
- Only Chrome is targeted; Document Picture-in-Picture is Chrome-specific.
