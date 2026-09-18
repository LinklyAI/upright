import type { FrameMetrics, Verdict } from './types';

const COLOR_OK = '#3ddc84';
const COLOR_BAD = '#ff4d4f';
const COLOR_MUTED = '#8a90a2';

/** Draws the handful of key points we actually use, so the user can see what the detector sees. */
export class Overlay {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  draw(metrics: FrameMetrics | null, verdict: Verdict | null): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!metrics) return;

    const { leftIris, rightIris, forehead, chin, shoulders } = metrics.points;
    const closeColor = verdict?.issues.tooClose.active ? COLOR_BAD : COLOR_OK;
    const headColor = verdict?.issues.headDown.active ? COLOR_BAD : COLOR_OK;
    const slouchColor = verdict?.issues.slouch.active ? COLOR_BAD : COLOR_OK;

    ctx.lineWidth = 2;

    // Eyes: distance drives the "too close" rule.
    this.line(leftIris, rightIris, closeColor);
    this.dot(leftIris, closeColor);
    this.dot(rightIris, closeColor);

    // Forehead-chin axis: its depth tilt drives the "head down" rule.
    this.line(forehead, chin, headColor);
    this.dot(forehead, headColor);
    this.dot(chin, headColor);

    // Shoulders: nose-to-shoulder height drives the "slouch" rule.
    if (shoulders) {
      const [left, right] = shoulders;
      this.line(left, right, slouchColor);
      this.dot(left, slouchColor);
      this.dot(right, slouchColor);
    } else {
      ctx.fillStyle = COLOR_MUTED;
      ctx.font = '14px system-ui';
      // Canvas is mirrored via CSS; flip text back so it reads normally.
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.fillText('肩膀不在画面内，驼背检测暂停', 12, canvas.height - 12);
      ctx.restore();
    }
  }

  private dot(p: { x: number; y: number }, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private line(a: { x: number; y: number }, b: { x: number; y: number }, color: string): void {
    this.ctx.strokeStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.stroke();
  }
}
