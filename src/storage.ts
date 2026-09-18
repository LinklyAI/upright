import type { Issue, Sensitivity } from './types';

/**
 * Small settings persisted in localStorage so a reload keeps the user's choices.
 * Storage may be unavailable (private mode); every accessor degrades to a default.
 */
const KEYS = {
  sensitivity: 'posture-guard.sensitivity.v1',
  sound: 'posture-guard.sound.v1',
  muted: 'posture-guard.muted.v1',
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Non-fatal.
  }
}

const SENSITIVITIES: readonly Sensitivity[] = ['low', 'normal', 'high'];

export function loadSensitivity(): Sensitivity {
  const raw = read(KEYS.sensitivity);
  return SENSITIVITIES.find((s) => s === raw) ?? 'normal';
}

export function saveSensitivity(value: Sensitivity): void {
  write(KEYS.sensitivity, value);
}

export function loadSoundEnabled(): boolean {
  return read(KEYS.sound) !== 'off';
}

export function saveSoundEnabled(enabled: boolean): void {
  write(KEYS.sound, enabled ? 'on' : 'off');
}

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

/** Checks the user switched off by clicking their gauge. */
export function loadMutedIssues(): Set<Issue> {
  const raw = read(KEYS.muted);
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(ISSUES.filter((issue) => parsed.includes(issue)));
  } catch {
    return new Set();
  }
}

export function saveMutedIssues(muted: ReadonlySet<Issue>): void {
  write(KEYS.muted, JSON.stringify([...muted]));
}
