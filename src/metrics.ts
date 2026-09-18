import type { Matrix, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { HEAD_PITCH_SIGN } from './config';
import type { RawDetection } from './landmarkers';
import type { FrameMetrics, Point, ShoulderMetrics } from './types';

// Face Landmarker (478 points): 468-472 left iris, 473-477 right iris.
const FACE = { forehead: 10, chin: 152, noseTip: 1, leftIris: 468, rightIris: 473 } as const;
// Pose Landmarker (33 points).
const POSE = { leftShoulder: 11, rightShoulder: 12 } as const;

const MIN_VISIBILITY = 0.5;
const RAD_TO_DEG = 180 / Math.PI;

function toPx(landmark: NormalizedLandmark, width: number, height: number): Point {
  return { x: landmark.x * width, y: landmark.y * height };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleDeg(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x) * RAD_TO_DEG;
}

function isVisible(landmark: NormalizedLandmark): boolean {
  return (landmark.visibility ?? 1) >= MIN_VISIBILITY;
}

/**
 * Head pitch from the facial transformation matrix (face-local -> metric camera space).
 * The packed data is column-major, so column 1 (indices 4..7) is the face's "up" axis
 * expressed in camera space (x right, y up, z toward the viewer). Looking down tips that
 * axis toward the camera, giving a positive z component.
 */
function pitchFromMatrix(matrix: Matrix | undefined): number | null {
  if (!matrix || matrix.rows !== 4 || matrix.columns !== 4) return null;
  const upY = matrix.data[5];
  const upZ = matrix.data[6];
  if (upY === undefined || upZ === undefined) return null;
  return HEAD_PITCH_SIGN * Math.atan2(upZ, upY) * RAD_TO_DEG;
}

/** Fallback pitch from mesh depth: forehead closer than chin means looking down. */
function pitchFromMesh(forehead: NormalizedLandmark, chin: NormalizedLandmark, width: number, height: number): number {
  const dz = (chin.z - forehead.z) * width;
  const dy = (chin.y - forehead.y) * height;
  return Math.atan2(dz, dy) * RAD_TO_DEG;
}

function shoulderMetrics(raw: RawDetection, nose: Point, ipd: number, width: number, height: number): {
  metrics: ShoulderMetrics;
  points: [Point, Point];
} | null {
  const pose = raw.pose.landmarks[0];
  if (!pose) return null;
  const left = pose[POSE.leftShoulder];
  const right = pose[POSE.rightShoulder];
  if (!left || !right || !isVisible(left) || !isVisible(right)) return null;

  const leftPx = toPx(left, width, height);
  const rightPx = toPx(right, width, height);
  const shoulderWidth = dist(leftPx, rightPx);
  if (shoulderWidth <= 1) return null;

  const mid = { x: (leftPx.x + rightPx.x) / 2, y: (leftPx.y + rightPx.y) / 2 };
  return {
    metrics: {
      width: shoulderWidth,
      tilt: angleDeg(leftPx, rightPx),
      torsoRatio: (mid.y - nose.y) / shoulderWidth,
      lateral: (nose.x - mid.x) / shoulderWidth,
      headForward: ipd / shoulderWidth,
    },
    points: [leftPx, rightPx],
  };
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
  const noseTip = face[FACE.noseTip];
  const leftIris = face[FACE.leftIris];
  const rightIris = face[FACE.rightIris];
  if (!forehead || !chin || !noseTip || !leftIris || !rightIris) return null;

  const foreheadPx = toPx(forehead, width, height);
  const chinPx = toPx(chin, width, height);
  const nosePx = toPx(noseTip, width, height);
  const leftIrisPx = toPx(leftIris, width, height);
  const rightIrisPx = toPx(rightIris, width, height);

  const ipd = dist(leftIrisPx, rightIrisPx);
  const pitch = pitchFromMatrix(raw.face.facialTransformationMatrixes[0]) ?? pitchFromMesh(forehead, chin, width, height);
  const shoulders = shoulderMetrics(raw, nosePx, ipd, width, height);

  return {
    ipd,
    pitch,
    roll: angleDeg(leftIrisPx, rightIrisPx),
    noseY: nosePx.y,
    faceHeight: dist(foreheadPx, chinPx),
    shoulders: shoulders?.metrics ?? null,
    points: {
      leftIris: leftIrisPx,
      rightIris: rightIrisPx,
      forehead: foreheadPx,
      chin: chinPx,
      shoulders: shoulders?.points ?? null,
    },
  };
}
