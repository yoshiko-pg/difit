import { Highlight, type Token, type RenderProps } from 'prism-react-renderer';
import React, { useCallback } from 'react';

import { useHighlightedCode } from '../hooks/useHighlightedCode';
import { getPrismLanguageFromFilename } from '../utils/languageDetection';
import Prism from '../utils/prism';
import { getSyntaxTheme } from '../utils/syntaxThemes';

import type { AppearanceSettings } from './SettingsModal';

export interface PrismSyntaxHighlighterProps {
  code: string;
  language?: string;
  className?: string;
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
  filename?: string;
  renderToken?: (
    token: Token,
    key: number,
    getTokenProps: (options: { token: Token }) => Record<string, unknown>,
  ) => React.ReactNode;
  onMouseOver?: (e: React.MouseEvent) => void;
  onMouseOut?: (e: React.MouseEvent) => void;
}

export const PrismSyntaxHighlighter = React.memo(function PrismSyntaxHighlighter({
  code,
  language,
  className,
  syntaxTheme = 'vsDark',
  filename = '',
  renderToken,
  onMouseOver,
  onMouseOut,
}: PrismSyntaxHighlighterProps) {
  const detectedLang = language || (filename ? getPrismLanguageFromFilename(filename) : 'text');
  const { actualLang } = useHighlightedCode(code, detectedLang);
  const theme = getSyntaxTheme(syntaxTheme);

  // Memoize the render function to prevent recreation on every render
  const renderHighlight = useCallback(
    ({ style, tokens, getLineProps, getTokenProps }: RenderProps) => (
      <span
        className={className}
        style={{ ...style, background: 'transparent', backgroundColor: 'transparent' }}
        onMouseOver={onMouseOver}
        onMouseOut={onMouseOut}
      >
        {tokens.map((line, i) => (
          <span key={i} {...getLineProps({ line })}>
            {line.map((token, key) =>
              renderToken ? (
                renderToken(token, key, getTokenProps)
              ) : (
                <span key={key} {...getTokenProps({ token })} />
              ),
            )}
          </span>
        ))}
      </span>
    ),
    [className, onMouseOver, onMouseOut, renderToken],
  );

  return (
    <Highlight code={code} language={actualLang} theme={theme} prism={Prism}>
      {renderHighlight}
    </Highlight>
  );
});
