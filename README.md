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

1. Click **Start camera** and allow camera and notification access. The two MediaPipe models (about 9 MB) are served from the site itself, so no third-party host is needed; later runs use the browser cache.
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

| Check            | Signal                                                                                                                      | Default enter / exit    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Too close        | pupil distance in px / baseline − 1                                                                                         | 12% / 6%                |
| Head down        | head pitch from the facial transformation matrix (degrees) − baseline                                                       | 12° / 6°                |
| Head tilt        | absolute change in the eye-line angle (degrees)                                                                             | 12° / 6°                |
| Forward head     | (pupil distance / shoulder width) / baseline − 1; rises when only the head moves forward                                    | 10% / 5%                |
| Slouching        | 1 − (ear-to-shoulder height / shoulder width) / baseline; falls back to the nose sinking in frame when shoulders are hidden | 12% / 6% (fallback 40%) |
| Raised shoulders | shoulders rising in frame while the head stays put, as a fraction of shoulder width; any head movement is deducted          | 8% / 4%                 |
| Leaning sideways | the larger of shoulder-line tilt (14°) and lateral nose offset (30% of shoulder width); must persist for 8 s                | threshold / half        |
| Blink reminder   | seconds since the last blink, from the eye-closure blendshapes; suspended in background tabs where blinks cannot be seen    | 12 s / 6 s              |
| Sitting too long | continuous time in frame; leaving for two minutes counts as standing up                                                     | 45 min                  |
| Look-away        | 20-20-20 rule: screen time since the last break; resets after 20 s out of frame or 20 s of the reminder showing             | 20 min                  |

- Every check is **relative to a personal baseline**, so camera angle, offset, height and chair height cancel out during calibration.
- A problem must persist for three seconds before the alarm fires, and clears after 1.5 seconds of good posture. Enter and exit thresholds differ to avoid flapping at the boundary.
- The **Sensitivity** control scales all thresholds and dwell times: low ×1.4 / ×1.33, normal ×1, high ×0.6 / ×0.67. Sitting time is unaffected.
- Every check has a switch under the controls, next to the sound switch. A check that is switched off keeps measuring but never alarms, and its gauge is shown muted. The choice is remembered.
- Slouching is measured from the ears rather than the nose, so looking down no longer reads as slouching.
- **Pause** releases the camera and stops all alerts; **Resume** reopens it without reloading the models.
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
