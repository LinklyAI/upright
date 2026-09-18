/**
 * Tiny string table for the two supported locales. UI text is looked up by key so the
 * page can switch language without reloading; `{name}` placeholders are interpolated.
 */
export type Locale = 'en' | 'zh';

const STORAGE_KEY = 'posture-guard.locale.v1';

const en = {
  brand: 'Upright',
  tagline: 'Are you sitting up straight?',
  note: 'Posture detection that runs in your browser. No data ever leaves your device.',
  title: 'Upright',
  themeToggle: 'Toggle color theme',
  language: 'Language',
  stageAria: 'Camera view',
  stageHint: 'Click "Start camera" to begin',
  statusIdle: 'Not started',
  fpsWaiting: 'Waiting for camera',
  fpsBackground: 'background',
  checksAria: 'Checks',
  controlsAria: 'Controls',
  eventsAria: 'Event log',
  btnStart: 'Start camera',
  btnCalibrate: 'Calibrate · sit upright for 3 s',
  btnPip: 'Floating window',
  sensitivity: 'Sensitivity',
  sensitivityLow: 'Low',
  sensitivityNormal: 'Normal',
  sensitivityHigh: 'High',
  sound: 'Sound alerts',
  rawMetrics: 'Raw metrics',
  thMetric: 'Metric',
  thCurrent: 'Current',
  thBaseline: 'Baseline',
  thDeviation: 'Deviation',
  events: 'Events',
  noEvents: 'No events yet',
  issueTooClose: 'Too close',
  issueHeadDown: 'Head down',
  issueHeadTilt: 'Head tilt',
  issueHeadForward: 'Forward head',
  issueSlouch: 'Slouching',
  issueSideLean: 'Leaning sideways',
  issueSitting: 'Sitting too long',
  sittingMessage: 'Sitting too long, time to stand up',
  gaugeToggleHint: 'Click to turn this check off or on',
  gaugeMuted: 'off',
  checkMutedLog: 'Check turned off: {name}',
  checkUnmutedLog: 'Check turned on: {name}',
  metricIpd: 'Pupil distance (px)',
  metricPitch: 'Head pitch (°)',
  metricRoll: 'Head roll (°)',
  metricHeadForward: 'Face / shoulder ratio',
  metricTorso: 'Nose-shoulder ratio',
  metricNoseY: 'Nose height (px)',
  metricShoulderTilt: 'Shoulder tilt (°)',
  metricLateral: 'Lateral offset',
  metricSeated: 'Seated for',
  openingCamera: 'Opening camera…',
  loadingModel: 'Loading models ({delegate})…',
  modelLoaded: 'Models loaded ({delegate})',
  runningPrevious: 'Running with your previous calibration',
  runningCalibrate: 'Running, calibrate to begin',
  startFailed: 'Could not start: {error}',
  calibrating: 'Calibrating, hold an upright posture… {pct}%',
  calibrationStarted: 'Calibration started',
  calibrationDone: 'Calibration complete',
  calibrationFailed: 'Calibration failed: no stable face detected, face the camera and retry',
  calibrationFailedLog: 'Calibration failed',
  calibrationLog: 'Calibrated: pupil distance {ipd}px, pitch {pitch}°, roll {roll}°, {shoulders}',
  calibrationShoulders: 'nose-shoulder ratio {torso}, shoulder line {tilt}°',
  calibrationNoShoulders: 'shoulders out of frame (slouch uses nose height; lean and forward head unavailable)',
  noFace: 'No face detected',
  adjust: 'Please adjust: {message}',
  postureGood: 'Posture looks good',
  alarmLog: '⚠ Alert: {message}',
  recoveredLog: '✓ Posture recovered',
  shouldersHidden: 'Shoulders out of frame: slouch uses nose height; lean and forward head paused',
  pipFailed: 'Floating window failed: {error}',
  sensitivityLog: 'Sensitivity: {level}',
  wentBackground: 'Tab in background, detection continues at a lower rate',
  cameForeground: 'Tab in foreground',
  notificationTitle: 'Posture reminder',
} as const;

export type Key = keyof typeof en;

