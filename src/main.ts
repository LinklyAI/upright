import './style.css';
import { Alerter } from './alerts';
import { Calibrator, loadBaseline, saveBaseline } from './calibration';
import { openCamera, requestWakeLock } from './camera';
import { BLINK_MIN_FPS, CALIBRATION_MS, RULES, TICK_MS } from './config';
import { applyStaticStrings, getLocale, setLocale, t } from './i18n';
import { PostureJudge } from './judge';
import { Landmarkers } from './landmarkers';
import { computeMetrics } from './metrics';
import { Overlay } from './overlay';
import { isPipSupported, openPip } from './pip';
import {
  loadMutedIssues,
  loadSensitivity,
  loadSoundEnabled,
  saveMutedIssues,
  saveSensitivity,
  saveSoundEnabled,
} from './storage';
import { initTheme } from './theme';
import type { Baseline, Issue, Sensitivity, Verdict } from './types';
import {
  appendLog,
  breakSecondsLeft,
  buildGauges,
  buildMetricsTable,
  describeVerdict,
  getElements,
  ISSUE_ORDER,
  issueLabel,
  readSensitivity,
  readSoundEnabled,
  renderGauges,
  renderMetrics,
  setVerdict,
  writeSensitivity,
  writeSoundEnabled,
} from './ui';

const els = getElements();
const alerter = new Alerter([els.alarmOverlay, els.pipWash]);
const overlay = new Overlay(els.canvas);

let landmarkers: Landmarkers | null = null;
let judge: PostureJudge | null = null;
let calibrator: Calibrator | null = null;
let baseline: Baseline | null = loadBaseline();
let sensitivity: Sensitivity = loadSensitivity();
const muted: Set<Issue> = loadMutedIssues();
let stream: MediaStream | null = null;
let timer: number | null = null;
let lastVerdictAlarm = false;
let lastVerdictBreak = false;
let lastTimestamp = 0;
let frameCount = 0;
let fpsWindowStart = performance.now();
let currentFps = 0;

const running = (): boolean => timer !== null;

/** The primary button is Start before the first run, then toggles between Pause and Resume. */
function updateStartButton(): void {
  els.start.dataset.i18n = running() ? 'btnPause' : landmarkers ? 'btnResume' : 'btnStart';
  els.start.textContent = t(els.start.dataset.i18n as 'btnPause' | 'btnResume' | 'btnStart');
}

/** Everything with translatable text that is rendered from JS rather than the HTML. */
function applyLocale(): void {
  applyStaticStrings();
  els.language.value = getLocale();
  buildGauges(els.issues);
  renderGauges(els.issues, null, muted);
  buildMetricsTable(els.metrics);
  updateStartButton();
  if (!landmarkers) {
    setVerdict(els, 'idle', t('statusIdle'));
    els.fps.textContent = t('fpsWaiting');
  } else if (!running()) {
    setVerdict(els, 'idle', t('paused'));
  }
}

/** Mutes or unmutes one check and keeps every control that shows it in sync. */
function setMuted(issue: Issue, isMuted: boolean): void {
  if (isMuted) muted.add(issue);
  else muted.delete(issue);
  saveMutedIssues(muted);
  judge?.setMuted(muted);
  renderGauges(els.issues, null, muted);
  els.issueSwitches[issue].checked = !isMuted;
  appendLog(els.log, t(isMuted ? 'checkMutedLog' : 'checkUnmutedLog', { name: issueLabel(issue) }));
}

initTheme(els.theme);
applyLocale();
writeSensitivity(els.sensitivity, sensitivity);
alerter.soundEnabled = loadSoundEnabled();
writeSoundEnabled(els.sound, alerter.soundEnabled);
for (const issue of ISSUE_ORDER) els.issueSwitches[issue].checked = !muted.has(issue);
if (baseline) judge = createJudge(baseline);

