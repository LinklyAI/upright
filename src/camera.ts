/** Opens the front camera at a modest resolution; 640x480 is plenty for landmarks and keeps inference cheap. */
export async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support camera access (getUserMedia).');
  }
  return navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    audio: false,
  });
}

/** Keeps the screen awake while monitoring. Best effort: unsupported browsers just skip it. */
export async function requestWakeLock(): Promise<void> {
  try {
    await navigator.wakeLock?.request('screen');
  } catch {
    // Wake lock is optional; denied or unsupported is fine.
  }
}
