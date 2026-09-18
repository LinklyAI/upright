import './style.css';
import { Alerter } from './alerts';
import { Calibrator, loadBaseline, loadSensitivity, saveBaseline, saveSensitivity } from './calibration';
import { openCamera, requestWakeLock } from './camera';
import { CALIBRATION_MS, RULES, TICK_MS } from './config';
import { PostureJudge } from './judge';
import { Landmarkers } from './landmarkers';
import { computeMetrics } from './metrics';
import { Overlay } from './overlay';
import { isPipSupported, openPip } from './pip';
import type { Baseline, Sensitivity, Verdict } from './types';
import { appendLog, describeVerdict, getElements, renderIssues, renderMetrics } from './ui';

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

els.sensitivity.value = sensitivity;
if (baseline) judge = new PostureJudge(baseline, RULES, sensitivity);

function setStatus(message: string): void {
  els.status.textContent = message;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function start(): Promise<void> {
  els.start.disabled = true;
  try {
    // Both must happen inside the click handler to count as a user gesture.
    alerter.enableAudio();
    void alerter.requestNotificationPermission();

    setStatus('正在打开摄像头…');
    const stream = await openCamera();
    els.video.srcObject = stream;
    await els.video.play();
    overlay.resize(els.video.videoWidth, els.video.videoHeight);

    landmarkers = await Landmarkers.load(setStatus);
    appendLog(els.log, `模型已加载（${landmarkers.delegate}）`);
    await requestWakeLock();

    window.setInterval(tick, TICK_MS);
    els.calibrate.disabled = false;
    els.pip.disabled = !isPipSupported();
    setStatus(judge ? '运行中（沿用上次校准，可重新校准）' : '运行中，请先校准');
  } catch (error) {
    setStatus(`启动失败：${errorMessage(error)}`);
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
    setStatus(`校准中，请保持端正坐姿… ${Math.round(calibrator.progress(now) * 100)}%`);
    overlay.draw(metrics, null);
    if (calibrator.isDone(now)) finishCalibration(calibrator);
    return;
  }

  const verdict: Verdict | null = judge ? judge.update(metrics, now) : null;
  overlay.draw(metrics, verdict);
  renderIssues(els.issues, verdict);
  renderMetrics(els.metrics, metrics, baseline, verdict);

  if (!verdict) return;
  const message = describeVerdict(verdict);
  alerter.apply(verdict, message, now);

  if (verdict.alarm !== lastVerdictAlarm) {
    appendLog(els.log, verdict.alarm ? `⚠ 警报：${message}` : '✓ 姿势已恢复');
    lastVerdictAlarm = verdict.alarm;
  }
  if (!metrics) setStatus('未检测到人脸');
  else setStatus(verdict.alarm ? `请调整：${message}` : '坐姿正常');
}

function finishCalibration(current: Calibrator): void {
  calibrator = null;
  const result = current.finish();
  if (!result) {
    setStatus('校准失败：没有稳定检测到人脸，请正对摄像头重试');
    appendLog(els.log, '校准失败');
    return;
  }
  baseline = result;
  saveBaseline(result);
  judge = new PostureJudge(result, RULES, sensitivity);
  lastVerdictAlarm = false;
  setStatus('校准完成');
  const shoulders = result.shoulders
    ? `鼻肩比 ${result.shoulders.torsoRatio.toFixed(2)}，肩线 ${result.shoulders.tilt.toFixed(1)}°`
    : '肩膀不在画面内（驼背改用鼻子高度，歪坐 / 头前伸不可用）';
  appendLog(
    els.log,
    `校准完成：瞳距 ${result.ipd.toFixed(1)}px，俯仰 ${result.pitch.toFixed(1)}°，侧倾 ${result.roll.toFixed(1)}°，${shoulders}`,
  );
}

function trackFps(now: number): void {
  frameCount += 1;
  if (now - fpsWindowStart >= 1000) {
    const fps = (frameCount * 1000) / (now - fpsWindowStart);
    els.fps.textContent = `${fps.toFixed(1)} fps${document.hidden ? '（后台）' : ''}`;
    frameCount = 0;
    fpsWindowStart = now;
  }
}

els.start.addEventListener('click', () => void start());

els.calibrate.addEventListener('click', () => {
  calibrator = new Calibrator(performance.now(), CALIBRATION_MS);
  appendLog(els.log, '开始校准');
});

els.pip.addEventListener('click', () => {
  els.pip.disabled = true;
  openPip(els.panel, () => {
    els.pip.disabled = false;
  }).catch((error: unknown) => {
    appendLog(els.log, `置顶小窗失败：${errorMessage(error)}`);
    els.pip.disabled = false;
  });
});

els.sensitivity.addEventListener('change', () => {
  const value = els.sensitivity.value;
  if (value !== 'low' && value !== 'normal' && value !== 'high') return;
  sensitivity = value;
  saveSensitivity(value);
  judge?.setSensitivity(value);
  appendLog(els.log, `灵敏度切换为：${els.sensitivity.selectedOptions[0]?.textContent ?? value}`);
});

els.sound.addEventListener('change', () => {
  alerter.soundEnabled = els.sound.checked;
});

document.addEventListener('visibilitychange', () => {
  appendLog(els.log, document.hidden ? '页面进入后台，继续以降频检测' : '页面回到前台');
  if (!document.hidden) void requestWakeLock();
});
