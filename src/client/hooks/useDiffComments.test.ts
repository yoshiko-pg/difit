import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useDiffComments } from './useDiffComments';

// Mock StorageService
vi.mock('../services/StorageService', () => ({
  storageService: {
    getComments: vi.fn(() => []),
    saveComments: vi.fn(),
    getDiffContextData: vi.fn(() => null),
    saveDiffContextData: vi.fn(),
  },
}));

// Mock diffUtils
vi.mock('../utils/diffUtils', () => ({
  getLanguageFromPath: vi.fn((path: string) => {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    return 'plaintext';
  }),
}));

describe('useDiffComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generatePrompt', () => {
    it('should format single line comment correctly', () => {
      const { result } = renderHook(() => useDiffComments('main', 'feature-branch', 'abc123'));

      act(() => {
        result.current.addComment({
          filePath: 'src/client/components/CommentForm.tsx',
          body: 'コメント内容',
          side: 'new',
          line: 42,
        });
      });

      const comment = result.current.comments[0];
      expect(comment).toBeDefined();
      const prompt = result.current.generatePrompt(comment!.id);

      expect(prompt).toBe('src/client/components/CommentForm.tsx:L42\nコメント内容');
    });

    it('should format multi-line comment correctly', () => {
      const { result } = renderHook(() => useDiffComments('main', 'feature-branch', 'abc123'));

      act(() => {
        result.current.addComment({
          filePath: 'src/client/components/CommentForm.tsx',
          body: '複数行',
          side: 'new',
          line: { start: 36, end: 39 },
        });
      });

      const comment = result.current.comments[0];
      expect(comment).toBeDefined();
      const prompt = result.current.generatePrompt(comment!.id);

      expect(prompt).toBe('src/client/components/CommentForm.tsx:L36-L39\n複数行');
    });

    it('should return empty string for non-existent comment', () => {
      const { result } = renderHook(() => useDiffComments('main', 'feature-branch', 'abc123'));

      const prompt = result.current.generatePrompt('non-existent-id');
      expect(prompt).toBe('');
    });
  });

  describe('generateAllCommentsPrompt', () => {
    it('should return empty string when no comments', () => {
      const { result } = renderHook(() => useDiffComments('main', 'feature-branch', 'abc123'));

      const prompt = result.current.generateAllCommentsPrompt();
      expect(prompt).toBe('');
    });

    it('should format multiple comments with separator', () => {
      const { result } = renderHook(() => useDiffComments('main', 'feature-branch', 'abc123'));

      act(() => {
        result.current.addComment({
          filePath: 'src/client/components/CommentForm.tsx',
          body: '複数行',
          side: 'new',
          line: { start: 36, end: 39 },
        });
      });

      act(() => {
        result.current.addComment({
          filePath: 'src/client/components/CommentForm.tsx',
          body: 'コメント内容',
          side: 'new',
          line: 42,
        });
      });

      const prompt = result.current.generateAllCommentsPrompt();

      // Check if comments are in the correct order
      expect(result.current.comments).toHaveLength(2);
      expect(result.current.comments[0]?.position.line).toEqual({ start: 36, end: 39 });
      expect(result.current.comments[1]?.position.line).toBe(42);

      const expected = `src/client/components/CommentForm.tsx:L36-L39
複数行
=====
src/client/components/CommentForm.tsx:L42
コメント内容`;

      expect(prompt).toBe(expected);
    });

    it('should handle comments from different files', () => {
      const { result } = renderHook(() => useDiffComments('main', 'feature-branch', 'abc123'));

      act(() => {
        result.current.addComment({
          filePath: 'src/client/App.tsx',
          body: 'App comment',
          side: 'new',
          line: 10,
        });
      });

      act(() => {
        result.current.addComment({
          filePath: 'src/server/server.ts',
          body: 'Server comment',
          side: 'new',
          line: { start: 20, end: 25 },
        });
      });

      const prompt = result.current.generateAllCommentsPrompt();

      // Check if comments are in the correct order
      expect(result.current.comments).toHaveLength(2);
      expect(result.current.comments[0]?.filePath).toBe('src/client/App.tsx');
      expect(result.current.comments[1]?.filePath).toBe('src/server/server.ts');

      const expected = `src/client/App.tsx:L10
App comment
=====
src/server/server.ts:L20-L25
Server comment`;

      expect(prompt).toBe(expected);
    });
  });

  describe('comment CRUD operations', () => {
    it('should add comment with code snapshot', () => {
      const { result } = renderHook(() => useDiffComments('main', 'feature-branch', 'abc123'));

      act(() => {
        result.current.addComment({
          filePath: 'src/utils/test.ts',
          body: 'Test comment',
          side: 'new',
          line: 15,
          codeSnapshot: {
            content: 'const x = 42;',
            language: 'typescript',
          },
        });
      });

      expect(result.current.comments).toHaveLength(1);
      const comment = result.current.comments[0];
      expect(comment).toBeDefined();
      expect(comment!.filePath).toBe('src/utils/test.ts');
      expect(comment!.body).toBe('Test comment');
      expect(comment!.position.side).toBe('new');
      expect(comment!.position.line).toBe(15);
      expect(comment!.codeSnapshot?.content).toBe('const x = 42;');
      expect(comment!.codeSnapshot?.language).toBe('typescript');
    });

    it('should remove comment by id', () => {
      const { result } = renderHook(() => useDiffComments('main', 'feature-branch', 'abc123'));

      let commentId: string;
      act(() => {
        const comment = result.current.addComment({
          filePath: 'test.ts',
          body: 'To be removed',
          side: 'new',
          line: 1,
        });
        commentId = comment.id;
      });

      expect(result.current.comments).toHaveLength(1);

      act(() => {
        result.current.removeComment(commentId);
      });

      expect(result.current.comments).toHaveLength(0);
    });

    it('should update comment body', async () => {
      const { result } = renderHook(() => useDiffComments('main', 'feature-branch', 'abc123'));

      let commentId: string;
      act(() => {
        const comment = result.current.addComment({
          filePath: 'test.ts',
          body: 'Original comment',
          side: 'new',
          line: 1,
        });
        commentId = comment.id;
      });

      // Wait a bit to ensure updatedAt timestamp is different
      await new Promise((resolve) => setTimeout(resolve, 10));

      act(() => {
        result.current.updateComment(commentId, 'Updated comment');
      });

      expect(result.current.comments[0]?.body).toBe('Updated comment');
      expect(result.current.comments[0]?.updatedAt).not.toBe(result.current.comments[0]?.createdAt);
    });

    it('should clear all comments', () => {
      const { result } = renderHook(() => useDiffComments('main', 'feature-branch', 'abc123'));

      act(() => {
        result.current.addComment({
          filePath: 'test1.ts',
          body: 'Comment 1',
          side: 'new',
          line: 1,
        });
      });

      act(() => {
        result.current.addComment({
          filePath: 'test2.ts',
          body: 'Comment 2',
          side: 'new',
          line: 2,
        });
      });

      expect(result.current.comments).toHaveLength(2);

      act(() => {
        result.current.clearAllComments();
      });

      expect(result.current.comments).toHaveLength(0);
    });
  });
});