const zh: Record<Key, string> = {
  brand: '坐直',
  tagline: '你坐直了吗？',
  note: '运行在本地浏览器里的坐姿检测，无任何数据上传',
  title: '坐直 — Upright',
  themeToggle: '切换明暗主题',
  language: '语言',
  stageAria: '摄像头画面',
  stageHint: '点「启动摄像头」开始',
  statusIdle: '未启动',
  fpsWaiting: '等待摄像头',
  fpsBackground: '后台',
  checksAria: '各项检测',
  controlsAria: '控制',
  eventsAria: '事件记录',
  btnStart: '启动摄像头',
  btnCalibrate: '校准 · 端正坐好 3 秒',
  btnPip: '置顶小窗',
  sensitivity: '灵敏度',
  sensitivityLow: '低',
  sensitivityNormal: '中',
  sensitivityHigh: '高',
  sound: '声音提醒',
  rawMetrics: '原始指标',
  thMetric: '指标',
  thCurrent: '当前',
  thBaseline: '基线',
  thDeviation: '偏差',
  events: '事件',
  noEvents: '暂无事件',
  issueTooClose: '离屏幕太近',
  issueHeadDown: '低头',
  issueHeadTilt: '歪头',
  issueHeadForward: '头前伸',
  issueSlouch: '驼背塌陷',
  issueSideLean: '歪坐',
  issueSitting: '久坐',
  sittingMessage: '久坐，起来活动一下',
  gaugeToggleHint: '点击可关闭或开启这一项检测',
  gaugeMuted: '已关闭',
  checkMutedLog: '已关闭检测：{name}',
  checkUnmutedLog: '已开启检测：{name}',
  metricIpd: '瞳距 (px)',
  metricPitch: '头部俯仰 (°)',
  metricRoll: '头部侧倾 (°)',
  metricHeadForward: '脸肩比',
  metricTorso: '鼻肩高度比',
  metricNoseY: '鼻子高度 (px)',
  metricShoulderTilt: '肩线倾斜 (°)',
  metricLateral: '横向偏移',
  metricSeated: '连续就座',
  openingCamera: '正在打开摄像头…',
  loadingModel: '正在加载模型（{delegate}）…',
  modelLoaded: '模型已加载（{delegate}）',
  runningPrevious: '运行中，沿用上次校准',
  runningCalibrate: '运行中，请先校准',
  startFailed: '启动失败：{error}',
  calibrating: '校准中，请保持端正坐姿… {pct}%',
  calibrationStarted: '开始校准',
  calibrationDone: '校准完成',
  calibrationFailed: '校准失败：没有稳定检测到人脸，请正对摄像头重试',
  calibrationFailedLog: '校准失败',
  calibrationLog: '校准完成：瞳距 {ipd}px，俯仰 {pitch}°，侧倾 {roll}°，{shoulders}',
  calibrationShoulders: '鼻肩比 {torso}，肩线 {tilt}°',
  calibrationNoShoulders: '肩膀不在画面内（驼背改用鼻子高度，歪坐 / 头前伸不可用）',
  noFace: '未检测到人脸',
  adjust: '请调整：{message}',
  postureGood: '坐姿正常',
  alarmLog: '⚠ 警报：{message}',
  recoveredLog: '✓ 姿势已恢复',
  shouldersHidden: '肩膀不在画面内：驼背改用鼻子高度判断，歪坐 / 头前伸暂停',
  pipFailed: '置顶小窗失败：{error}',
  sensitivityLog: '灵敏度：{level}',
  wentBackground: '页面进入后台，继续以降频检测',
  cameForeground: '页面回到前台',
  notificationTitle: '坐姿提醒',
};

const TABLES: Record<Locale, Record<Key, string>> = { en, zh };

let current: Locale = detectLocale();

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh') return stored;
  } catch {
    // Fall through to the browser language.
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Non-fatal.
  }
}

export function t(key: Key, vars?: Record<string, string | number>): string {
  const template = TABLES[current][key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Fills every element carrying `data-i18n` (text), `data-i18n-aria` (aria-label) or
 * `data-i18n-empty` (the `data-empty` attribute used by CSS) from the current table.
 */
export function applyStaticStrings(root: ParentNode = document): void {
  document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';
  document.title = t('title');
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n as Key);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nAria as Key));
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-empty]')) {
    el.dataset.empty = t(el.dataset.i18nEmpty as Key);
  }
}
