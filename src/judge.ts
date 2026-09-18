import {
  BLINK_CLOSE_THRESHOLD,
  BLINK_OPEN_THRESHOLD,
  BLINK_SEVERITY,
  SENSITIVITY_PRESETS,
  SEVERITY_RAMP_MS,
  SIDE_LEAN_LATERAL,
  SIDE_LEAN_TILT_DEG,
  SITTING_ABSENCE_RESET_MS,
  SLOUCH_NOSE_DROP,
  SLOUCH_TORSO_DROP,
  SMOOTHING_TAU_MS,
  UNSCALED_ISSUES,
  UNSMOOTHED_ISSUES,
  type SensitivityPreset,
} from './config';
import type { Baseline, FrameMetrics, Issue, IssueRule, IssueState, Sensitivity, Verdict } from './types';

const ISSUES: readonly Issue[] = [
  'tooClose',
  'headDown',
  'headTilt',
  'headForward',
  'slouch',
  'shrug',
  'sideLean',
  'blink',
  'sitting',
];

/**
 * State machine for one issue: EMA smoothing, hysteresis thresholds and dwell times.
 * A missing signal (null) counts as "good" so leaving the frame clears the alarm.
 */
class IssueTracker {
  private smoothed: number | null = null;
  private lastAt: number | null = null;
  private badSince: number | null = null;
  private goodSince: number | null = null;
  private active = false;
  private activeSince: number | null = null;

  constructor(
    private readonly rule: IssueRule,
    /** Returns the current sensitivity preset; null means the rule is used as-is. */
    private readonly preset: () => SensitivityPreset | null,
    private readonly smoothing: boolean,
  ) {}

  update(raw: number | null, now: number): IssueState {
    this.smoothed = this.smoothing ? this.smooth(raw, now) : raw;
    this.lastAt = now;

    const preset = this.preset();
    const scale = preset?.threshold ?? 1;
    const enterMs = this.rule.enterMs * (preset?.dwell ?? 1);
    const threshold = (this.active ? this.rule.exit : this.rule.enter) * scale;
    const bad = this.smoothed !== null && this.smoothed > threshold;

    if (bad) {
      this.goodSince = null;
      this.badSince ??= now;
      if (!this.active && now - this.badSince >= enterMs) {
        this.active = true;
        this.activeSince = now;
      }
    } else {
      this.badSince = null;
      this.goodSince ??= now;
      if (this.active && now - this.goodSince >= this.rule.exitMs) {
        this.active = false;
        this.activeSince = null;
      }
    }

    return {
      value: this.smoothed,
      threshold: this.rule.enter * scale,
      active: this.active,
      activeSince: this.activeSince,
    };
  }

  private smooth(raw: number | null, now: number): number | null {
    if (raw === null) return null;
    if (this.smoothed === null || this.lastAt === null) return raw;
    const dt = Math.max(0, now - this.lastAt);
    const alpha = 1 - Math.exp(-dt / SMOOTHING_TAU_MS);
    return this.smoothed + alpha * (raw - this.smoothed);
  }
}

/** Tracks how long the user has been continuously in frame; short gaps do not reset it. */
class SeatedTimer {
  private seatedSince: number | null = null;
  private lastPresentAt: number | null = null;

  /** Returns minutes seated, or null when the user is away. */
  update(present: boolean, now: number): number | null {
    if (present) {
      this.seatedSince ??= now;
      this.lastPresentAt = now;
      return (now - this.seatedSince) / 60000;
    }
    if (this.lastPresentAt !== null && now - this.lastPresentAt >= SITTING_ABSENCE_RESET_MS) {
      this.seatedSince = null;
    }
    return null;
  }
}

/**
 * Counts blinks from the eye-closure blendshape with hysteresis and reports seconds since the
 * last one. Needs several frames per second; the caller passes null when that is not the case
 * (hidden tab) so no false "not blinking" alarm is raised.
 */
class BlinkTimer {
  private closed = false;
  private lastBlinkAt: number | null = null;

  update(eyeClosed: number | null, now: number): number | null {
    if (eyeClosed === null) {
      this.lastBlinkAt = null;
      this.closed = false;
      return null;
    }
    this.lastBlinkAt ??= now;
    if (!this.closed && eyeClosed >= BLINK_CLOSE_THRESHOLD) this.closed = true;
    else if (this.closed && eyeClosed <= BLINK_OPEN_THRESHOLD) {
      this.closed = false;
      this.lastBlinkAt = now;
    }
    return (now - this.lastBlinkAt) / 1000;
  }
}

