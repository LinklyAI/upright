import type { Issue, IssueRule } from './types';

/** Served from public/wasm, copied from node_modules by scripts/copy-wasm.mjs. */
export const WASM_PATH = '/wasm';

export const MODEL_URLS = {
  face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
} as const;

/** Detection cadence in the foreground. Hidden tabs are throttled to ~1 Hz by Chrome, which is still enough. */
export const TICK_MS = 120;

/** EMA time constant for smoothing deviations. */
export const SMOOTHING_TAU_MS = 400;

/** Calibration window: user sits upright while we collect samples. */
export const CALIBRATION_MS = 3000;
export const CALIBRATION_MIN_SAMPLES = 10;

/** How long an alarm takes to reach full intensity. */
export const SEVERITY_RAMP_MS = 8000;

export const BEEP_INTERVAL_MS = 2500;
export const NOTIFY_INTERVAL_MS = 30000;

/**
 * Deviation units:
 * - tooClose: ipd / baseline.ipd - 1 (0.15 = 15% closer)
 * - headDown: pitch - baseline.pitch in degrees
 * - slouch:   1 - torsoRatio / baseline.torsoRatio (0.15 = head sank 15% toward shoulders)
 */
export const RULES: Record<Issue, IssueRule> = {
  tooClose: { enter: 0.15, exit: 0.08, enterMs: 3000, exitMs: 1500 },
  headDown: { enter: 12, exit: 6, enterMs: 3000, exitMs: 1500 },
  slouch: { enter: 0.15, exit: 0.08, enterMs: 3000, exitMs: 1500 },
};

export const ISSUE_LABELS: Record<Issue, string> = {
  tooClose: '离屏幕太近',
  headDown: '低头 / 脖子前倾',
  slouch: '驼背 / 身体塌陷',
};

export const STORAGE_KEY = 'posture-guard.baseline.v1';
