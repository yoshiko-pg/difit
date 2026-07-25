import { load } from 'js-yaml';

const FRONTMATTER_PATTERN = /^---\r?\n(?:([\s\S]*?)\r?\n)?---\r?\n?/;

export function extractFrontmatter(text: string): {
  data: Record<string, unknown> | null;
  content: string;
} {
  const match = text.match(FRONTMATTER_PATTERN);
  if (!match) {
    return { data: null, content: text };
  }

  const content = text.slice(match[0].length);
  const yamlSource = match[1];

  if (yamlSource === undefined) {
    return { data: null, content };
  }

  try {
    const parsed: unknown = load(yamlSource);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { data: parsed as Record<string, unknown>, content };
    }
    return { data: null, content };
  } catch {
    return { data: null, content: text };
  }
}

/**
 * Returns the individual lines occupied by the leading YAML frontmatter block,
 * including the enclosing `---` delimiters. Returns an empty array when the text
 * has no frontmatter. Trailing carriage returns are stripped so the values can
 * be compared directly against diff line content.
 */
export function getFrontmatterLines(text: string): string[] {
  const match = text.match(FRONTMATTER_PATTERN);
  if (!match) {
    return [];
  }

  const matched = match[0].replace(/\r?\n$/, '');
  return matched.split('\n').map((line) => line.replace(/\r$/, ''));
}
