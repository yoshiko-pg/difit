type ThemePreference = 'light' | 'dark' | 'auto';

export type ColorVisionMode = 'normal' | 'deuteranopia';

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

const isColorVisionMode = (value: unknown): value is ColorVisionMode =>
  value === 'normal' || value === 'deuteranopia';

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

type StoredAppearanceSettings = {
  colorVision?: ColorVisionMode;
  theme?: ThemePreference;
};

function getStoredAppearanceSettings(
  storage: ThemeStorage | undefined = getThemeStorage(),
): StoredAppearanceSettings | null {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const settings: StoredAppearanceSettings = {};
      const candidate = parsed as { colorVision?: unknown; theme?: unknown };

      if (isThemePreference(candidate.theme)) {
        settings.theme = candidate.theme;
      }

      if (isColorVisionMode(candidate.colorVision)) {
        settings.colorVision = candidate.colorVision;
      }

      return settings;
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

  return resolveThemePreference(
    getStoredAppearanceSettings(storage)?.theme,
    getSystemTheme(themeWindow),
  );
}

// Color overrides for deuteranopia (red-green color blindness)
// Uses blue for additions and orange for deletions instead of green/red
const DEUTERANOPIA_DARK_OVERRIDES: Record<string, string> = {
  '--color-github-accent': '#58a6ff',
  '--color-github-danger': '#d29922',
  '--color-diff-addition-bg': '#0c2d6b',
  '--color-diff-addition-border': '#388bfd',
  '--color-diff-deletion-bg': '#5a3600',
  '--color-diff-deletion-border': '#d29922',
};

const DEUTERANOPIA_LIGHT_OVERRIDES: Record<string, string> = {
  '--color-github-accent': '#0969da',
  '--color-github-danger': '#bf8700',
  '--color-diff-addition-bg': '#ddf4ff',
  '--color-diff-addition-border': '#0969da',
  '--color-diff-deletion-bg': '#fff8c5',
  '--color-diff-deletion-border': '#bf8700',
};

const DEUTERANOPIA_OVERRIDES: Record<ResolvedTheme, Record<string, string>> = {
  dark: DEUTERANOPIA_DARK_OVERRIDES,
  light: DEUTERANOPIA_LIGHT_OVERRIDES,
};

export function applyResolvedTheme(
  theme: ResolvedTheme,
  colorVision: ColorVisionMode = 'normal',
  doc = document,
) {
  const root = doc.documentElement;
  root.setAttribute(THEME_ATTRIBUTE, theme);
  root.setAttribute('data-color-vision', colorVision);

  const themeValues = THEME_VALUES[theme];
  Object.entries(themeValues).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  if (colorVision === 'deuteranopia') {
    const overrides = DEUTERANOPIA_OVERRIDES[theme];
    Object.entries(overrides).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }

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

  const storedSettings = getStoredAppearanceSettings(storage);
  const resolvedTheme = resolveThemePreference(storedSettings?.theme, getSystemTheme(themeWindow));
  const colorVision = storedSettings?.colorVision ?? 'normal';
  applyResolvedTheme(resolvedTheme, colorVision, doc);
  return resolvedTheme;
}
