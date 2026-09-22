import { LOOK_AWAY_BREAK_MS } from './config';
import { getLocale, t, type Key } from './i18n';
import type { Baseline, FrameMetrics, Issue, IssueState, Sensitivity, Verdict } from './types';

export interface Elements {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  stageHint: HTMLElement;
  stageAlert: HTMLElement;
  panel: HTMLElement;
  verdictDot: HTMLElement;
  status: HTMLElement;
  issues: HTMLElement;
  metrics: HTMLElement;
  fps: HTMLElement;
  start: HTMLButtonElement;
  calibrate: HTMLButtonElement;
  pip: HTMLButtonElement;
  sensitivity: HTMLFieldSetElement;
  sound: HTMLFieldSetElement;
  /** One toolbar switch per check, keyed by issue; unchecked = muted. */
  issueSwitches: Record<Issue, HTMLInputElement>;
  theme: HTMLButtonElement;
  language: HTMLSelectElement;
  log: HTMLElement;
  alarmOverlay: HTMLElement;
  /** Second alarm wash inside the panel, shown only while the panel is in the floating window. */
  pipWash: HTMLElement;
}

/** Display order of the checks, shared by the gauges and the toolbar switches. */
export const ISSUE_ORDER: readonly Issue[] = [
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

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

/** Finds the `<input data-issue>` switch for every check; the HTML must declare all of them. */
function issueSwitches(): Record<Issue, HTMLInputElement> {
  const switches = {} as Record<Issue, HTMLInputElement>;
  for (const issue of ISSUE_ORDER) {
    const el = document.querySelector<HTMLInputElement>(`input[data-issue="${issue}"]`);
    if (!el) throw new Error(`Missing switch for check "${issue}"`);
    switches[issue] = el;
  }
  return switches;
}

export function getElements(): Elements {
  return {
    video: byId('video'),
    canvas: byId('overlay'),
    stageHint: byId('stage-hint'),
    stageAlert: byId('stage-alert'),
    panel: byId('panel'),
    verdictDot: byId('verdict-dot'),
    status: byId('status'),
    issues: byId('issues'),
    metrics: byId('metrics'),
    fps: byId('fps'),
    start: byId('start'),
    calibrate: byId('calibrate'),
    pip: byId('pip'),
    sensitivity: byId('sensitivity'),
    sound: byId('sound'),
    issueSwitches: issueSwitches(),
    theme: byId('theme'),
    language: byId('language'),
    log: byId('log'),
    alarmOverlay: byId('alarm-overlay'),
    pipWash: byId('pip-wash'),
  };
}

export type VerdictTone = 'idle' | 'busy' | 'ok' | 'bad';

export function setVerdict(els: Elements, tone: VerdictTone, title: string): void {
  els.status.textContent = title;
  els.verdictDot.className = `verdict__dot verdict__dot--${tone}`;
}

// ---------- segmented radios: sensitivity and sound ----------

function readSegmented(fieldset: HTMLFieldSetElement): string | undefined {
  return fieldset.querySelector<HTMLInputElement>('input:checked')?.value;
}

function writeSegmented(fieldset: HTMLFieldSetElement, value: string): void {
  const input = fieldset.querySelector<HTMLInputElement>(`input[value="${value}"]`);
  if (input) input.checked = true;
}

const SENSITIVITIES: readonly Sensitivity[] = ['low', 'normal', 'high'];

export function readSensitivity(fieldset: HTMLFieldSetElement): Sensitivity | null {
  const value = readSegmented(fieldset);
  return SENSITIVITIES.find((s) => s === value) ?? null;
}

export function writeSensitivity(fieldset: HTMLFieldSetElement, value: Sensitivity): void {
  writeSegmented(fieldset, value);
}

export function readSoundEnabled(fieldset: HTMLFieldSetElement): boolean {
  return readSegmented(fieldset) !== 'off';
}

export function writeSoundEnabled(fieldset: HTMLFieldSetElement, enabled: boolean): void {
  writeSegmented(fieldset, enabled ? 'on' : 'off');
}

// ---------- gauges: one per issue, built once, updated in place ----------

type Unit = '%' | '°' | '×' | 's' | 'min';

const ISSUE_LABEL_KEYS: Record<Issue, Key> = {
  tooClose: 'issueTooClose',
  headDown: 'issueHeadDown',
  headTilt: 'issueHeadTilt',
  headForward: 'issueHeadForward',
  slouch: 'issueSlouch',
  shrug: 'issueShrug',
  sideLean: 'issueSideLean',
  blink: 'issueBlink',
  sitting: 'issueSitting',
  lookAway: 'issueLookAway',
};

const ISSUE_UNITS: Record<Issue, Unit> = {
  tooClose: '%',
  headDown: '°',
  headTilt: '°',
  headForward: '%',
  slouch: '×',
  shrug: '%',
  sideLean: '×',
  blink: 's',
  sitting: 'min',
  lookAway: 'min',
};

interface GaugeRefs {
  root: HTMLElement;
  value: HTMLElement;
  ringValue: HTMLElement;
}

/** Fixed-width number formatting so values change without the layout shifting. */
const fmt = (value: number | null | undefined, digits: number, width = 0): string => {
  const text = value === null || value === undefined || Number.isNaN(value) ? '—' : value.toFixed(digits);
  return text.padStart(width, ' ');
};

function formatDeviation(state: IssueState | undefined, unit: Unit): string {
  if (!state || state.value === null) return '—';
  const v = state.value;
  switch (unit) {
    case '%':
      return `${fmt(v * 100, 0, 4)}%`;
    case '°':
      return `${fmt(v, 1, 5)}°`;
    case '×':
      return `${fmt(v, 2, 5)}×`;
    case 's':
      return `${fmt(v, 0, 3)} s`;
    case 'min':
      return `${fmt(v, 0, 3)} min`;
  }
}

/** Reading shown on the gauge: "deviation / threshold" so the user sees how far from firing it is. */
function formatGauge(state: IssueState | undefined, unit: Unit): string {
  if (!state || state.value === null) return '—';
  const digits = unit === '%' ? 0 : unit === '°' ? 1 : unit === '×' ? 2 : 0;
  const scale = unit === '%' ? 100 : 1;
  const suffix = unit === 'min' || unit === 's' ? ` ${unit}` : unit;
  return `${fmt(Math.max(0, state.value) * scale, digits)} / ${fmt(state.threshold * scale, digits)}${suffix}`;
}

/**
 * Gauges only display; muting is done with the toolbar switches and shown here as a muted gauge.
 * Each gauge carries both a bar (main page) and a ring (PiP window); CSS shows one of them and
 * both read the fill level from the `--ratio` custom property set in renderGauges.
 */
export function buildGauges(container: HTMLElement): void {
  container.replaceChildren(
    ...ISSUE_ORDER.map((issue) => {
      const root = document.createElement('div');
      root.className = 'gauge gauge--unknown';
      root.dataset.issue = issue;
      root.innerHTML =
        '<div class="gauge__head"><span class="gauge__name"></span><span class="gauge__value">—</span></div>' +
        '<div class="gauge__bar"><div class="gauge__fill"></div></div>' +
        '<div class="gauge__ring">' +
        '<svg viewBox="0 0 44 44" aria-hidden="true" focusable="false">' +
        '<circle class="gauge__ring-track" cx="22" cy="22" r="19" />' +
        '<circle class="gauge__ring-fill" cx="22" cy="22" r="19" pathLength="100" />' +
        '</svg>' +
        '<span class="gauge__ring-value">—</span></div>';
      const name = root.querySelector<HTMLElement>('.gauge__name');
      if (name) name.textContent = t(ISSUE_LABEL_KEYS[issue]);
      return root;
    }),
  );
}

function gaugeRefs(container: HTMLElement): GaugeRefs[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.gauge')).flatMap((root) => {
    const value = root.querySelector<HTMLElement>('.gauge__value');
    const ringValue = root.querySelector<HTMLElement>('.gauge__ring-value');
    return value && ringValue ? [{ root, value, ringValue }] : [];
  });
}

