// Theme configuration
const LIGHT_THEMES = [
  { id: 'github', label: 'GitHub Light' },
  { id: 'vsLight', label: 'VS Light' },
  { id: 'oneLight', label: 'One Light' },
  { id: 'gruvboxMaterialLight', label: 'Gruvbox Material Light' },
  { id: 'nightOwlLight', label: 'Night Owl Light' },
];

const DARK_THEMES = [
  { id: 'vsDark', label: 'VS Dark' },
  { id: 'oneDark', label: 'One Dark' },
  { id: 'gruvboxMaterialDark', label: 'Gruvbox Material Dark' },
  { id: 'nightOwl', label: 'Night Owl' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'okaidia', label: 'Okaidia' },
];

// Built-in themes don't require CSS management

type SyntaxThemeOption = (typeof LIGHT_THEMES | typeof DARK_THEMES)[number];

export const getThemesForResolvedTheme = (theme: 'light' | 'dark') =>
  theme === 'light' ? LIGHT_THEMES : DARK_THEMES;

export const isSyntaxThemeForResolvedTheme = (syntaxTheme: string, theme: 'light' | 'dark') =>
  getThemesForResolvedTheme(theme).some((themeOption) => themeOption.id === syntaxTheme);

export const getFallbackSyntaxTheme = (theme: 'light' | 'dark'): SyntaxThemeOption | undefined =>
  getThemesForResolvedTheme(theme)[0];
