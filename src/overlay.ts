import type { FrameMetrics, Point, Verdict } from './types';

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
    const issues = verdict?.issues;
    const eyeColor = issues?.tooClose.active || issues?.headTilt.active ? COLOR_BAD : COLOR_OK;
    const headColor = issues?.headDown.active ? COLOR_BAD : COLOR_OK;
    const shoulderColor =
      issues?.slouch.active || issues?.sideLean.active || issues?.headForward.active ? COLOR_BAD : COLOR_OK;

    ctx.lineWidth = 2;

    // Eye line: distance (length) and head roll (angle).
    this.line(leftIris, rightIris, eyeColor);
    this.dot(leftIris, eyeColor);
    this.dot(rightIris, eyeColor);

    // Forehead-chin axis: head pitch.
    this.line(forehead, chin, headColor);
    this.dot(forehead, headColor);
    this.dot(chin, headColor);

    // Shoulder line: slouch, side lean and forward head.
    if (shoulders) {
      const [left, right] = shoulders;
      this.line(left, right, shoulderColor);
      this.dot(left, shoulderColor);
      this.dot(right, shoulderColor);
    } else {
      this.note('肩膀不在画面内：驼背改用鼻子高度判断，歪坐 / 头前伸暂停');
    }
  }

  /** Canvas is mirrored via CSS; flip text back so it reads normally. */
  private note(text: string): void {
    const { ctx, canvas } = this;
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.fillStyle = COLOR_MUTED;
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.fillText(text, 12, canvas.height - 12);
    ctx.restore();
  }

  private dot(p: Point, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private line(a: Point, b: Point, color: string): void {
    this.ctx.strokeStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.stroke();
  }
}
