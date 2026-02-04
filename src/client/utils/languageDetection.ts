import { getFileExtension, getFileName } from '../../utils/fileUtils';

const DIFF_EXTENSION_LANGUAGE_MAP: Record<string, string> = {
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

const SIMPLE_EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ...DIFF_EXTENSION_LANGUAGE_MAP,
  scss: 'css',
};

const PRISM_EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
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

const PRISM_FILENAME_LANGUAGE_MAP: Record<string, string> = {
  dockerfile: 'docker',
  makefile: 'makefile',
  '.gitignore': 'git',
  '.env': 'bash',
  '.bashrc': 'bash',
  '.zshrc': 'bash',
  '.bash_profile': 'bash',
  '.profile': 'bash',
};

function getLanguageFromExtension(
  extension: string | null,
  map: Record<string, string>,
): string | undefined {
  if (!extension) return undefined;
  return map[extension.toLowerCase()];
}

export function getLanguageFromPath(filePath: string): string | undefined {
  return getLanguageFromExtension(getFileExtension(filePath), DIFF_EXTENSION_LANGUAGE_MAP);
}

export function getSimpleLanguageFromFilename(filename: string): string {
  return (
    getLanguageFromExtension(getFileExtension(filename), SIMPLE_EXTENSION_LANGUAGE_MAP) || 'text'
  );
}

export function getPrismLanguageFromFilename(filename: string): string {
  const basename = getFileName(filename).toLowerCase();
  const special = PRISM_FILENAME_LANGUAGE_MAP[basename];
  if (special) return special;
  return (
    getLanguageFromExtension(getFileExtension(filename), PRISM_EXTENSION_LANGUAGE_MAP) || 'text'
  );
}
