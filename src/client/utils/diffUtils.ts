import { type DiffFile } from '../../types/diff';

/**
 * Generate SHA-256 hash of diff content
 */
export async function generateDiffHash(diffContent: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(diffContent);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback to simple hash if crypto API is not available
    console.warn('Crypto API not available, using fallback hash');
    return simpleHash(diffContent);
  }
}

/**
 * Simple hash function as fallback
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Generate diff content string for hashing
 */
export function getDiffContentForHashing(file: DiffFile): string {
  // Create a stable string representation of the diff
  const chunks = file.chunks
    .map((chunk) => {
      const lines = chunk.lines
        .filter((line) => line.type !== 'hunk' && line.type !== 'header')
        .map((line) => `${line.type}:${line.content}`)
        .join('\n');
      return `${chunk.header}\n${lines}`;
    })
    .join('\n\n');

  return `${file.path}\n${file.status}\n${chunks}`;
}

/**
 * Extract language from file path
 */
export function getLanguageFromPath(filePath: string): string | undefined {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!ext) return undefined;

  const languageMap: Record<string, string> = {
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    r: 'r',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    json: 'json',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    md: 'markdown',
    markdown: 'markdown',
    tex: 'latex',
    vim: 'vim',
  };

  return languageMap[ext];
}
