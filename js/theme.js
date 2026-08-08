// Tema: karanlik (varsayilan), aydinlik veya sistem tercihi.

const THEME_COLORS = {
  dark: '#0b0d12',
  light: '#f4f6fa',
};

let mediaQuery = null;

export function systemPrefersDark() {
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
}

export function resolveTheme(theme) {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  return systemPrefersDark() ? 'dark' : 'light';
}

/** theme: 'dark' | 'light' | 'system' */
export function applyTheme(theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[resolved]);

  // Sistem temasi secilmisse degisikligi dinle.
  if (theme === 'system') {
    if (!mediaQuery && globalThis.matchMedia) {
      mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', () => {
        if (document.documentElement.dataset.themeMode === 'system') applyTheme('system');
      });
    }
  }
  document.documentElement.dataset.themeMode = theme || 'dark';
  return resolved;
}
