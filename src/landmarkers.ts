import {
  FaceLandmarker,
  FilesetResolver,
  PoseLandmarker,
  type FaceLandmarkerResult,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { MODEL_URLS, WASM_PATH } from './config';

export interface RawDetection {
  face: FaceLandmarkerResult;
  pose: PoseLandmarkerResult;
}

type Delegate = 'GPU' | 'CPU';

/** Wraps the two MediaPipe tasks used by the demo. Runs entirely in the browser. */
export class Landmarkers {
  private constructor(
    private readonly face: FaceLandmarker,
    private readonly pose: PoseLandmarker,
    readonly delegate: Delegate,
  ) {}

  static async load(onAttempt: (delegate: Delegate) => void): Promise<Landmarkers> {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

    // Prefer GPU; some machines/browsers fail to create the WebGL delegate, so fall back to CPU.
    for (const delegate of ['GPU', 'CPU'] as const) {
      try {
        onAttempt(delegate);
        const face = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URLS.face, delegate },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: true,
        });
        const pose = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URLS.pose, delegate },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        return new Landmarkers(face, pose, delegate);
      } catch (error) {
        console.warn(`Failed to create landmarkers with ${delegate} delegate`, error);
        if (delegate === 'CPU') throw error;
      }
    }
    throw new Error('unreachable');
  }

  /** `timestampMs` must increase strictly between calls (MediaPipe VIDEO mode requirement). */
  detect(video: HTMLVideoElement, timestampMs: number): RawDetection {
    return {
      face: this.face.detectForVideo(video, timestampMs),
      pose: this.pose.detectForVideo(video, timestampMs),
    };
  }

  close(): void {
    this.face.close();
    this.pose.close();
  }
}
