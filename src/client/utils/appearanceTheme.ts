type ThemePreference = 'light' | 'dark' | 'auto';

export type ResolvedTheme = 'light' | 'dark';

type ThemeStorage = Pick<Storage, 'getItem'>;

type ThemeWindow = Pick<Window, 'matchMedia'>;

const THEME_ATTRIBUTE = 'data-theme';

const DARK_THEME_VALUES = {
  '--color-github-bg-primary': '#0d1117',
  '--color-github-bg-secondary': '#161b22',
  '--color-github-bg-tertiary': '#21262d',
  '--color-github-border': '#30363d',
  '--color-github-text-primary': '#f0f6fc',
  '--color-github-text-secondary': '#8b949e',
  '--color-github-text-muted': '#6e7681',
  '--color-github-accent': '#238636',
  '--color-github-danger': '#da3633',
  '--color-github-warning': '#d29922',
  '--color-diff-addition-bg': '#0d4429',
  '--color-diff-addition-border': '#1b7c3d',
  '--color-diff-deletion-bg': '#67060c',
  '--color-diff-deletion-border': '#da3633',
  '--color-diff-neutral-bg': '#21262d',
  '--color-comment-bg': '#1c2128',
  '--color-comment-border': '#373e47',
  '--color-comment-text': '#e6edf3',
  '--color-yellow-btn-bg': 'rgba(180, 83, 9, 0.2)',
  '--color-yellow-btn-border': 'rgba(217, 119, 6, 0.5)',
  '--color-yellow-btn-text': '#fbbf24',
  '--color-yellow-btn-hover-bg': 'rgba(180, 83, 9, 0.3)',
  '--color-yellow-btn-hover-border': '#d97706',
  '--color-yellow-path-bg': 'rgba(180, 83, 9, 0.3)',
  '--color-yellow-path-text': '#fbbf24',
  '--color-editor-btn-bg': 'rgba(248, 250, 252, 0.1)',
  '--color-editor-btn-border': 'rgba(248, 250, 252, 0.3)',
  '--color-editor-btn-text': '#f0f6fc',
  '--color-editor-btn-hover-bg': 'rgba(248, 250, 252, 0.2)',
  '--color-editor-btn-hover-border': 'rgba(248, 250, 252, 0.45)',
};

const LIGHT_THEME_VALUES = {
  '--color-github-bg-primary': '#ffffff',
  '--color-github-bg-secondary': '#f6f8fa',
  '--color-github-bg-tertiary': '#f1f3f4',
  '--color-github-border': '#d1d9e0',
  '--color-github-text-primary': '#24292f',
  '--color-github-text-secondary': '#656d76',
  '--color-github-text-muted': '#8c959f',
  '--color-github-accent': '#1f883d',
  '--color-github-danger': '#cf222e',
  '--color-github-warning': '#bf8700',
  '--color-diff-addition-bg': '#d1f4cd',
  '--color-diff-addition-border': '#1f883d',
  '--color-diff-deletion-bg': '#ffd8d3',
  '--color-diff-deletion-border': '#cf222e',
  '--color-diff-neutral-bg': '#f1f3f4',
  '--color-comment-bg': '#fff8e1',
  '--color-comment-border': '#ffd54f',
  '--color-comment-text': '#5d4037',
  '--color-yellow-btn-bg': '#fef3c7',
  '--color-yellow-btn-border': '#f59e0b',
  '--color-yellow-btn-text': '#92400e',
  '--color-yellow-btn-hover-bg': '#fde68a',
  '--color-yellow-btn-hover-border': '#d97706',
  '--color-yellow-path-bg': '#fde68a',
  '--color-yellow-path-text': '#92400e',
  '--color-editor-btn-bg': 'rgba(248, 250, 252, 0.1)',
  '--color-editor-btn-border': 'rgba(31, 41, 55, 0.35)',
  '--color-editor-btn-text': '#1f2937',
  '--color-editor-btn-hover-bg': 'rgba(248, 250, 252, 0.2)',
  '--color-editor-btn-hover-border': 'rgba(31, 41, 55, 0.5)',
};

const THEME_VALUES: Record<ResolvedTheme, Record<string, string>> = {
  dark: DARK_THEME_VALUES,
  light: LIGHT_THEME_VALUES,
};

export const APPEARANCE_STORAGE_KEY = 'reviewit-appearance-settings';

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'auto';

const isResolvedTheme = (value: string | null): value is ResolvedTheme =>
  value === 'light' || value === 'dark';

const getThemeStorage = (): ThemeStorage | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

const getThemeWindow = (): ThemeWindow | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window;
};

function getStoredThemePreference(
  storage: ThemeStorage | undefined = getThemeStorage(),
): ThemePreference | null {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'theme' in parsed &&
      isThemePreference((parsed as { theme?: unknown }).theme)
    ) {
      return (parsed as { theme: ThemePreference }).theme;
    }
  } catch {
    return null;
  }

  return null;
}

function getSystemTheme(themeWindow: ThemeWindow | undefined = getThemeWindow()): ResolvedTheme {
  const matchesDark = themeWindow?.matchMedia('(prefers-color-scheme: dark)').matches ?? true;
  return matchesDark ? 'dark' : 'light';
}

export function resolveThemePreference(
  preference: ThemePreference | null | undefined,
  systemTheme: ResolvedTheme = getSystemTheme(),
): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }

  return systemTheme;
}

export function getResolvedTheme(
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
  storage: ThemeStorage | undefined = getThemeStorage(),
  themeWindow: ThemeWindow | undefined = getThemeWindow(),
): ResolvedTheme {
  const documentTheme = doc?.documentElement.getAttribute(THEME_ATTRIBUTE) ?? null;
  if (isResolvedTheme(documentTheme)) {
    return documentTheme;
  }

  return resolveThemePreference(getStoredThemePreference(storage), getSystemTheme(themeWindow));
}

export function applyResolvedTheme(theme: ResolvedTheme, doc = document) {
  const root = doc.documentElement;
  root.setAttribute(THEME_ATTRIBUTE, theme);

  const themeValues = THEME_VALUES[theme];
  Object.entries(themeValues).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  if (doc.body) {
    doc.body.style.backgroundColor = 'var(--color-github-bg-primary)';
    doc.body.style.color = 'var(--color-github-text-primary)';
  }
}

export function bootstrapAppearanceTheme(
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
  storage: ThemeStorage | undefined = getThemeStorage(),
  themeWindow: ThemeWindow | undefined = getThemeWindow(),
) {
  if (!doc) {
    return null;
  }

  const resolvedTheme = resolveThemePreference(
    getStoredThemePreference(storage),
    getSystemTheme(themeWindow),
  );
  applyResolvedTheme(resolvedTheme, doc);
  return resolvedTheme;
}
