import { CALIBRATION_MIN_SAMPLES, STORAGE_KEY_BASELINE } from './config';
import type { Baseline, FrameMetrics, ShoulderMetrics } from './types';

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (upper === undefined) return Number.NaN;
  return sorted.length % 2 === 0 && lower !== undefined ? (lower + upper) / 2 : upper;
}

/** Collects metrics for a fixed window while the user sits upright, then reduces them to a baseline. */
export class Calibrator {
  private readonly samples: FrameMetrics[] = [];

  constructor(
    private readonly startedAt: number,
    private readonly durationMs: number,
  ) {}

  add(metrics: FrameMetrics | null): void {
    if (metrics) this.samples.push(metrics);
  }

  progress(now: number): number {
    return Math.min(1, (now - this.startedAt) / this.durationMs);
  }

  isDone(now: number): boolean {
    return now - this.startedAt >= this.durationMs;
  }

  /** Median is used so a blink or a brief head turn does not skew the baseline. */
  finish(): Baseline | null {
    if (this.samples.length < CALIBRATION_MIN_SAMPLES) return null;
    const allShoulders = this.samples.flatMap((s) => (s.shoulders ? [s.shoulders] : []));
    // Only trust the shoulder signals if they were visible for most of the window, and keep the
    // head reference (ears or nose) that the majority of samples used.
    const earCount = allShoulders.filter((s) => s.usesEars).length;
    const usesEars = earCount >= allShoulders.length / 2;
    const withShoulders = allShoulders.filter((s) => s.usesEars === usesEars);
    const shoulders: ShoulderMetrics | null =
      withShoulders.length >= this.samples.length / 2
        ? {
            width: median(withShoulders.map((s) => s.width)),
            tilt: median(withShoulders.map((s) => s.tilt)),
            midY: median(withShoulders.map((s) => s.midY)),
            torsoRatio: median(withShoulders.map((s) => s.torsoRatio)),
            headY: median(withShoulders.map((s) => s.headY)),
            usesEars,
            lateral: median(withShoulders.map((s) => s.lateral)),
            headForward: median(withShoulders.map((s) => s.headForward)),
          }
        : null;
    return {
      ipd: median(this.samples.map((s) => s.ipd)),
      pitch: median(this.samples.map((s) => s.pitch)),
      roll: median(this.samples.map((s) => s.roll)),
      noseY: median(this.samples.map((s) => s.noseY)),
      faceHeight: median(this.samples.map((s) => s.faceHeight)),
      shoulders,
      createdAt: Date.now(),
    };
  }
}

export function saveBaseline(baseline: Baseline): void {
  try {
    localStorage.setItem(STORAGE_KEY_BASELINE, JSON.stringify(baseline));
  } catch {
    // Storage may be unavailable (private mode); the session still works without persistence.
  }
}

export function loadBaseline(): Baseline | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BASELINE);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isBaseline(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isShoulderMetrics(value: unknown): value is ShoulderMetrics {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    isNum(v.width) &&
    isNum(v.tilt) &&
    isNum(v.midY) &&
    isNum(v.torsoRatio) &&
    isNum(v.headY) &&
    typeof v.usesEars === 'boolean' &&
    isNum(v.lateral) &&
    isNum(v.headForward)
  );
}

function isBaseline(value: unknown): value is Baseline {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    isNum(v.ipd) &&
    isNum(v.pitch) &&
    isNum(v.roll) &&
    isNum(v.noseY) &&
    isNum(v.faceHeight) &&
    (v.shoulders === null || isShoulderMetrics(v.shoulders)) &&
    isNum(v.createdAt)
  );
}
