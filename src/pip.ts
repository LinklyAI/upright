/** Minimal typing for the Document Picture-in-Picture API (Chrome 116+), absent from lib.dom. */
interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export function isPipSupported(): boolean {
  return typeof window.documentPictureInPicture !== 'undefined';
}

/**
 * Moves `panel` into an always-on-top PiP window and moves it back when that window closes.
 * The tab keeps running the camera loop; PiP only relocates the status UI.
 */
export async function openPip(panel: HTMLElement, onClose: () => void): Promise<void> {
  const api = window.documentPictureInPicture;
  if (!api) throw new Error('Document Picture-in-Picture is not supported in this browser.');

  const pipWindow = await api.requestWindow({ width: 360, height: 260 });
  copyStyles(pipWindow);
  pipWindow.document.body.style.margin = '8px';
  // Lets the stylesheet lay the panel out for the small window (rings instead of bars).
  pipWindow.document.body.classList.add('pip');

  const placeholder = document.createComment('pip-placeholder');
  panel.replaceWith(placeholder);
  pipWindow.document.body.append(panel);

  pipWindow.addEventListener('pagehide', () => {
    placeholder.replaceWith(panel);
    onClose();
  });
}

/** Vite injects <style> in dev and <link> in production; handle both. */
function copyStyles(target: Window): void {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join('\n');
      const style = target.document.createElement('style');
      style.textContent = css;
      target.document.head.append(style);
    } catch {
      if (sheet.href) {
        const link = target.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        target.document.head.append(link);
      }
    }
  }
}
