import './style.css';
import { Alerter } from './alerts';
import { Calibrator, loadBaseline, saveBaseline } from './calibration';
import { openCamera, requestWakeLock } from './camera';
import { CALIBRATION_MS, RULES, TICK_MS } from './config';
import { applyStaticStrings, getLocale, setLocale, t } from './i18n';
import { PostureJudge } from './judge';
import { Landmarkers } from './landmarkers';
import { computeMetrics } from './metrics';
import { Overlay } from './overlay';
import { isPipSupported, openPip } from './pip';
import { loadSensitivity, loadSoundEnabled, saveSensitivity, saveSoundEnabled } from './storage';
import { initTheme } from './theme';
import type { Baseline, Sensitivity, Verdict } from './types';
import {
  appendLog,
  buildGauges,
  buildMetricsTable,
  describeVerdict,
  getElements,
  readSensitivity,
  renderGauges,
  renderMetrics,
  setVerdict,
  writeSensitivity,
} from './ui';

const els = getElements();
const alerter = new Alerter(els.alarmOverlay);
const overlay = new Overlay(els.canvas);

let landmarkers: Landmarkers | null = null;
let judge: PostureJudge | null = null;
let calibrator: Calibrator | null = null;
let baseline: Baseline | null = loadBaseline();
let sensitivity: Sensitivity = loadSensitivity();
let lastVerdictAlarm = false;
let lastTimestamp = 0;
let frameCount = 0;
let fpsWindowStart = performance.now();

/** Everything with translatable text that is rendered from JS rather than the HTML. */
function applyLocale(): void {
  applyStaticStrings();
  els.language.value = getLocale();
  buildGauges(els.issues);
  buildMetricsTable(els.metrics);
  if (!landmarkers) {
    setVerdict(els, 'idle', t('statusIdle'));
    els.fps.textContent = t('fpsWaiting');
  }
}

initTheme(els.theme);
applyLocale();
writeSensitivity(els.sensitivity, sensitivity);
els.sound.checked = loadSoundEnabled();
alerter.soundEnabled = els.sound.checked;
if (baseline) judge = new PostureJudge(baseline, RULES, sensitivity);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function start(): Promise<void> {
  els.start.disabled = true;
  try {
    // Both must happen inside the click handler to count as a user gesture.
    alerter.enableAudio();
    void alerter.requestNotificationPermission();

    setVerdict(els, 'busy', t('openingCamera'));
    const stream = await openCamera();
    els.video.srcObject = stream;
    await els.video.play();
    els.stageHint.hidden = true;
    overlay.resize(els.video.videoWidth, els.video.videoHeight);

    landmarkers = await Landmarkers.load((delegate) => setVerdict(els, 'busy', t('loadingModel', { delegate })));
    appendLog(els.log, t('modelLoaded', { delegate: landmarkers.delegate }));
    await requestWakeLock();

    window.setInterval(tick, TICK_MS);
    els.calibrate.disabled = false;
    els.pip.disabled = !isPipSupported();
    setVerdict(els, judge ? 'ok' : 'busy', judge ? t('runningPrevious') : t('runningCalibrate'));
  } catch (error) {
    setVerdict(els, 'bad', t('startFailed', { error: errorMessage(error) }));
    els.start.disabled = false;
  }
}

function tick(): void {
  if (!landmarkers || els.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

  // MediaPipe requires strictly increasing timestamps.
  let now = performance.now();
  if (now <= lastTimestamp) now = lastTimestamp + 1;
  lastTimestamp = now;

  const raw = landmarkers.detect(els.video, now);
  const metrics = computeMetrics(raw, els.video.videoWidth, els.video.videoHeight);
  trackFps(now);

  if (calibrator) {
    calibrator.add(metrics);
    setVerdict(els, 'busy', t('calibrating', { pct: Math.round(calibrator.progress(now) * 100) }));
    overlay.draw(metrics, null);
    if (calibrator.isDone(now)) finishCalibration(calibrator);
    return;
  }

  const verdict: Verdict | null = judge ? judge.update(metrics, now) : null;
  overlay.draw(metrics, verdict);
  renderGauges(els.issues, verdict);
  renderMetrics(els.metrics, metrics, baseline, verdict);

  if (!verdict) return;
  const message = describeVerdict(verdict);
  alerter.apply(verdict, message, now);

  if (verdict.alarm !== lastVerdictAlarm) {
    appendLog(els.log, verdict.alarm ? t('alarmLog', { message }) : t('recoveredLog'));
    lastVerdictAlarm = verdict.alarm;
  }
  if (!metrics) setVerdict(els, 'idle', t('noFace'));
  else if (verdict.alarm) setVerdict(els, 'bad', t('adjust', { message }));
  else setVerdict(els, 'ok', t('postureGood'));
}

function finishCalibration(current: Calibrator): void {
  calibrator = null;
  const result = current.finish();
  if (!result) {
    setVerdict(els, 'bad', t('calibrationFailed'));
    appendLog(els.log, t('calibrationFailedLog'));
    return;
  }
  baseline = result;
  saveBaseline(result);
  judge = new PostureJudge(result, RULES, sensitivity);
  lastVerdictAlarm = false;
  setVerdict(els, 'ok', t('calibrationDone'));
  const shoulders = result.shoulders
    ? t('calibrationShoulders', { torso: result.shoulders.torsoRatio.toFixed(2), tilt: result.shoulders.tilt.toFixed(1) })
    : t('calibrationNoShoulders');
  appendLog(
    els.log,
    t('calibrationLog', {
      ipd: result.ipd.toFixed(1),
      pitch: result.pitch.toFixed(1),
      roll: result.roll.toFixed(1),
      shoulders,
    }),
  );
}

function trackFps(now: number): void {
  frameCount += 1;
  if (now - fpsWindowStart >= 1000) {
    const fps = (frameCount * 1000) / (now - fpsWindowStart);
    const mode = document.hidden ? t('fpsBackground') : (landmarkers?.delegate ?? '');
    els.fps.textContent = `${fps.toFixed(1).padStart(4, ' ')} fps · ${mode}`;
    frameCount = 0;
    fpsWindowStart = now;
  }
}

els.start.addEventListener('click', () => void start());

els.calibrate.addEventListener('click', () => {
  calibrator = new Calibrator(performance.now(), CALIBRATION_MS);
  appendLog(els.log, t('calibrationStarted'));
});

els.pip.addEventListener('click', () => {
  els.pip.disabled = true;
  openPip(els.panel, () => {
    els.pip.disabled = false;
  }).catch((error: unknown) => {
    appendLog(els.log, t('pipFailed', { error: errorMessage(error) }));
    els.pip.disabled = false;
  });
});

els.sensitivity.addEventListener('change', () => {
  const value = readSensitivity(els.sensitivity);
  if (!value) return;
  sensitivity = value;
  saveSensitivity(value);
  judge?.setSensitivity(value);
  const level = { low: t('sensitivityLow'), normal: t('sensitivityNormal'), high: t('sensitivityHigh') }[value];
  appendLog(els.log, t('sensitivityLog', { level }));
});

els.language.addEventListener('change', () => {
  const value = els.language.value;
  if (value !== 'en' && value !== 'zh') return;
  setLocale(value);
  applyLocale();
});

els.sound.addEventListener('change', () => {
  alerter.soundEnabled = els.sound.checked;
  saveSoundEnabled(els.sound.checked);
});

document.addEventListener('visibilitychange', () => {
  appendLog(els.log, document.hidden ? t('wentBackground') : t('cameForeground'));
  if (!document.hidden) void requestWakeLock();
});