export class PostureJudge {
  private readonly trackers: Record<Issue, IssueTracker>;
  private readonly seated = new SeatedTimer();
  private readonly blink = new BlinkTimer();
  private sensitivity: Sensitivity = 'normal';
  private muted: ReadonlySet<Issue> = new Set();

  constructor(
    private readonly baseline: Baseline,
    rules: Record<Issue, IssueRule>,
    sensitivity: Sensitivity,
  ) {
    this.sensitivity = sensitivity;
    const preset = (issue: Issue) => () => (UNSCALED_ISSUES.has(issue) ? null : SENSITIVITY_PRESETS[this.sensitivity]);
    this.trackers = Object.fromEntries(
      ISSUES.map((issue) => [issue, new IssueTracker(rules[issue], preset(issue), !UNSMOOTHED_ISSUES.has(issue))]),
    ) as Record<Issue, IssueTracker>;
  }

  setSensitivity(value: Sensitivity): void {
    this.sensitivity = value;
  }

  /** Muted checks keep measuring (so the gauge stays live) but never raise an alarm. */
  setMuted(issues: ReadonlySet<Issue>): void {
    this.muted = issues;
  }

  update(metrics: FrameMetrics | null, now: number): Verdict {
    const deviations = this.deviations(metrics, now);
    const issues = Object.fromEntries(
      ISSUES.map((issue) => {
        const state = this.trackers[issue].update(deviations[issue], now);
        return [issue, this.muted.has(issue) ? { ...state, active: false, activeSince: null } : state];
      }),
    ) as Record<Issue, IssueState>;

    let severity = 0;
    for (const issue of ISSUES) {
      const state = issues[issue];
      if (!state.active || state.activeSince === null) continue;
      // A blink reminder is a nudge, not a posture fault: it never drives the page deep red.
      if (issue === 'blink') {
        severity = Math.max(severity, BLINK_SEVERITY);
        continue;
      }
      const ramp = Math.min(1, (now - state.activeSince) / SEVERITY_RAMP_MS);
      severity = Math.max(severity, 0.35 + 0.65 * ramp);
    }

    return { issues, alarm: severity > 0, severity };
  }

  /** Signed deviations from baseline; positive means "worse". See config.ts for units. */
  private deviations(metrics: FrameMetrics | null, now: number): Record<Issue, number | null> {
    const sitting = this.seated.update(metrics !== null, now);
    const blink = this.blink.update(metrics?.eyeClosed ?? null, now);
    if (!metrics) {
      return {
        tooClose: null,
        headDown: null,
        headTilt: null,
        headForward: null,
        slouch: null,
        shrug: null,
        sideLean: null,
        blink,
        sitting,
      };
    }
    const b = this.baseline;
    const s = metrics.shoulders;
    // Shoulder-relative checks only make sense when the head reference matches the baseline's.
    const bs = s && b.shoulders && s.usesEars === b.shoulders.usesEars ? b.shoulders : null;

    let slouch: number;
    let shrug: number | null = null;
    if (s && bs) {
      // Positions relative to calibration, in units of the calibrated shoulder width.
      const shoulderRise = (bs.midY - s.midY) / bs.width;
      const headRise = (bs.headY - s.headY) / bs.width;
      // Shoulders coming up toward a head that stayed put. Whole-body movement cancels out.
      shrug = shoulderRise - Math.max(0, headRise);
      // Head-to-shoulder distance shrinking, minus the part explained by a shrug.
      const torsoDrop = 1 - s.torsoRatio / bs.torsoRatio;
      slouch = (torsoDrop - Math.max(0, shrug) / bs.torsoRatio) / SLOUCH_TORSO_DROP;
    } else {
      // Fall back to the nose sinking in frame. Not used alongside shoulders because moving
      // closer also lowers the face when the camera sits above eye level.
      slouch = (metrics.noseY - b.noseY) / b.faceHeight / SLOUCH_NOSE_DROP;
    }

    const sideLean =
      s && bs
        ? Math.max(
            Math.abs(s.tilt - bs.tilt) / SIDE_LEAN_TILT_DEG,
            Math.abs(s.lateral - bs.lateral) / SIDE_LEAN_LATERAL,
          )
        : null;

    return {
      tooClose: metrics.ipd / b.ipd - 1,
      headDown: metrics.pitch - b.pitch,
      headTilt: Math.abs(metrics.roll - b.roll),
      headForward: s && bs ? s.headForward / bs.headForward - 1 : null,
      slouch,
      shrug,
      sideLean,
      blink,
      sitting,
    };
  }
}
