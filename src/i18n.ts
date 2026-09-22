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
  title: 'Upright — Are you sitting up straight?',
  metaDescription:
    'Free posture reminder that runs entirely in your browser. Your webcam checks for slouching, leaning in, head tilt and long sitting, and nudges you to sit up straight. No data ever leaves your device.',
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
  soundOn: 'On',
  soundOff: 'Off',
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
  issueShrug: 'Raised shoulders',
  issueBlink: 'Blink reminder',
  issueSitting: 'Sitting too long',
  sittingMessage: 'Sitting too long, time to stand up',
  blinkMessage: 'Blink your eyes',
  eyeCare: 'Blink reminder',
  issueLookAway: 'Look-away reminder',
  lookAwayMessage: 'Look 6 m away for 20 s',
  sittingReminder: 'Sitting reminder',
  lookAwayReminder: 'Look-away reminder',
  metricScreenTime: 'Screen time since break',
  btnPause: 'Pause',
  btnResume: 'Resume',
  paused: 'Paused',
  pausedLog: 'Paused, camera released',
  resumedLog: 'Resumed',
  metricShoulderY: 'Shoulder height (px)',
  metricBlink: 'Eye closure',
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
  faqTitle: 'FAQ',
  faqLookAwayQ: 'Why look away every 20 minutes?',
  faqLookAwayA:
    'Focusing on a screen an arm away keeps the tiny muscle inside each eye flexed the whole time. Twenty seconds on something six metres away is its coffee break. Eye doctors call it the 20-20-20 rule; we just enforce it.',
  faqSittingQ: 'Why not sit for hours?',
  faqSittingA:
    'The chair is not the enemy, the second hour is. Sit long enough and your big leg muscles clock out, your metabolism follows, and your lower back is left holding the whole shift alone. Two minutes on your feet every 45 beats any chair money can buy.',
  faqBlinkQ: 'Why blink more?',
  faqBlinkA:
    'You blink about 15 times a minute in normal life and under 5 when you stare at a screen. Each blink repaints the tear film; skip them and your eyes get dry, gritty and red. Blinking is free eye drops. Use them.',
  faqTooCloseQ: 'Why keep the screen at a distance?',
  faqTooCloseA:
    'The closer the screen, the harder your eyes work to focus, and the faster they tire. Your neck usually joins in by craning forward, which multiplies the load on your spine. About an arm’s length, 50 to 70 cm, is the comfortable spot.',
  faqPrivacyQ: 'Does my camera feed go anywhere?',
  faqPrivacyA:
    'No. The models run inside your browser and the video never leaves this computer; there is no server to receive it. Once the page has loaded you can pull the network cable and it keeps working.',
  faqCalibrateQ: 'Why calibrate first?',
  faqCalibrateA:
    'Every camera angle, chair height and body is different, so there is no universal number for “sitting straight”. Calibration records what upright looks like on you, and every check is measured against that. So actually sit up for those three seconds. It remembers.',
} as const;

export type Key = keyof typeof en;

const zh: Record<Key, string> = {
  brand: '坐直',
  tagline: '你坐直了吗？',
  note: '运行在本地浏览器里的坐姿检测，无任何数据上传',
  title: '坐直 Upright — 你坐直了吗？',
  metaDescription:
    '运行在本地浏览器里的免费坐姿提醒。摄像头检测驼背、离屏太近、歪头、久坐等问题并及时提醒，无任何数据上传。',
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
  soundOn: '开',
  soundOff: '关',
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
  issueShrug: '耸肩',
  issueBlink: '提醒眨眼',
  issueSitting: '久坐',
  sittingMessage: '久坐，起来活动一下',
  blinkMessage: '眨眨眼睛',
  eyeCare: '提醒眨眼',
  issueLookAway: '远眺提醒',
  lookAwayMessage: '看看 6 米外，坚持 20 秒',
  sittingReminder: '久坐提醒',
  lookAwayReminder: '远眺提醒',
  metricScreenTime: '连续看屏',
  btnPause: '暂停',
  btnResume: '继续',
  paused: '已暂停',
  pausedLog: '已暂停，摄像头已关闭',
  resumedLog: '已继续',
  metricShoulderY: '肩膀高度 (px)',
  metricBlink: '闭眼程度',
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
  faqTitle: '常见问题',
  faqLookAwayQ: '为什么每 20 分钟要远眺？',
  faqLookAwayA:
    '盯着一臂之内的屏幕时，眼睛里负责对焦的小肌肉一直在举铁。每 20 分钟看 6 米外 20 秒，等于让它放下杠铃喘口气。这叫 20-20-20 法则，是眼科医生想出来的，我们只负责催。',
  faqSittingQ: '为什么不要久坐？',
  faqSittingA:
    '椅子不是敌人，第二个小时才是。坐久了腿部的大肌群下班，代谢跟着放假，腰椎只能独自扛完整个班。每 45 分钟起来走两分钟，比再贵的椅子都管用。',
  faqBlinkQ: '为什么要多眨眼？',
  faqBlinkA:
    '平时每分钟眨 15 次左右，盯屏幕时会掉到 5 次以下。每次眨眼都在给眼球表面重新刷一层泪膜，省掉它，眼睛就会干、涩、发红。眨眼是免费的眼药水，别省。',
  faqTooCloseQ: '为什么离屏幕不要太近？',
  faqTooCloseA:
    '越近，眼睛为了对焦越吃力，疲劳来得越快；脖子通常还会跟着往前探，把头的重量成倍压到颈椎上。一臂远，也就是 50 到 70 厘米，是舒服的距离。',
  faqPrivacyQ: '我的画面会上传吗？',
  faqPrivacyA:
    '不会。模型在你的浏览器里运行，画面不离开这台电脑，也没有服务器可以收。页面加载完之后拔掉网线，它照样工作。',
  faqCalibrateQ: '为什么要先校准？',
  faqCalibrateA:
    '每个人的摄像头角度、椅子高度、身材都不一样，"坐直"没有通用数值。校准就是记住你坐直时的样子，之后所有判断都拿它来比。所以那三秒请真的坐直，它记性很好。',
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
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', t('metaDescription'));
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
