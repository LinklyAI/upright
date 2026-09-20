import type { Baseline, FrameMetrics } from './types';

/** Shoulder-relative signals; only available when both shoulders were visible now and at calibration. */
export interface ShoulderSignals {
  /** (ipd / shoulderWidth) / baseline − 1. Positive = only the head moved toward the screen. */
  headForward: number;
  /** 1 − torsoRatio / baseline. Positive = the head sank toward the shoulders (or they rose). */
  torsoDrop: number;
  /** Shoulders rising relative to calibration, as a fraction of the calibrated shoulder width. */
  shoulderRise: number;
  /** Head reference rising relative to calibration, same unit as shoulderRise. */
  headRise: number;
  /** Absolute change of the shoulder line angle, degrees. */
  tiltDelta: number;
  /** Absolute change of the nose offset from the shoulder midline, as a fraction of shoulder width. */
  lateralDelta: number;
}

/**
 * Raw posture signals of one frame relative to the personal baseline. Positive means "worse".
 * judge.ts turns these into the per-issue deviations of config.ts.
 */
export interface PostureSignals {
  /** ipd / baseline.ipd − 1. Positive = closer to the screen. */
  closer: number;
  /** pitch − baseline.pitch, degrees. Positive = looking further down. */
  pitchDown: number;
  /** |roll − baseline.roll|, degrees. */
  rollDelta: number;
  /** Nose sinking in frame as a fraction of face height; the slouch fallback when shoulders are hidden. */
  noseDrop: number;
  shoulders: ShoulderSignals | null;
}

export function computeSignals(metrics: FrameMetrics, baseline: Baseline): PostureSignals {
  const s = metrics.shoulders;
  // Shoulder-relative checks only make sense when the head reference matches the baseline's.
  const bs = s && baseline.shoulders && s.usesEars === baseline.shoulders.usesEars ? baseline.shoulders : null;
  const shoulders: ShoulderSignals | null =
    s && bs
      ? {
          headForward: s.headForward / bs.headForward - 1,
          torsoDrop: 1 - s.torsoRatio / bs.torsoRatio,
          shoulderRise: (bs.midY - s.midY) / bs.width,
          headRise: (bs.headY - s.headY) / bs.width,
          tiltDelta: Math.abs(s.tilt - bs.tilt),
          lateralDelta: Math.abs(s.lateral - bs.lateral),
        }
      : null;
  return {
    closer: metrics.ipd / baseline.ipd - 1,
    pitchDown: metrics.pitch - baseline.pitch,
    rollDelta: Math.abs(metrics.roll - baseline.roll),
    noseDrop: (metrics.noseY - baseline.noseY) / baseline.faceHeight,
    shoulders,
  };
}