function createJudge(base: Baseline): PostureJudge {
  const created = new PostureJudge(base, RULES, sensitivity);
  created.setMuted(muted);
  return created;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** First run: open the camera, load the models, start the loop. Later runs only reopen the camera. */
async function start(): Promise<void> {
  els.start.disabled = true;
  try {
    // Both must happen inside the click handler to count as a user gesture.
    alerter.enableAudio();
    void alerter.requestNotificationPermission();

    setVerdict(els, 'busy', t('openingCamera'));
    stream = await openCamera();
    els.video.srcObject = stream;
    await els.video.play();
    els.stageHint.hidden = true;
    overlay.resize(els.video.videoWidth, els.video.videoHeight);

    const firstRun = landmarkers === null;
    if (firstRun) {
      landmarkers = await Landmarkers.load((delegate) => setVerdict(els, 'busy', t('loadingModel', { delegate })));
      appendLog(els.log, t('modelLoaded', { delegate: landmarkers.delegate }));
    } else {
      // Dwell timers must not count the pause as elapsed time.
      if (baseline) judge = createJudge(baseline);
      appendLog(els.log, t('resumedLog'));
    }
    await requestWakeLock();

    timer = window.setInterval(tick, TICK_MS);
    els.calibrate.disabled = false;
    els.pip.disabled = !isPipSupported();
    setVerdict(els, judge ? 'ok' : 'busy', judge ? t('runningPrevious') : t('runningCalibrate'));
  } catch (error) {
    setVerdict(els, 'bad', t('startFailed', { error: errorMessage(error) }));
  } finally {
    els.start.disabled = false;
    updateStartButton();
  }
}

/** Stops detection and releases the camera; models stay loaded for a quick resume. */
function pause(): void {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  calibrator = null;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  els.video.srcObject = null;
  els.stageHint.hidden = false;
  els.stageAlert.hidden = true;
  els.calibrate.disabled = true;
  overlay.draw(null, null);
  alerter.reset();
  lastVerdictAlarm = false;
  lastVerdictBreak = false;
  els.stageAlert.classList.remove('stage__alert--break');
  renderGauges(els.issues, null, muted);
  setVerdict(els, 'idle', t('paused'));
  els.fps.textContent = t('fpsWaiting');
  appendLog(els.log, t('pausedLog'));
  updateStartButton();
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
  // Blinks last ~150 ms; at throttled frame rates they are missed, which would read as staring.
  // Go by the measured rate, not document.hidden: a hidden tab with the floating window open
  // still runs at full speed, and blink detection should keep working there.
  if (metrics && currentFps < BLINK_MIN_FPS) metrics.eyeClosed = null;

  if (calibrator) {
    calibrator.add(metrics);
    setVerdict(els, 'busy', t('calibrating', { pct: Math.round(calibrator.progress(now) * 100) }));
    overlay.draw(metrics, null);
    if (calibrator.isDone(now)) finishCalibration(calibrator);
    return;
  }

  const verdict: Verdict | null = judge ? judge.update(metrics, now) : null;
  overlay.draw(metrics, verdict);
  renderGauges(els.issues, verdict, muted);
  renderMetrics(els.metrics, metrics, baseline, verdict);

  if (!verdict) return;
  const inBreak = verdict.breakLeftMs !== null;
  const message = inBreak ? t('lookAwayBreak', { seconds: breakSecondsLeft(verdict) }) : describeVerdict(verdict);
  alerter.apply(verdict, message, now);
  // Banner over the camera so the active check (or the break countdown) can be read at a glance.
  els.stageAlert.hidden = !verdict.alarm && !inBreak;
  els.stageAlert.classList.toggle('stage__alert--break', inBreak);
  if (!els.stageAlert.hidden && els.stageAlert.textContent !== message) els.stageAlert.textContent = message;

  if (verdict.alarm !== lastVerdictAlarm) {
    appendLog(els.log, verdict.alarm ? t('alarmLog', { message }) : t('recoveredLog'));
    lastVerdictAlarm = verdict.alarm;
  }
  if (inBreak !== lastVerdictBreak) {
    appendLog(els.log, inBreak ? t('lookAwayBreakStartedLog') : t('lookAwayBreakEndedLog'));
    lastVerdictBreak = inBreak;
  }
  if (inBreak) setVerdict(els, 'ok', message);
  else if (!metrics) setVerdict(els, 'idle', t('noFace'));
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
  judge = createJudge(result);
  lastVerdictAlarm = false;
  lastVerdictBreak = false;
  setVerdict(els, 'ok', t('calibrationDone'));
  const shoulders = result.shoulders
    ? t('calibrationShoulders', {
        torso: result.shoulders.torsoRatio.toFixed(2),
        tilt: result.shoulders.tilt.toFixed(1),
      })
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
    currentFps = fps;
    const mode = document.hidden ? t('fpsBackground') : (landmarkers?.delegate ?? '');
    els.fps.textContent = `${fps.toFixed(1).padStart(4, ' ')} fps · ${mode}`;
    frameCount = 0;
    fpsWindowStart = now;
  }
}

els.start.addEventListener('click', () => {
  if (running()) pause();
  else void start();
});

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
  const level = {
    low: t('sensitivityLow'),
    normal: t('sensitivityNormal'),
    high: t('sensitivityHigh'),
  }[value];
  appendLog(els.log, t('sensitivityLog', { level }));
});

els.language.addEventListener('change', () => {
  const value = els.language.value;
  if (value !== 'en' && value !== 'zh') return;
  setLocale(value);
  applyLocale();
});

els.sound.addEventListener('change', () => {
  alerter.soundEnabled = readSoundEnabled(els.sound);
  saveSoundEnabled(alerter.soundEnabled);
});

for (const issue of ISSUE_ORDER) {
  const input = els.issueSwitches[issue];
  input.addEventListener('change', () => setMuted(issue, !input.checked));
}

document.addEventListener('visibilitychange', () => {
  appendLog(els.log, document.hidden ? t('wentBackground') : t('cameForeground'));
  if (!document.hidden) void requestWakeLock();
});
