import {
  BLINK_CLOSE_THRESHOLD,
  BLINK_OPEN_THRESHOLD,
  LOOK_AWAY_BREAK_MS,
  LOOK_AWAY_INTERVAL_MIN,
  NUDGE_SEVERITY,
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
import { computeSignals } from './signals';
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
  'lookAway',
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

/**
 * 20-20-20 timer: minutes of continuous screen time. Once the interval is up a break starts and
 * runs for the break length whether the user looks away in frame or leaves it; being out of
 * frame for the break length also resets the screen time on its own.
 */
class LookAwayTimer {
  private screenSince: number | null = null;
  private awaySince: number | null = null;
  private breakSince: number | null = null;

  update(present: boolean, now: number): number | null {
    if (!present) {
      this.awaySince ??= now;
      if (now - this.awaySince >= LOOK_AWAY_BREAK_MS) {
        this.screenSince = null;
        this.breakSince = null;
      }
      return null;
    }
    this.awaySince = null;
    this.screenSince ??= now;
    const minutes = (now - this.screenSince) / 60000;
    if (minutes >= LOOK_AWAY_INTERVAL_MIN) {
      this.breakSince ??= now;
      if (now - this.breakSince >= LOOK_AWAY_BREAK_MS) {
        this.screenSince = now;
        this.breakSince = null;
        return 0;
      }
    } else {
      this.breakSince = null;
    }
    return minutes;
  }

  /** Milliseconds left in the current break, or null outside one. Call after update(). */
  breakLeftMs(now: number): number | null {
    if (this.breakSince === null) return null;
    return Math.max(0, LOOK_AWAY_BREAK_MS - (now - this.breakSince));
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
  private readonly lookAway = new LookAwayTimer();
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
    // A muted reminder never starts a break.
    const breakLeftMs = this.muted.has('lookAway') ? null : this.lookAway.breakLeftMs(now);
    // While the user is meant to be looking away, every other check pauses: no readings (so
    // a turned head does not build up dwell time) and no alarms.
    if (breakLeftMs !== null) {
      for (const issue of ISSUES) if (issue !== 'lookAway') deviations[issue] = null;
    }
    const issues = Object.fromEntries(
      ISSUES.map((issue) => {
        const state = this.trackers[issue].update(deviations[issue], now);
        const silenced = this.muted.has(issue) || (breakLeftMs !== null && issue !== 'lookAway');
        return [issue, silenced ? { ...state, active: false, activeSince: null } : state];
      }),
    ) as Record<Issue, IssueState>;

    let severity = 0;
    for (const issue of ISSUES) {
      const state = issues[issue];
      if (!state.active || state.activeSince === null) continue;
      // The break is shown as a countdown, not raised as an alarm.
      if (issue === 'lookAway' && breakLeftMs !== null) continue;
      // Reminders are nudges, not posture faults: they never drive the page deep red.
      if (issue === 'blink' || issue === 'lookAway') {
        severity = Math.max(severity, NUDGE_SEVERITY);
        continue;
      }
      const ramp = Math.min(1, (now - state.activeSince) / SEVERITY_RAMP_MS);
      severity = Math.max(severity, 0.35 + 0.65 * ramp);
    }

    return { issues, alarm: severity > 0, severity, breakLeftMs };
  }

  /** Signed deviations from baseline; positive means "worse". See config.ts for units. */
  private deviations(metrics: FrameMetrics | null, now: number): Record<Issue, number | null> {
    const sitting = this.seated.update(metrics !== null, now);
    const lookAway = this.lookAway.update(metrics !== null, now);
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
        lookAway,
      };
    }
    const sig = computeSignals(metrics, this.baseline);
    const sh = sig.shoulders;

    let slouch: number;
    let shrug: number | null = null;
    if (sh) {
      // Shoulders coming up while the head stays put. Any head movement (whole body rising, or
      // the head dropping in a slouch) is deducted, so only a true shrug scores.
      shrug = sh.shoulderRise - Math.abs(sh.headRise);
      // Head-to-shoulder distance shrinking. Hunching also rolls the shoulders up in frame, so
      // no shrug component is subtracted here; that would hide a real slouch.
      slouch = sh.torsoDrop / SLOUCH_TORSO_DROP;
    } else {
      // Fall back to the nose sinking in frame. Not used alongside shoulders because moving
      // closer also lowers the face when the camera sits above eye level.
      slouch = sig.noseDrop / SLOUCH_NOSE_DROP;
    }

    const sideLean = sh ? Math.max(sh.tiltDelta / SIDE_LEAN_TILT_DEG, sh.lateralDelta / SIDE_LEAN_LATERAL) : null;

    return {
      tooClose: sig.closer,
      headDown: sig.pitchDown,
      headTilt: sig.rollDelta,
      headForward: sh ? sh.headForward : null,
      slouch,
      shrug,
      sideLean,
      blink,
      sitting,
      lookAway,
    };
  }
}
