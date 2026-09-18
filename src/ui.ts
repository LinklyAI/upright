import { ISSUE_LABELS } from './config';
import type { Baseline, FrameMetrics, Issue, IssueState, Verdict } from './types';

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
  sensitivity: HTMLSelectElement;
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
    sensitivity: byId('sensitivity'),
    sound: byId('sound'),
    log: byId('log'),
    alarmOverlay: byId('alarm-overlay'),
  };
}

const ISSUE_ORDER: Issue[] = ['tooClose', 'headDown', 'headTilt', 'headForward', 'slouch', 'sideLean', 'sitting'];

export function describeVerdict(verdict: Verdict): string {
  const active = ISSUE_ORDER.filter((issue) => verdict.issues[issue].active).map((issue) =>
    issue === 'sitting' ? '久坐，起来活动一下' : ISSUE_LABELS[issue],
  );
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

/** Formats a tracker's smoothed deviation with the unit that issue uses. */
function deviation(state: IssueState | undefined, unit: '%' | '°' | '×' | 'min'): string {
  if (!state || state.value === null) return '—';
  switch (unit) {
    case '%':
      return `${fmt(state.value * 100, 0)}%`;
    case '°':
      return `${fmt(state.value, 1)}°`;
    case '×':
      return `${fmt(state.value, 2)}×`;
    case 'min':
      return `${fmt(state.value, 0)} min`;
  }
}

export function renderMetrics(
  el: HTMLElement,
  metrics: FrameMetrics | null,
  baseline: Baseline | null,
  verdict: Verdict | null,
): void {
  const s = metrics?.shoulders;
  const bs = baseline?.shoulders;
  const v = verdict?.issues;
  const rows: Array<[string, string, string, string]> = [
    ['瞳距 (px)', fmt(metrics?.ipd, 1), fmt(baseline?.ipd, 1), deviation(v?.tooClose, '%')],
    ['头部俯仰 (°)', fmt(metrics?.pitch, 1), fmt(baseline?.pitch, 1), deviation(v?.headDown, '°')],
    ['头部侧倾 (°)', fmt(metrics?.roll, 1), fmt(baseline?.roll, 1), deviation(v?.headTilt, '°')],
    ['脸肩比', fmt(s?.headForward, 3), fmt(bs?.headForward, 3), deviation(v?.headForward, '%')],
    ['鼻肩高度比', fmt(s?.torsoRatio, 2), fmt(bs?.torsoRatio, 2), deviation(v?.slouch, '×')],
    ['鼻子高度 (px)', fmt(metrics?.noseY, 0), fmt(baseline?.noseY, 0), s ? '—' : deviation(v?.slouch, '×')],
    ['肩线倾斜 (°)', fmt(s?.tilt, 1), fmt(bs?.tilt, 1), deviation(v?.sideLean, '×')],
    ['横向偏移', fmt(s?.lateral, 2), fmt(bs?.lateral, 2), '—'],
    ['连续就座', deviation(v?.sitting, 'min'), '—', '—'],
  ];
  el.replaceChildren(
    ...rows.map(([name, current, base, dev]) => {
      const tr = document.createElement('tr');
      for (const text of [name, current, base, dev]) {
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
  el.textContent = `${time}  ${message}\n${el.textContent ?? ''}`.split('\n').slice(0, 80).join('\n');
}
