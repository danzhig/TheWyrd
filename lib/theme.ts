/**
 * Applies the reader's display settings to <html>: data-theme (vault | vellum), data-text-size,
 * data-verse-numbers and data-translation (webc | drc). `applyDisplaySettings` must stay self-contained: it is also serialised into an
 * inline <head> script so the theme is set before first paint. With no argument it reads
 * localStorage itself; the ThemeController passes the store's settings instead.
 */
export function applyDisplaySettings(given?: {
  theme?: string;
  textSize?: number;
  verseNumbers?: boolean;
  translation?: string;
}): void {
  let s = given;
  if (!s) {
    try {
      s = JSON.parse(window.localStorage.getItem('sas:v1:settings') || '{}') || {};
    } catch {
      s = {};
    }
  }
  const settings = s || {};
  const theme = settings.theme || 'default';
  let resolved = 'vault';
  if (theme === 'vault' || theme === 'vellum') resolved = theme;
  else if (theme === 'auto') {
    resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'vellum' : 'vault';
  } else if (window.location.pathname.indexOf('/read') === 0) resolved = 'vellum';
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-text-size', String(settings.textSize || 2));
  root.setAttribute('data-verse-numbers', settings.verseNumbers === false ? 'off' : 'on');
  // The reader's translation (Phase 7): set before paint so the WEBC never flashes in its place.
  root.setAttribute('data-translation', settings.translation === 'drc' ? 'drc' : 'webc');
}

export const THEME_SCRIPT = `(${applyDisplaySettings.toString()})();`;

/** The reader's page colour for the current settings (the paper a station grows into). */
export function readerBackground(theme: string | undefined): string {
  const t = theme || 'default';
  const dark =
    t === 'vault' || (t === 'auto' && !window.matchMedia('(prefers-color-scheme: light)').matches);
  return dark ? '#14100C' : '#F4ECDC';
}
