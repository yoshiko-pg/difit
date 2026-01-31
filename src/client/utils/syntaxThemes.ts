import { type PrismTheme, themes } from 'prism-react-renderer';

import { LIGHT_THEMES, DARK_THEMES } from './themeLoader';

// Helper function to remove background colors from theme
function removeBackgrounds(theme: PrismTheme) {
  return {
    ...theme,
    styles: theme.styles.map((style: PrismTheme['styles'][number]) => ({
      ...style,
      style: {
        ...style.style,
        background: undefined,
        backgroundColor: undefined,
      },
    })),
  };
}

export function getSyntaxTheme(syntaxTheme: string) {
  let baseTheme;

  // Map theme IDs to prism-react-renderer built-in themes
  switch (syntaxTheme) {
    case 'github':
      baseTheme = themes.github;
      break;
    case 'vsLight':
      baseTheme = themes.vsLight;
      break;
    case 'oneLight':
      baseTheme = themes.oneLight;
      break;
    case 'gruvboxMaterialLight':
      baseTheme = themes.gruvboxMaterialLight;
      break;
    case 'nightOwlLight':
      baseTheme = themes.nightOwlLight;
      break;
    case 'vsDark':
      baseTheme = themes.vsDark;
      break;
    case 'oneDark':
      baseTheme = themes.oneDark;
      break;
    case 'gruvboxMaterialDark':
      baseTheme = themes.gruvboxMaterialDark;
      break;
    case 'nightOwl':
      baseTheme = themes.nightOwl;
      break;
    case 'dracula':
      baseTheme = themes.dracula;
      break;
    case 'okaidia':
      baseTheme = themes.okaidia;
      break;
    default:
      baseTheme = themes.vsDark; // Default to VS Dark
  }

  return removeBackgrounds(baseTheme);
}

export function getThemesForBackgroundColor(backgroundColor: 'light' | 'dark') {
  return backgroundColor === 'light' ? LIGHT_THEMES : DARK_THEMES;
}

export function isValidThemeForBackground(
  themeId: string,
  backgroundColor: 'light' | 'dark',
): boolean {
  const availableThemes = getThemesForBackgroundColor(backgroundColor);
  return availableThemes.some((theme) => theme.id === themeId);
}
