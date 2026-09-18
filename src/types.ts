/** Posture problems the demo can flag. */
export type Issue = 'tooClose' | 'headDown' | 'slouch';

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

export interface Point {
  x: number;
  y: number;
}

/** Scale-free posture measurements extracted from one video frame. */
export interface FrameMetrics {
  /** Inter-pupillary distance in pixels. Grows as the user moves closer. */
  ipd: number;
  /** Head pitch proxy in degrees. Positive = forehead closer to camera than chin (looking down). */
  pitch: number;
  /** (shoulderMidY - noseY) / shoulderWidth. Shrinks when the head sinks toward the shoulders. null if shoulders not visible. */
  torsoRatio: number | null;
  /** Pixel-space key points for the overlay. */
  points: {
    leftIris: Point;
    rightIris: Point;
    forehead: Point;
    chin: Point;
    shoulders: [Point, Point] | null;
  };
}

/** Per-user reference values captured while sitting upright. */
export interface Baseline {
  ipd: number;
  pitch: number;
  torsoRatio: number | null;
  createdAt: number;
}

export interface IssueState {
  /** Smoothed deviation from baseline; null when the signal is unavailable. */
  value: number | null;
  active: boolean;
  activeSince: number | null;
}

export interface Verdict {
  issues: Record<Issue, IssueState>;
  alarm: boolean;
  /** 0..1, ramps up the longer the alarm has been active. */
  severity: number;
}
