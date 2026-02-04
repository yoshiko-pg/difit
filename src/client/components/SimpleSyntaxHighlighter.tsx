import { useMemo } from 'react';

import { getSimpleLanguageFromFilename } from '../utils/languageDetection';

interface SimpleSyntaxHighlighterProps {
  code: string;
  language?: string;
  className?: string;
}

// Simple JavaScript/TypeScript highlighting
function highlightJavaScript(code: string): string {
  const keywords =
    /\b(const|let|var|function|return|if|else|for|while|class|import|export|default|async|await|try|catch|finally|throw|new|this|typeof|instanceof)\b/g;
  const strings = /(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g;
  const comments = /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm;
  const numbers = /\b\d+\.?\d*\b/g;

  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(comments, '<span style="color: #8b949e; font-style: italic;">$1</span>')
    .replace(strings, '<span style="color: #a5d6ff;">$1$2$1</span>')
    .replace(keywords, '<span style="color: #ff7b72; font-weight: bold;">$1</span>')
    .replace(numbers, '<span style="color: #79c0ff;">$1</span>');
}

// JSON highlighting
function highlightJSON(code: string): string {
  const strings = /(["'])((?:\\.|(?!\1)[^\\])*?)\1/g;
  const keys = /("(?:\\.|[^"\\])*")(\s*:)/g;
  const numbers = /\b-?\d+\.?\d*\b/g;
  const booleans = /\b(true|false|null)\b/g;

  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(keys, '<span style="color: #7dd3fc;">$1</span>$2')
    .replace(strings, '<span style="color: #a5d6ff;">$1$2$1</span>')
    .replace(numbers, '<span style="color: #79c0ff;">$1</span>')
    .replace(booleans, '<span style="color: #ff7b72;">$1</span>');
}

// CSS highlighting
function highlightCSS(code: string): string {
  const comments = /(\/\*[\s\S]*?\*\/)/g;
  const strings = /(["'])((?:\\.|(?!\1)[^\\])*?)\1/g;
  const hexColors = /(#[0-9a-fA-F]{3,8})\b/g;
  const properties = /(\b[a-z-]+)(\s*:)/g;
  const values = /:\s*([^;{}]+;)/g;

  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(comments, '<span style="color: #8b949e; font-style: italic;">$1</span>')
    .replace(strings, '<span style="color: #a5d6ff;">$1$2$1</span>')
    .replace(hexColors, '<span style="color: #79c0ff;">$1</span>')
    .replace(properties, '<span style="color: #7dd3fc;">$1</span>$2')
    .replace(values, ': <span style="color: #a5d6ff;">$1</span>');
}

function detectLanguage(filename: string): string {
  return getSimpleLanguageFromFilename(filename);
}

let currentFilename = '';

export function setCurrentFilename(filename: string) {
  currentFilename = filename;
}

export function SimpleSyntaxHighlighter({
  code,
  language,
  className,
}: SimpleSyntaxHighlighterProps) {
  const highlightedCode = useMemo(() => {
    const lang = language || detectLanguage(currentFilename);

    try {
      switch (lang) {
        case 'javascript':
        case 'typescript':
          return highlightJavaScript(code);
        case 'json':
          return highlightJSON(code);
        case 'css':
          return highlightCSS(code);
        default:
          return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
    } catch (error) {
      console.warn('Simple syntax highlighting failed:', error);
      return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }, [code, language]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: highlightedCode }} />;
}
