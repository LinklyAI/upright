import { SEVERITY_RAMP_MS, SMOOTHING_TAU_MS } from './config';
import type { Baseline, FrameMetrics, Issue, IssueRule, IssueState, Verdict } from './types';

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

  constructor(private readonly rule: IssueRule) {}

  update(raw: number | null, now: number): IssueState {
    this.smoothed = this.smooth(raw, now);
    this.lastAt = now;

    const threshold = this.active ? this.rule.exit : this.rule.enter;
    const bad = this.smoothed !== null && this.smoothed > threshold;

    if (bad) {
      this.goodSince = null;
      this.badSince ??= now;
      if (!this.active && now - this.badSince >= this.rule.enterMs) {
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

    return { value: this.smoothed, active: this.active, activeSince: this.activeSince };
  }

  private smooth(raw: number | null, now: number): number | null {
    if (raw === null) return null;
    if (this.smoothed === null || this.lastAt === null) return raw;
    const dt = Math.max(0, now - this.lastAt);
    const alpha = 1 - Math.exp(-dt / SMOOTHING_TAU_MS);
    return this.smoothed + alpha * (raw - this.smoothed);
  }
}

export class PostureJudge {
  private readonly trackers: Record<Issue, IssueTracker>;

  constructor(
    private readonly baseline: Baseline,
    rules: Record<Issue, IssueRule>,
  ) {
    this.trackers = {
      tooClose: new IssueTracker(rules.tooClose),
      headDown: new IssueTracker(rules.headDown),
      slouch: new IssueTracker(rules.slouch),
    };
  }

  update(metrics: FrameMetrics | null, now: number): Verdict {
    const deviations = this.deviations(metrics);
    const issues: Record<Issue, IssueState> = {
      tooClose: this.trackers.tooClose.update(deviations.tooClose, now),
      headDown: this.trackers.headDown.update(deviations.headDown, now),
      slouch: this.trackers.slouch.update(deviations.slouch, now),
    };

    let severity = 0;
    for (const state of Object.values(issues)) {
      if (!state.active || state.activeSince === null) continue;
      const ramp = Math.min(1, (now - state.activeSince) / SEVERITY_RAMP_MS);
      severity = Math.max(severity, 0.35 + 0.65 * ramp);
    }

    return { issues, alarm: severity > 0, severity };
  }

  /** Signed deviations from baseline; positive means "worse". See config.ts for units. */
  private deviations(metrics: FrameMetrics | null): Record<Issue, number | null> {
    if (!metrics) return { tooClose: null, headDown: null, slouch: null };
    const { baseline } = this;
    const slouch =
      baseline.torsoRatio !== null && metrics.torsoRatio !== null ? 1 - metrics.torsoRatio / baseline.torsoRatio : null;
    return {
      tooClose: metrics.ipd / baseline.ipd - 1,
      headDown: metrics.pitch - baseline.pitch,
      slouch,
    };
  }
}
