import type { Classifications, Matrix, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { HEAD_PITCH_SIGN } from './config';
import type { RawDetection } from './landmarkers';
import type { FrameMetrics, Point, ShoulderMetrics } from './types';

// Face Landmarker (478 points): 468-472 left iris, 473-477 right iris.
const FACE = { forehead: 10, chin: 152, noseTip: 1, leftIris: 468, rightIris: 473 } as const;
// Pose Landmarker (33 points).
const POSE = { leftEar: 7, rightEar: 8, leftShoulder: 11, rightShoulder: 12 } as const;

const MIN_VISIBILITY = 0.5;
const RAD_TO_DEG = 180 / Math.PI;

function toPx(landmark: NormalizedLandmark, width: number, height: number): Point {
  return { x: landmark.x * width, y: landmark.y * height };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Tilt of the line a→b in degrees, −90..90. Uses atan rather than atan2 so the result does not
 * depend on which end is "left": a line near horizontal reads near 0 whichever way round the
 * points come, instead of jumping between +180 and −180.
 */
function lineTiltDeg(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0) return dy === 0 ? 0 : 90;
  return Math.atan(dy / dx) * RAD_TO_DEG;
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

/** Mean of the two eye-blink blendshapes, or null when blendshapes were not produced. */
function eyeClosure(blendshapes: Classifications | undefined): number | null {
  if (!blendshapes) return null;
  let sum = 0;
  let count = 0;
  for (const category of blendshapes.categories) {
    if (category.categoryName === 'eyeBlinkLeft' || category.categoryName === 'eyeBlinkRight') {
      sum += category.score;
      count += 1;
    }
  }
  return count === 0 ? null : sum / count;
}

function shoulderMetrics(
  raw: RawDetection,
  nose: Point,
  ipd: number,
  width: number,
  height: number,
): { metrics: ShoulderMetrics; shoulders: [Point, Point]; ears: [Point, Point] | null } | null {
  const pose = raw.pose.landmarks[0];
  if (!pose) return null;
  const left = pose[POSE.leftShoulder];
  const right = pose[POSE.rightShoulder];
  if (!left || !right || !isVisible(left) || !isVisible(right)) return null;

  const leftPx = toPx(left, width, height);
  const rightPx = toPx(right, width, height);
  const shoulderWidth = dist(leftPx, rightPx);
  if (shoulderWidth <= 1) return null;
  const shoulderMid = mid(leftPx, rightPx);

  const leftEar = pose[POSE.leftEar];
  const rightEar = pose[POSE.rightEar];
  const ears: [Point, Point] | null =
    leftEar && rightEar && isVisible(leftEar) && isVisible(rightEar)
      ? [toPx(leftEar, width, height), toPx(rightEar, width, height)]
      : null;
  const head = ears ? mid(ears[0], ears[1]) : nose;

  return {
    metrics: {
      width: shoulderWidth,
      tilt: lineTiltDeg(leftPx, rightPx),
      midY: shoulderMid.y,
      torsoRatio: (shoulderMid.y - head.y) / shoulderWidth,
      headY: head.y,
      usesEars: ears !== null,
      lateral: (nose.x - shoulderMid.x) / shoulderWidth,
      headForward: ipd / shoulderWidth,
    },
    shoulders: [leftPx, rightPx],
    ears,
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
  const pitch =
    pitchFromMatrix(raw.face.facialTransformationMatrixes[0]) ?? pitchFromMesh(forehead, chin, width, height);
  const shoulders = shoulderMetrics(raw, nosePx, ipd, width, height);

  return {
    ipd,
    pitch,
    roll: lineTiltDeg(leftIrisPx, rightIrisPx),
    noseY: nosePx.y,
    faceHeight: dist(foreheadPx, chinPx),
    eyeClosed: eyeClosure(raw.face.faceBlendshapes[0]),
    shoulders: shoulders?.metrics ?? null,
    points: {
      leftIris: leftIrisPx,
      rightIris: rightIrisPx,
      forehead: foreheadPx,
      chin: chinPx,
      ears: shoulders?.ears ?? null,
      shoulders: shoulders?.shoulders ?? null,
    },
  };
}