/** How close the check is to firing, 0–1, or null while there is no reading. */
function gaugeRatio(state: IssueState | undefined): number | null {
  if (!state || state.value === null) return null;
  return Math.max(0, Math.min(1, state.value / state.threshold));
}

/** Whole seconds left in the break, rounded up so the countdown starts at 20 and ends at 0. */
export function breakSecondsLeft(verdict: Verdict): number {
  return Math.ceil((verdict.breakLeftMs ?? 0) / 1000);
}

export function renderGauges(container: HTMLElement, verdict: Verdict | null, muted: ReadonlySet<Issue>): void {
  for (const { root, value, ringValue } of gaugeRefs(container)) {
    const issue = root.dataset.issue as Issue | undefined;
    if (!issue) continue;
    root.classList.remove('gauge--unknown', 'gauge--warn', 'gauge--active', 'gauge--break');

    // During the break the look-away gauge counts down instead of showing screen time.
    if (issue === 'lookAway' && verdict && verdict.breakLeftMs !== null) {
      const seconds = breakSecondsLeft(verdict);
      value.textContent = `${fmt(seconds, 0, 3)} s`;
      ringValue.textContent = String(seconds);
      root.style.setProperty('--ratio', (verdict.breakLeftMs / LOOK_AWAY_BREAK_MS).toFixed(3));
      root.classList.add('gauge--break');
      continue;
    }

    const state = verdict?.issues[issue];
    const isMuted = muted.has(issue);
    const ratio = gaugeRatio(state);
    value.textContent = isMuted ? t('gaugeMuted') : formatGauge(state, ISSUE_UNITS[issue]);
    ringValue.textContent = isMuted ? t('gaugeMuted') : ratio === null ? '—' : String(Math.round(ratio * 100));
    root.style.setProperty('--ratio', (ratio ?? 0).toFixed(3));
    root.classList.toggle('gauge--muted', isMuted);

    if (ratio === null) root.classList.add('gauge--unknown');
    else if (!isMuted && state?.active) root.classList.add('gauge--active');
    else if (!isMuted && ratio >= 0.6) root.classList.add('gauge--warn');
  }
}

