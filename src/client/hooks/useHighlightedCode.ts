import { useEffect, useState } from 'react';

import { loadPrismLanguage } from '../utils/languageLoader';
import Prism from '../utils/prism';

// Languages that are included by default in prism-react-renderer v2
const DEFAULT_LANGUAGES = [
  'markup',
  'html',
  'xml',
  'svg',
  'javascript',
  'js',
  'typescript',
  'ts',
  'jsx',
  'tsx',
  'css',
  'c',
  'cpp',
  'swift',
  'kotlin',
  'objectivec',
  'reason',
  'rust',
  'go',
  'graphql',
  'yaml',
  'yml',
  'json',
  'markdown',
  'md',
  'python',
  'py',
];

export function useHighlightedCode(_code: string, lang: string) {
  const [ready, setReady] = useState(() => {
    // Check if language is already available
    return DEFAULT_LANGUAGES.includes(lang) || !!Prism.languages[lang];
  });

  useEffect(() => {
    // If language is already ready, nothing to do
    if (ready) return;

    // If it's a default language, it should be ready
    if (DEFAULT_LANGUAGES.includes(lang)) {
      // oxlint-disable-next-line react-hooks-js/set-state-in-effect -- intentional: sync state with Prism language availability
      setReady(true);
      return;
    }

    // Try to load the language dynamically
    loadPrismLanguage(lang)
      .then(() => {
        setReady(true);
      })
      .catch(() => {
        // Fall back silently - component will use 'text' language
        setReady(false);
      });
  }, [lang, ready]);

  const actualLang = ready ? lang : 'text';

  return { ready, actualLang };
}
