import { BEEP_INTERVAL_MS, NOTIFY_INTERVAL_MS } from './config';
import { t } from './i18n';
import type { Verdict } from './types';

/**
 * Turns a verdict into user-facing feedback: red wash over the page and the floating window,
 * beeps, tab title and (when the tab is hidden) a system notification.
 */
export class Alerter {
  private audio: AudioContext | null = null;
  private lastBeepAt = 0;
  private lastNotifyAt = 0;
  private wasAlarm = false;
  private wasBreak = false;
  soundEnabled = true;

  /** Every wash surface gets the same opacity; one lives on the page, one travels with the panel. */
  constructor(private readonly overlays: readonly HTMLElement[]) {}

  /** Must be called from a user gesture so the AudioContext is allowed to play. */
  enableAudio(): void {
    if (!this.audio) this.audio = new AudioContext();
    void this.audio.resume();
  }

  async requestNotificationPermission(): Promise<void> {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    try {
      await Notification.requestPermission();
    } catch {
      // Permission prompt failures are non-fatal.
    }
  }

  /** Clears any visible alarm, e.g. when monitoring is paused. */
  reset(): void {
    this.setWash(0);
    document.title = t('title');
    this.wasAlarm = false;
    this.wasBreak = false;
  }

  /** `message` names the active checks, or the countdown while a look-away break is running. */
  apply(verdict: Verdict, message: string, now: number): void {
    const { alarm, severity } = verdict;
    const inBreak = verdict.breakLeftMs !== null;
    this.setWash(alarm ? 0.15 + 0.55 * severity : 0);
    document.title = alarm ? `⚠ ${message} – ${t('title')}` : inBreak ? `${message} – ${t('title')}` : t('title');

    if (alarm) {
      if (this.soundEnabled && now - this.lastBeepAt >= BEEP_INTERVAL_MS) {
        this.beep();
        this.lastBeepAt = now;
      }
      const firstTime = !this.wasAlarm;
      if (document.hidden && (firstTime || now - this.lastNotifyAt >= NOTIFY_INTERVAL_MS)) {
        this.notify(message);
        this.lastNotifyAt = now;
      }
    }
    // A break gets one beep and one notification to catch the eye; the countdown does the rest.
    if (inBreak && !this.wasBreak) {
      if (this.soundEnabled) {
        this.beep();
        this.lastBeepAt = now;
      }
      if (document.hidden) {
        this.notify(message);
        this.lastNotifyAt = now;
      }
    }
    this.wasAlarm = alarm;
    this.wasBreak = inBreak;
  }

  private setWash(opacity: number): void {
    for (const overlay of this.overlays) overlay.style.opacity = String(opacity);
  }

  private beep(): void {
    const ctx = this.audio;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(660, t + 0.15);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  private notify(message: string): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      // Same tag replaces the previous notification instead of stacking them.
      new Notification(t('notificationTitle'), {
        body: message,
        tag: 'posture-guard',
        silent: true,
      });
    } catch {
      // Some platforms throw for page-created notifications; ignore.
    }
  }
}
