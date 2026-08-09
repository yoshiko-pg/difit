import { describe, it, expect } from 'vitest';

import type { Comment, CommentThread } from '../types/diff';

import {
  formatCommentPrompt,
  formatCommentThreadPrompt,
  formatAllCommentsPrompt,
  formatAllCommentThreadsPrompt,
  formatCommentsOutput,
} from './commentFormatting';

describe('commentFormatting', () => {
  describe('formatCommentPrompt', () => {
    it('should format single line number correctly', () => {
      const result = formatCommentPrompt('src/components/Button.tsx', 42, 'Fix accessibility');
      expect(result).toBe('src/components/Button.tsx:L42\nFix accessibility');
    });

    it('should format line range correctly', () => {
      const result = formatCommentPrompt(
        'src/utils/validation.ts',
        [100, 120],
        'Extract validation logic',
      );
      expect(result).toBe('src/utils/validation.ts:L100-L120\nExtract validation logic');
    });

    it('should handle multi-line comment body', () => {
      const body = 'This is a comment\nwith multiple lines\nof text';
      const result = formatCommentPrompt('src/index.ts', 10, body);
      expect(result).toBe('src/index.ts:L10\nThis is a comment\nwith multiple lines\nof text');
    });

    it('should handle file paths with special characters', () => {
      const result = formatCommentPrompt('src/components/@shared/Button.tsx', 15, 'Update styles');
      expect(result).toBe('src/components/@shared/Button.tsx:L15\nUpdate styles');
    });

    it('should handle empty string file path', () => {
      const result = formatCommentPrompt('', 10, 'Comment body');
      expect(result).toBe('<unknown file>:L10\nComment body');
    });

    it('should mark only the old diff side', () => {
      const result = formatCommentPrompt('src/removed.ts', 10, 'Why?', undefined, 'old');
      expect(result).toBe('src/removed.ts:L10 (old)\nWhy?');
      expect(formatCommentPrompt('src/added.ts', 11, 'New line', undefined, 'new')).toBe(
        'src/added.ts:L11\nNew line',
      );
      expect(formatCommentPrompt('src/legacy.ts', 12, 'Legacy comment')).toBe(
        'src/legacy.ts:L12\nLegacy comment',
      );
    });

    it('should format suggestion block with ORIGINAL/SUGGESTED structure', () => {
      const body = `\`\`\`suggestion
const newCode = 42;
\`\`\``;
      const result = formatCommentPrompt('src/file.ts', 10, body, 'const oldCode = 1;');
      expect(result).toContain('src/file.ts:L10');
      expect(result).toContain('ORIGINAL:');
      expect(result).toContain('const oldCode = 1;');
      expect(result).toContain('SUGGESTED:');
      expect(result).toContain('const newCode = 42;');
    });

    it('should format suggestion block with context text', () => {
      const body = `Please refactor this:\n\`\`\`suggestion
const better = true;
\`\`\``;
      const result = formatCommentPrompt('src/file.ts', 10, body, 'const old = false;');
      expect(result).toContain('Please refactor this:');
      expect(result).toContain('ORIGINAL:');
      expect(result).toContain('SUGGESTED:');
    });

    it('should format suggestion block without codeContent', () => {
      const body = `\`\`\`suggestion
const newCode = 42;
\`\`\``;
      const result = formatCommentPrompt('src/file.ts', 10, body);
      expect(result).toContain('src/file.ts:L10');
      expect(result).not.toContain('ORIGINAL:');
      expect(result).toContain('SUGGESTED:');
      expect(result).toContain('const newCode = 42;');
    });
  });

  describe('formatAllCommentThreadsPrompt', () => {
    const timestamp = '2024-01-01T00:00:00Z';
    const threads: CommentThread[] = [
      {
        id: 'old-thread',
        file: 'docs/SUMMARY.md',
        line: 85,
        side: 'old',
        createdAt: timestamp,
        updatedAt: timestamp,
        messages: [
          {
            id: 'old-message',
            body: 'Explain why this was removed.',
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      },
      {
        id: 'new-thread',
        file: 'docs/SUMMARY.md',
        line: [242, 244],
        side: 'new',
        createdAt: timestamp,
        updatedAt: timestamp,
        messages: [
          {
            id: 'new-message',
            body: 'Should this remain grouped?',
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          {
            id: 'reply-message',
            body: 'Related entries are below.',
            author: 'Reviewer',
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      },
    ];

    it('should format a merge-base range with resolved hashes', () => {
      const result = formatAllCommentThreadsPrompt(threads, {
        requestedBaseCommitish: 'main',
        requestedTargetCommitish: 'feature/docs-update',
        baseMode: 'merge-base',
        resolvedBaseCommitish: 'abcdef1',
        resolvedTargetCommitish: '1234567',
      });

      expect(result).toBe(`diff main...feature/docs-update (abcdef1...1234567)
=====
docs/SUMMARY.md:L85 (old)
Explain why this was removed.
=====
docs/SUMMARY.md:L242-L244
Should this remain grouped?
Reply 1 (Reviewer)
Related entries are below.`);
    });

    it('should use a direct range and omit identical resolved refs', () => {
      const result = formatAllCommentThreadsPrompt([threads[1]!], {
        requestedBaseCommitish: 'abcdef1',
        requestedTargetCommitish: '1234567',
        baseMode: 'direct',
        resolvedBaseCommitish: 'abcdef1',
        resolvedTargetCommitish: '1234567',
      });

      expect(result).toBe(`diff abcdef1..1234567
=====
docs/SUMMARY.md:L242-L244
Should this remain grouped?
Reply 1 (Reviewer)
Related entries are below.`);
    });

    it.each(['working', 'staged', '.', 'stdin'])(
      'should omit the header for non-range target %s',
      (target) => {
        const result = formatAllCommentThreadsPrompt([threads[0]!], {
          requestedBaseCommitish: 'HEAD',
          requestedTargetCommitish: target,
          baseMode: 'direct',
          resolvedBaseCommitish: 'abcdef1',
        });

        expect(result).toBe(`docs/SUMMARY.md:L85 (old)
Explain why this was removed.`);
      },
    );

    it('should omit an incomplete resolved range', () => {
      const result = formatAllCommentThreadsPrompt([threads[1]!], {
        requestedBaseCommitish: 'main',
        requestedTargetCommitish: 'feature/docs-update',
        baseMode: 'merge-base',
        resolvedBaseCommitish: 'abcdef1',
      });

      expect(result).toContain('diff main...feature/docs-update\n=====');
      expect(result).not.toContain('abcdef1');
    });

    it('should omit the header when the requested range is incomplete', () => {
      const result = formatAllCommentThreadsPrompt([threads[0]!], {
        requestedTargetCommitish: 'feature/docs-update',
        baseMode: 'merge-base',
        resolvedTargetCommitish: '1234567',
      });

      expect(result).toBe(`docs/SUMMARY.md:L85 (old)
Explain why this was removed.`);
    });

    it('should keep individual thread prompts free of the diff header', () => {
      const result = formatCommentThreadPrompt(threads[0]!);
      expect(result).toBe('docs/SUMMARY.md:L85 (old)\nExplain why this was removed.');
    });
  });

  describe('formatAllCommentsPrompt', () => {
    it('should return empty string for empty comments array', () => {
      const result = formatAllCommentsPrompt([]);
      expect(result).toBe('');
    });

    it('should format single comment without separator', () => {
      const comments: Comment[] = [
        {
          id: '1',
          file: 'src/App.tsx',
          line: 10,
          body: 'Single comment',
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];
      const result = formatAllCommentsPrompt(comments);
      expect(result).toBe('src/App.tsx:L10\nSingle comment');
    });

    it('should format multiple comments with separator', () => {
      const comments: Comment[] = [
        {
          id: '1',
          file: 'src/App.tsx',
          line: 10,
          body: 'First comment',
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          file: 'src/utils/helper.ts',
          line: [20, 25],
          body: 'Second comment',
          timestamp: '2024-01-01T00:01:00Z',
        },
      ];
      const result = formatAllCommentsPrompt(comments);
      expect(result).toBe(
        'src/App.tsx:L10\nFirst comment\n=====\nsrc/utils/helper.ts:L20-L25\nSecond comment',
      );
    });

    it('should preserve comment order', () => {
      const comments: Comment[] = [
        {
          id: '3',
          file: 'third.ts',
          line: 30,
          body: 'Third',
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          id: '1',
          file: 'first.ts',
          line: 10,
          body: 'First',
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          file: 'second.ts',
          line: 20,
          body: 'Second',
          timestamp: '2024-01-01T00:01:00Z',
        },
      ];
      const result = formatAllCommentsPrompt(comments);
      expect(result).toBe(
        'third.ts:L30\nThird\n=====\nfirst.ts:L10\nFirst\n=====\nsecond.ts:L20\nSecond',
      );
    });
  });

  describe('formatCommentsOutput', () => {
    it('should format empty comments with header and footer', () => {
      const result = formatCommentsOutput([]);
      const lines = result.split('\n');
      expect(lines[0]).toBe('');
      expect(lines[1]).toBe('📝 Comments from review session:');
      expect(lines[2]).toBe('='.repeat(50));
      expect(lines[3]).toBe('');
      expect(lines[4]).toBe('='.repeat(50));
      expect(lines[5]).toBe('Total comments: 0');
    });

    it('should format single comment with header and footer', () => {
      const comments: Comment[] = [
        {
          id: '1',
          file: 'src/App.tsx',
          line: 10,
          body: 'Fix this issue',
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];
      const result = formatCommentsOutput(comments);
      expect(result).toContain('📝 Comments from review session:');
      expect(result).toContain('src/App.tsx:L10\nFix this issue');
      expect(result).toContain('Total comments: 1');
      expect(result).toContain('='.repeat(50));
    });

    it('should format multiple comments with separators', () => {
      const comments: Comment[] = [
        {
          id: '1',
          file: 'src/App.tsx',
          line: 10,
          body: 'First issue',
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          file: 'src/utils/helper.ts',
          line: [20, 30],
          body: 'Second issue',
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          id: '3',
          file: 'src/components/Button.tsx',
          line: 42,
          body: 'Third issue',
          timestamp: '2024-01-01T00:02:00Z',
        },
      ];
      const result = formatCommentsOutput(comments);

      expect(result).toContain('📝 Comments from review session:');
      expect(result).toContain('src/App.tsx:L10\nFirst issue');
      expect(result).toContain('=====');
      expect(result).toContain('src/utils/helper.ts:L20-L30\nSecond issue');
      expect(result).toContain('src/components/Button.tsx:L42\nThird issue');
      expect(result).toContain('Total comments: 3');
    });

    it('should handle comments with multi-line bodies', () => {
      const comments: Comment[] = [
        {
          id: '1',
          file: 'src/complex.ts',
          line: [100, 200],
          body: 'This is a complex issue that\nspans multiple lines\nand needs attention',
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];
      const result = formatCommentsOutput(comments);

      expect(result).toContain('src/complex.ts:L100-L200');
      expect(result).toContain(
        'This is a complex issue that\nspans multiple lines\nand needs attention',
      );
      expect(result).toContain('Total comments: 1');
    });
  });
});
