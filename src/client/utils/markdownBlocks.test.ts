import { describe, expect, it } from 'vitest';

import {
  alignMarkdownBlocks,
  diffRenderedText,
  findSourceLinesForText,
  parseMarkdownBlocks,
  type MarkdownBlock,
} from './markdownBlocks';

const block = (
  kind: MarkdownBlock['kind'],
  startLine: number,
  endLine: number,
  source: string,
) => ({
  kind,
  startLine,
  endLine,
  source,
});

describe('parseMarkdownBlocks', () => {
  it('splits top-level blocks with 1-based source line ranges', () => {
    const text = [
      '# Title',
      '',
      'First line',
      'second line',
      '',
      '```ts',
      'const a = 1;',
      '```',
      '',
    ].join('\n');

    expect(parseMarkdownBlocks(text)).toEqual([
      block('heading', 1, 1, '# Title'),
      block('paragraph', 3, 4, 'First line\nsecond line'),
      block('code', 6, 8, '```ts\nconst a = 1;\n```'),
    ]);
  });

  it('splits top-level lists into one block per item and keeps nested lists inside the item', () => {
    const text = ['- one', '  - nested', '- two', '', '3. three'].join('\n');

    expect(parseMarkdownBlocks(text)).toEqual([
      block('listItem', 1, 2, '- one\n  - nested'),
      block('listItem', 3, 3, '- two'),
      block('listItem', 5, 5, '3. three'),
    ]);
  });

  it('keeps frontmatter as its own block and offsets body line numbers', () => {
    const text = ['---', 'title: Hello', '---', '', 'Body text'].join('\n');

    expect(parseMarkdownBlocks(text)).toEqual([
      block('frontmatter', 1, 3, '---\ntitle: Hello\n---'),
      block('paragraph', 5, 5, 'Body text'),
    ]);
  });

  it('parses GFM tables as a single block', () => {
    const text = ['| a | b |', '| - | - |', '| 1 | 2 |'].join('\n');

    expect(parseMarkdownBlocks(text)).toEqual([
      block('table', 1, 3, '| a | b |\n| - | - |\n| 1 | 2 |'),
    ]);
  });

  it('strips carriage returns from block sources', () => {
    expect(parseMarkdownBlocks('Hello\r\nworld\r\n')).toEqual([
      block('paragraph', 1, 2, 'Hello\nworld'),
    ]);
  });
});

describe('alignMarkdownBlocks', () => {
  it('pairs unchanged blocks even when their line numbers shift', () => {
    const oldBlocks = parseMarkdownBlocks('# Title\n\nSame paragraph');
    const newBlocks = parseMarkdownBlocks('# Title\n\nInserted\n\nSame paragraph');

    expect(alignMarkdownBlocks(oldBlocks, newBlocks)).toEqual([
      { type: 'unchanged', old: oldBlocks[0], new: newBlocks[0] },
      { type: 'added', new: newBlocks[1] },
      { type: 'unchanged', old: oldBlocks[1], new: newBlocks[2] },
    ]);
  });

  it('pairs an edited block with its most similar counterpart instead of by position', () => {
    const oldBlocks = parseMarkdownBlocks(
      'Intro\n\nThe quick brown fox jumps over the dog.\n\nOutro',
    );
    const newBlocks = parseMarkdownBlocks(
      'Intro\n\nA completely new paragraph here.\n\nThe quick brown fox leaps over the dog.\n\nOutro',
    );

    expect(alignMarkdownBlocks(oldBlocks, newBlocks)).toEqual([
      { type: 'unchanged', old: oldBlocks[0], new: newBlocks[0] },
      { type: 'added', new: newBlocks[1] },
      { type: 'modified', old: oldBlocks[1], new: newBlocks[2] },
      { type: 'unchanged', old: oldBlocks[2], new: newBlocks[3] },
    ]);
  });

  it('keeps dissimilar replacements side by side as modified rows', () => {
    const oldBlocks = parseMarkdownBlocks('Alpha beta gamma\n\nKeep');
    const newBlocks = parseMarkdownBlocks('Zulu yankee xray\n\nKeep');

    expect(alignMarkdownBlocks(oldBlocks, newBlocks)).toEqual([
      { type: 'modified', old: oldBlocks[0], new: newBlocks[0] },
      { type: 'unchanged', old: oldBlocks[1], new: newBlocks[1] },
    ]);
  });

  it('marks every block as removed when the new side is empty', () => {
    const oldBlocks = parseMarkdownBlocks('# A\n\nB');

    expect(alignMarkdownBlocks(oldBlocks, [])).toEqual([
      { type: 'removed', old: oldBlocks[0] },
      { type: 'removed', old: oldBlocks[1] },
    ]);
  });
});

describe('diffRenderedText', () => {
  it('returns character ranges for removed and added words', () => {
    const result = diffRenderedText('The quick fox', 'The slow fox');

    expect(result.oldRanges).toEqual([[4, 9]]);
    expect(result.newRanges).toEqual([[4, 8]]);
    expect(result.unchangedRatio).toBeCloseTo(8 / 17);
  });

  it('splits Japanese text into words instead of highlighting the whole sentence', () => {
    const result = diffRenderedText('今日は晴れです。', '今日は雨です。');

    expect(result.oldRanges).toEqual([[3, 5]]);
    expect(result.newRanges).toEqual([[3, 4]]);
  });
});

describe('findSourceLinesForText', () => {
  const source = [
    'This is the **first** line',
    'and a [linked](https://example.com) second',
    'third',
  ];

  it('narrows a selection to the source lines that contain it', () => {
    expect(findSourceLinesForText(source, 10, 'linked second')).toEqual({ start: 11, end: 11 });
  });

  it('spans several lines when the selection crosses a source line break', () => {
    expect(findSourceLinesForText(source, 10, 'first line and a linked')).toEqual({
      start: 10,
      end: 11,
    });
  });

  it('ignores blank lines between paragraphs', () => {
    expect(findSourceLinesForText(['> first', '>', '> second'], 1, 'first\n\nsecond')).toEqual({
      start: 1,
      end: 3,
    });
  });

  it('returns null when the text cannot be located', () => {
    expect(findSourceLinesForText(source, 10, 'not in the block')).toBeNull();
  });
});
