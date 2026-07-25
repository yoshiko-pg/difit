import { describe, it, expect } from 'vitest';

import { extractFrontmatter, getFrontmatterLines } from './frontmatter';

describe('extractFrontmatter', () => {
  it('returns null data when there is no frontmatter', () => {
    const text = '# Hello\n\nJust a regular markdown document.';
    expect(extractFrontmatter(text)).toEqual({ data: null, content: text });
  });

  it('returns null data with stripped content for empty frontmatter', () => {
    const text = '---\n---\nBody text.';
    expect(extractFrontmatter(text)).toEqual({ data: null, content: 'Body text.' });
  });

  it('parses valid scalar YAML frontmatter', () => {
    const text = '---\ntitle: Hello\npublished: true\n---\nBody text.';
    const result = extractFrontmatter(text);
    expect(result.data).toEqual({ title: 'Hello', published: true });
    expect(typeof result.data?.title).toBe('string');
    expect(typeof result.data?.published).toBe('boolean');
    expect(result.content).toBe('Body text.');
  });

  it('falls back to the original text on YAML syntax errors', () => {
    const text = '---\n[unclosed\n---\nBody text.';
    expect(extractFrontmatter(text)).toEqual({ data: null, content: text });
  });

  it('returns null data when the top-level YAML value is not an object', () => {
    const text = '---\n42\n---\nBody text.';
    expect(extractFrontmatter(text)).toEqual({ data: null, content: 'Body text.' });
  });

  it('returns empty content when the body is empty', () => {
    const text = '---\ntitle: X\n---\n';
    expect(extractFrontmatter(text)).toEqual({ data: { title: 'X' }, content: '' });
  });
});

describe('getFrontmatterLines', () => {
  it('returns an empty array when there is no frontmatter', () => {
    expect(getFrontmatterLines('# Hello\n\nBody.')).toEqual([]);
  });

  it('returns the delimiter and body lines of the frontmatter block', () => {
    const text = '---\ntitle: Hello\npublished: true\n---\nBody text.';
    expect(getFrontmatterLines(text)).toEqual(['---', 'title: Hello', 'published: true', '---']);
  });

  it('includes both delimiters for empty frontmatter', () => {
    expect(getFrontmatterLines('---\n---\nBody.')).toEqual(['---', '---']);
  });

  it('handles frontmatter at end of file without a trailing newline', () => {
    expect(getFrontmatterLines('---\ntitle: X\n---')).toEqual(['---', 'title: X', '---']);
  });

  it('strips carriage returns from CRLF frontmatter', () => {
    const text = '---\r\ntitle: X\r\n---\r\nBody.';
    expect(getFrontmatterLines(text)).toEqual(['---', 'title: X', '---']);
  });
});