export function issueLabel(issue: Issue): string {
  return t(ISSUE_LABEL_KEYS[issue]);
}

export function describeVerdict(verdict: Verdict): string {
  const active = ISSUE_ORDER.filter((issue) => verdict.issues[issue].active).map((issue) =>
    issue === 'sitting'
      ? t('sittingMessage')
      : issue === 'blink'
        ? t('blinkMessage')
        : issue === 'lookAway'
          ? t('lookAwayMessage')
          : t(ISSUE_LABEL_KEYS[issue]),
  );
  return active.join(getLocale() === 'zh' ? '、' : ', ');
}

// ---------- raw metrics table: rows built once, cells updated in place ----------

const METRIC_ROW_KEYS: Key[] = [
  'metricIpd',
  'metricPitch',
  'metricRoll',
  'metricHeadForward',
  'metricTorso',
  'metricShoulderY',
  'metricNoseY',
  'metricShoulderTilt',
  'metricLateral',
  'metricBlink',
  'metricSeated',
  'metricScreenTime',
];

export function buildMetricsTable(tbody: HTMLElement): void {
  tbody.replaceChildren(
    ...METRIC_ROW_KEYS.map((key) => {
      const tr = document.createElement('tr');
      for (const text of [t(key), '—', '—', '—']) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.append(td);
      }
      return tr;
    }),
  );
}

export function renderMetrics(
  tbody: HTMLElement,
  metrics: FrameMetrics | null,
  baseline: Baseline | null,
  verdict: Verdict | null,
): void {
  const s = metrics?.shoulders;
  const bs = baseline?.shoulders;
  const v = verdict?.issues;
  const values: Array<[string, string, string]> = [
    [fmt(metrics?.ipd, 1, 6), fmt(baseline?.ipd, 1, 6), formatDeviation(v?.tooClose, '%')],
    [fmt(metrics?.pitch, 1, 6), fmt(baseline?.pitch, 1, 6), formatDeviation(v?.headDown, '°')],
    [fmt(metrics?.roll, 1, 6), fmt(baseline?.roll, 1, 6), formatDeviation(v?.headTilt, '°')],
    [fmt(s?.headForward, 3, 6), fmt(bs?.headForward, 3, 6), formatDeviation(v?.headForward, '%')],
    [fmt(s?.torsoRatio, 2, 6), fmt(bs?.torsoRatio, 2, 6), s ? formatDeviation(v?.slouch, '×') : '—'],
    [fmt(s?.midY, 0, 6), fmt(bs?.midY, 0, 6), formatDeviation(v?.shrug, '%')],
    [fmt(metrics?.noseY, 0, 6), fmt(baseline?.noseY, 0, 6), s ? '—' : formatDeviation(v?.slouch, '×')],
    [fmt(s?.tilt, 1, 6), fmt(bs?.tilt, 1, 6), formatDeviation(v?.sideLean, '×')],
    [fmt(s?.lateral, 2, 6), fmt(bs?.lateral, 2, 6), '—'],
    [fmt(metrics?.eyeClosed, 2, 6), '—', formatDeviation(v?.blink, 's')],
    [formatDeviation(v?.sitting, 'min'), '—', '—'],
    [formatDeviation(v?.lookAway, 'min'), '—', '—'],
  ];
  const rows = tbody.querySelectorAll('tr');
  values.forEach((cells, rowIndex) => {
    const row = rows[rowIndex];
    if (!row) return;
    cells.forEach((text, i) => {
      const td = row.cells[i + 1];
      if (td && td.textContent !== text) td.textContent = text;
    });
  });
}

export function appendLog(el: HTMLElement, message: string): void {
  const time = new Date().toLocaleTimeString(undefined, { hour12: false });
  el.textContent = `${time}  ${message}\n${el.textContent ?? ''}`.split('\n').slice(0, 80).join('\n');
}
