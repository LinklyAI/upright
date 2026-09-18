import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { RawDetection } from './landmarkers';
import type { FrameMetrics, Point } from './types';

// Face Landmarker (478 points): 468-472 left iris, 473-477 right iris.
const FACE = { forehead: 10, chin: 152, leftIris: 468, rightIris: 473 } as const;
// Pose Landmarker (33 points).
const POSE = { nose: 0, leftShoulder: 11, rightShoulder: 12 } as const;

const MIN_VISIBILITY = 0.5;

function toPx(landmark: NormalizedLandmark, width: number, height: number): Point {
  return { x: landmark.x * width, y: landmark.y * height };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isVisible(landmark: NormalizedLandmark): boolean {
  return (landmark.visibility ?? 1) >= MIN_VISIBILITY;
}

/**
 * Turns raw landmarks into a few scale-free numbers. Everything is later compared
 * against a per-user baseline, so camera angle and seating height cancel out.
 * Returns null when no face is in frame.
 */
export function computeMetrics(raw: RawDetection, width: number, height: number): FrameMetrics | null {
  const face = raw.face.faceLandmarks[0];
  if (!face) return null;

  const forehead = face[FACE.forehead];
  const chin = face[FACE.chin];
  const leftIris = face[FACE.leftIris];
  const rightIris = face[FACE.rightIris];
  if (!forehead || !chin || !leftIris || !rightIris) return null;

  const foreheadPx = toPx(forehead, width, height);
  const chinPx = toPx(chin, width, height);
  const leftIrisPx = toPx(leftIris, width, height);
  const rightIrisPx = toPx(rightIris, width, height);

  const ipd = dist(leftIrisPx, rightIrisPx);

  // MediaPipe z shares the scale of x (normalized by image width); smaller z is closer to the camera.
  // When the head tilts down the forehead comes closer than the chin, so dz > 0.
  const dz = (chin.z - forehead.z) * width;
  const dy = chinPx.y - foreheadPx.y;
  const pitch = (Math.atan2(dz, dy) * 180) / Math.PI;

  let torsoRatio: number | null = null;
  let shoulders: [Point, Point] | null = null;
  const pose = raw.pose.landmarks[0];
  if (pose) {
    const nose = pose[POSE.nose];
    const left = pose[POSE.leftShoulder];
    const right = pose[POSE.rightShoulder];
    if (nose && left && right && isVisible(nose) && isVisible(left) && isVisible(right)) {
      const leftPx = toPx(left, width, height);
      const rightPx = toPx(right, width, height);
      const nosePx = toPx(nose, width, height);
      const shoulderWidth = dist(leftPx, rightPx);
      if (shoulderWidth > 1) {
        torsoRatio = ((leftPx.y + rightPx.y) / 2 - nosePx.y) / shoulderWidth;
        shoulders = [leftPx, rightPx];
      }
    }
  }

  return {
    ipd,
    pitch,
    torsoRatio,
    points: { leftIris: leftIrisPx, rightIris: rightIrisPx, forehead: foreheadPx, chin: chinPx, shoulders },
  };
}
