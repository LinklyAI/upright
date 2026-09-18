import { ISSUE_LABELS } from './config';
import type { Baseline, FrameMetrics, Issue, Verdict } from './types';

export interface Elements {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  panel: HTMLElement;
  status: HTMLElement;
  issues: HTMLElement;
  metrics: HTMLElement;
  fps: HTMLElement;
  start: HTMLButtonElement;
  calibrate: HTMLButtonElement;
  pip: HTMLButtonElement;
  sound: HTMLInputElement;
  log: HTMLElement;
  alarmOverlay: HTMLElement;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

export function getElements(): Elements {
  return {
    video: byId('video'),
    canvas: byId('overlay'),
    panel: byId('panel'),
    status: byId('status'),
    issues: byId('issues'),
    metrics: byId('metrics'),
    fps: byId('fps'),
    start: byId('start'),
    calibrate: byId('calibrate'),
    pip: byId('pip'),
    sound: byId('sound'),
    log: byId('log'),
    alarmOverlay: byId('alarm-overlay'),
  };
}

const ISSUE_ORDER: Issue[] = ['tooClose', 'headDown', 'slouch'];

export function describeVerdict(verdict: Verdict): string {
  const active = ISSUE_ORDER.filter((issue) => verdict.issues[issue].active).map((issue) => ISSUE_LABELS[issue]);
  return active.join('、');
}

export function renderIssues(el: HTMLElement, verdict: Verdict | null): void {
  el.replaceChildren(
    ...ISSUE_ORDER.map((issue) => {
      const chip = document.createElement('span');
      const state = verdict?.issues[issue];
      chip.className = 'chip';
      if (!state || state.value === null) chip.classList.add('chip--unknown');
      else if (state.active) chip.classList.add('chip--active');
      chip.textContent = ISSUE_LABELS[issue];
      return chip;
    }),
  );
}

const fmt = (value: number | null | undefined, digits: number): string =>
  value === null || value === undefined || Number.isNaN(value) ? '—' : value.toFixed(digits);

export function renderMetrics(
  el: HTMLElement,
  metrics: FrameMetrics | null,
  baseline: Baseline | null,
  verdict: Verdict | null,
): void {
  const rows: Array<[string, string, string, string]> = [
    [
      '瞳距 (px)',
      fmt(metrics?.ipd, 1),
      fmt(baseline?.ipd, 1),
      verdict ? `${fmt((verdict.issues.tooClose.value ?? 0) * 100, 0)}%` : '—',
    ],
    ['头部俯仰 (°)', fmt(metrics?.pitch, 1), fmt(baseline?.pitch, 1), verdict ? `${fmt(verdict.issues.headDown.value, 1)}°` : '—'],
    [
      '鼻肩高度比',
      fmt(metrics?.torsoRatio, 2),
      fmt(baseline?.torsoRatio, 2),
      verdict && verdict.issues.slouch.value !== null ? `${fmt(verdict.issues.slouch.value * 100, 0)}%` : '—',
    ],
  ];
  el.replaceChildren(
    ...rows.map(([name, current, base, deviation]) => {
      const tr = document.createElement('tr');
      for (const text of [name, current, base, deviation]) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.append(td);
      }
      return tr;
    }),
  );
}

export function appendLog(el: HTMLElement, message: string): void {
  const time = new Date().toLocaleTimeString();
  el.textContent = `${time}  ${message}\n${el.textContent ?? ''}`.split('\n').slice(0, 50).join('\n');
}
