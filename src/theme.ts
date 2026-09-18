const STORAGE_KEY = 'posture-guard.theme.v1';

type Theme = 'light' | 'dark';

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function storedTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/** Follows the system theme until the user toggles; the toggle is remembered. */
export function initTheme(button: HTMLButtonElement): void {
  let current: Theme = storedTheme() ?? systemTheme();
  apply(current);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (storedTheme() === null) {
      current = systemTheme();
      apply(current);
    }
  });

  button.addEventListener('click', () => {
    current = current === 'dark' ? 'light' : 'dark';
    apply(current);
    try {
      localStorage.setItem(STORAGE_KEY, current);
    } catch {
      // Non-fatal.
    }
  });
}
