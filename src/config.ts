import type { Issue, IssueRule, Sensitivity } from './types';

/** Served from public/wasm, copied from node_modules by scripts/copy-wasm.mjs. */
export const WASM_PATH = '/wasm';

export const MODEL_URLS = {
  face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
} as const;

/** Detection cadence in the foreground. Hidden tabs are throttled to ~1 Hz by Chrome, which is still enough. */
export const TICK_MS = 120;

/** EMA time constant for smoothing deviations. */
export const SMOOTHING_TAU_MS = 600;

/** Calibration window: user sits upright while we collect samples. */
export const CALIBRATION_MS = 3000;
export const CALIBRATION_MIN_SAMPLES = 10;

/** How long an alarm takes to reach full intensity. */
export const SEVERITY_RAMP_MS = 8000;

export const BEEP_INTERVAL_MS = 2500;
export const NOTIFY_INTERVAL_MS = 30000;

/**
 * Flip to -1 if "头部俯仰" deviation goes negative when you look down. The sign depends on
 * MediaPipe's matrix layout and camera-space convention; see metrics.ts.
 */
export const HEAD_PITCH_SIGN = 1;

/** Component thresholds folded into the composite (normalized) slouch and sideLean scores. */
export const SLOUCH_TORSO_DROP = 0.18;
export const SLOUCH_NOSE_DROP = 0.4;
export const SIDE_LEAN_TILT_DEG = 10;
export const SIDE_LEAN_LATERAL = 0.2;

/** Continuous sitting reminder. */
export const SITTING_LIMIT_MIN = 45;
/** Leaving the frame for this long counts as standing up and resets the sitting timer. */
export const SITTING_ABSENCE_RESET_MS = 120000;

/**
 * Deviation units:
 * - tooClose:    ipd / baseline.ipd - 1 (0.12 = 12% closer)
 * - headDown:    pitch - baseline.pitch in degrees
 * - headTilt:    |roll - baseline.roll| in degrees
 * - headForward: (ipd / shoulderWidth) / baseline - 1
 * - slouch:      normalized score, 1 = component threshold reached
 * - sideLean:    normalized score, 1 = component threshold reached
 * - sitting:     minutes seated without a break
 */
export const RULES: Record<Issue, IssueRule> = {
  tooClose: { enter: 0.12, exit: 0.06, enterMs: 3000, exitMs: 1500 },
  headDown: { enter: 12, exit: 6, enterMs: 3000, exitMs: 1500 },
  headTilt: { enter: 12, exit: 6, enterMs: 3000, exitMs: 1500 },
  headForward: { enter: 0.18, exit: 0.09, enterMs: 3000, exitMs: 1500 },
  slouch: { enter: 1, exit: 0.5, enterMs: 3000, exitMs: 1500 },
  sideLean: { enter: 1, exit: 0.5, enterMs: 3000, exitMs: 1500 },
  sitting: { enter: SITTING_LIMIT_MIN, exit: SITTING_LIMIT_MIN, enterMs: 0, exitMs: SITTING_ABSENCE_RESET_MS },
};

/** Issues whose thresholds are not affected by the sensitivity setting. */
export const UNSCALED_ISSUES: ReadonlySet<Issue> = new Set<Issue>(['sitting']);

export interface SensitivityPreset {
  /** Multiplied into enter/exit thresholds. */
  threshold: number;
  /** Replaces enterMs. */
  enterMs: number;
}

export const SENSITIVITY_PRESETS: Record<Sensitivity, SensitivityPreset> = {
  low: { threshold: 1.4, enterMs: 4000 },
  normal: { threshold: 1, enterMs: 3000 },
  high: { threshold: 0.6, enterMs: 2000 },
};


export const STORAGE_KEY_BASELINE = 'posture-guard.baseline.v2';
