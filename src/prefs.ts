export const THEMES = {
  teal: 'the original palette',
  amber: 'warm phosphor, like a 1980s monitor',
  matrix: 'green on black',
  violet: 'late-night purple',
  paper: 'light mode, for the brave',
} as const;

export const FONTS = {
  plex: { label: 'IBM Plex Mono', stack: "'IBM Plex Mono'" },
  jetbrains: { label: 'JetBrains Mono', stack: "'JetBrains Mono'" },
  fira: { label: 'Fira Code', stack: "'Fira Code'" },
  space: { label: 'Space Mono', stack: "'Space Mono'" },
  vt323: { label: 'VT323 (retro CRT)', stack: "'VT323'" },
} as const;

export type ThemeName = keyof typeof THEMES;
export type FontName = keyof typeof FONTS;

export interface Prefs {
  theme: ThemeName;
  font: FontName;
  crt: boolean;
}

export const DEFAULT_PREFS: Prefs = { theme: 'teal', font: 'plex', crt: false };

const PREFS_KEY = 'katheu:prefs';
const HISTORY_KEY = 'katheu:history';
const HISTORY_LIMIT = 100;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private windows, blocked site data).
  }
}

export function loadPrefs(): Prefs {
  const saved = read<Partial<Prefs>>(PREFS_KEY) ?? {};
  return {
    theme: saved.theme && saved.theme in THEMES ? saved.theme : DEFAULT_PREFS.theme,
    font: saved.font && saved.font in FONTS ? saved.font : DEFAULT_PREFS.font,
    crt: saved.crt === true,
  };
}

export function savePrefs(prefs: Prefs): void {
  write(PREFS_KEY, prefs);
}

export function applyPrefs(prefs: Prefs): void {
  const el = document.documentElement;
  el.dataset.theme = prefs.theme;
  el.dataset.font = prefs.font;
  el.dataset.crt = prefs.crt ? 'on' : 'off';
  el.style.setProperty('--mono', `${FONTS[prefs.font].stack}, ui-monospace, 'Courier New', monospace`);
}

export function loadHistory(): string[] {
  const saved = read<unknown>(HISTORY_KEY);
  return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : [];
}

export function saveHistory(history: string[]): void {
  write(HISTORY_KEY, history.slice(-HISTORY_LIMIT));
}
