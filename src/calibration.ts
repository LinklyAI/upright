import { CALIBRATION_MIN_SAMPLES, STORAGE_KEY } from './config';
import type { Baseline, FrameMetrics } from './types';

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
    const torsoSamples = this.samples.flatMap((s) => (s.torsoRatio === null ? [] : [s.torsoRatio]));
    // Only trust the shoulder signal if it was visible for most of the window.
    const torsoRatio = torsoSamples.length >= this.samples.length / 2 ? median(torsoSamples) : null;
    return {
      ipd: median(this.samples.map((s) => s.ipd)),
      pitch: median(this.samples.map((s) => s.pitch)),
      torsoRatio,
      createdAt: Date.now(),
    };
  }
}

export function saveBaseline(baseline: Baseline): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(baseline));
  } catch {
    // Storage may be unavailable (private mode); the session still works without persistence.
  }
}

export function loadBaseline(): Baseline | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isBaseline(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isBaseline(value: unknown): value is Baseline {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.ipd === 'number' &&
    typeof v.pitch === 'number' &&
    (typeof v.torsoRatio === 'number' || v.torsoRatio === null) &&
    typeof v.createdAt === 'number'
  );
}
