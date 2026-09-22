/** Posture problems the demo can flag. */
export type Issue =
  | 'tooClose'
  | 'headDown'
  | 'headTilt'
  | 'headForward'
  | 'slouch'
  | 'shrug'
  | 'sideLean'
  | 'blink'
  | 'sitting'
  | 'lookAway';

/** Hysteresis + dwell-time rule for one issue. Deviation units differ per issue (see config.ts). */
export interface IssueRule {
  /** Deviation above which the issue starts counting as bad. */
  enter: number;
  /** Deviation below which an active issue starts counting as recovered. Must be < enter. */
  exit: number;
  /** How long the deviation must stay bad before the alarm fires. */
  enterMs: number;
  /** How long the deviation must stay good before the alarm clears. */
  exitMs: number;
}

export type Sensitivity = 'low' | 'normal' | 'high';

export interface Point {
  x: number;
  y: number;
}

/** Shoulder-based measurements; only available when both shoulders are in frame. */
export interface ShoulderMetrics {
  /** Shoulder width in pixels. */
  width: number;
  /** Shoulder line angle in degrees, −90..90; 0 = level. */
  tilt: number;
  /** Shoulder midpoint y in pixels. */
  midY: number;
  /**
   * (shoulder midpoint y − head reference y) / width. Shrinks when the head sinks toward the
   * shoulders or the shoulders rise. The reference is the ear midpoint (barely moves with head
   * pitch) when both ears are visible, else the nose tip.
   */
  torsoRatio: number;
  /** Head reference y in pixels (ears or nose, see torsoRatio). */
  headY: number;
  /** Whether torsoRatio/headY use the ears (true) or the nose (false). */
  usesEars: boolean;
  /** (noseX − shoulderMidX) / width. Grows when the upper body leans to one side. */
  lateral: number;
  /** ipd / width. Grows when only the head moves toward the screen (forward head posture). */
  headForward: number;
}

/** Scale-free posture measurements extracted from one video frame. */
export interface FrameMetrics {
  /** Inter-pupillary distance in pixels. Grows as the user moves closer. */
  ipd: number;
  /** Head pitch in degrees. Positive = looking down. */
  pitch: number;
  /** Head roll in degrees from the eye line, −90..90; 0 = level. */
  roll: number;
  /** Nose tip y in pixels; used as a slouch fallback when shoulders are hidden. */
  noseY: number;
  /** Forehead-to-chin distance in pixels; normalizes noseY drops. */
  faceHeight: number;
  /** Mean eye-closure blendshape, 0 (open) to 1 (closed); null if blendshapes are unavailable. */
  eyeClosed: number | null;
  shoulders: ShoulderMetrics | null;
  /** Pixel-space key points for the overlay. */
  points: {
    leftIris: Point;
    rightIris: Point;
    forehead: Point;
    chin: Point;
    ears: [Point, Point] | null;
    shoulders: [Point, Point] | null;
  };
}

/** Per-user reference values captured while sitting upright. */
export interface Baseline {
  ipd: number;
  pitch: number;
  roll: number;
  noseY: number;
  faceHeight: number;
  shoulders: ShoulderMetrics | null;
  createdAt: number;
}

export interface IssueState {
  /** Smoothed deviation from baseline; null when the signal is unavailable. */
  value: number | null;
  /** Effective enter threshold after the sensitivity preset; lets the UI show value/threshold. */
  threshold: number;
  active: boolean;
  activeSince: number | null;
}

export interface Verdict {
  issues: Record<Issue, IssueState>;
  alarm: boolean;
  /** 0..1, ramps up the longer the alarm has been active. */
  severity: number;
  /**
   * Milliseconds left in the look-away break, or null outside one. During the break every other
   * check is paused (no readings, no alarms) and the break itself is shown as a countdown.
   */
  breakLeftMs: number | null;
}
