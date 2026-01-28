import { Highlight, type Token, type RenderProps } from 'prism-react-renderer';
import React, { useCallback } from 'react';

import { getFileExtension, getFileName } from '../../utils/fileUtils';
import { useHighlightedCode } from '../hooks/useHighlightedCode';
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
    getTokenProps: (options: { token: Token }) => Record<string, unknown>
  ) => React.ReactNode;
  onMouseOver?: (e: React.MouseEvent) => void;
  onMouseOut?: (e: React.MouseEvent) => void;
}

// Detect language from file extension
function detectLanguage(filename: string): string {
  const basename = getFileName(filename).toLowerCase();
  const ext = getFileExtension(filename);

  // Check for special filenames first
  const filenameMap: Record<string, string> = {
    dockerfile: 'docker',
    makefile: 'makefile',
    '.gitignore': 'git',
    '.env': 'bash',
    '.bashrc': 'bash',
    '.zshrc': 'bash',
    '.bash_profile': 'bash',
    '.profile': 'bash',
  };

  if (filenameMap[basename]) {
    return filenameMap[basename];
  }

  const extensionMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    css: 'css',
    scss: 'css',
    html: 'html',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    md: 'markdown',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    php: 'php',
    sql: 'sql',
    xml: 'xml',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    svelte: 'svelte',
    r: 'r',
    lua: 'lua',
    perl: 'perl',
    pl: 'perl',
    pm: 'perl',
    dockerfile: 'docker',
    makefile: 'makefile',
    gitignore: 'git',
    env: 'bash',
    conf: 'nginx',
    ini: 'ini',
    toml: 'toml',
    sol: 'solidity',
    vim: 'vim',
    dart: 'dart',
    cs: 'csharp',
    proto: 'protobuf',
    tf: 'hcl',
    tfvars: 'hcl',
    hcl: 'hcl',
  };

  return extensionMap[ext || ''] || 'text';
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
  const detectedLang = language || (filename ? detectLanguage(filename) : 'text');
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
              renderToken ?
                renderToken(token, key, getTokenProps)
              : <span key={key} {...getTokenProps({ token })} />
            )}
          </span>
        ))}
      </span>
    ),
    [className, onMouseOver, onMouseOut, renderToken]
  );

  return (
    <Highlight code={code} language={actualLang} theme={theme} prism={Prism}>
      {renderHighlight}
    </Highlight>
  );
});
