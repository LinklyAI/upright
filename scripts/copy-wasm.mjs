// Copies the MediaPipe WASM runtime from node_modules into public/wasm so the
// JS bundle and the WASM binary always come from the same installed version.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url));
const dst = fileURLToPath(new URL('../public/wasm/', import.meta.url));

if (!existsSync(src)) {
  console.error('@mediapipe/tasks-vision is not installed. Run: pnpm add @mediapipe/tasks-vision');
  process.exit(1);
}
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
console.log(`Copied MediaPipe wasm to ${dst}`);
