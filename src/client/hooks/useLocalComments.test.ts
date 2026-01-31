import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useLocalComments } from './useLocalComments';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useLocalComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('should initialize with empty comments when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalComments('test-commit'));

    expect(result.current.comments).toEqual([]);
  });

  it('should load comments from localStorage on mount', () => {
    const savedComments = [
      {
        id: 'test-id-1',
        file: 'test.ts',
        line: 10,
        body: 'Test comment',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    ];

    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedComments));

    const { result } = renderHook(() => useLocalComments('test-commit'));

    expect(localStorageMock.getItem).toHaveBeenCalledWith('difit-comments-test-commit');
    expect(result.current.comments).toEqual(savedComments);
  });

  it('should add a comment correctly', () => {
    const { result } = renderHook(() => useLocalComments('test-commit'));

    act(() => {
      result.current.addComment('test.ts', 10, 'New comment', 'const x = 1;');
    });

    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0]).toMatchObject({
      file: 'test.ts',
      line: 10,
      body: 'New comment',
      codeContent: 'const x = 1;',
    });
    expect(result.current.comments[0]?.id).toContain('test.ts:10:');
  });

  it('should remove a comment by id', () => {
    const { result } = renderHook(() => useLocalComments('test-commit'));

    // Add two comments
    act(() => {
      result.current.addComment('test.ts', 10, 'Comment 1');
      result.current.addComment('test.ts', 20, 'Comment 2');
    });

    const commentId = result.current.comments[0]!.id;

    act(() => {
      result.current.removeComment(commentId);
    });

    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0]?.body).toBe('Comment 2');
  });

  it('should update a comment body', () => {
    const { result } = renderHook(() => useLocalComments('test-commit'));

    act(() => {
      result.current.addComment('test.ts', 10, 'Original comment');
    });

    const commentId = result.current.comments[0]!.id;

    act(() => {
      result.current.updateComment(commentId, 'Updated comment');
    });

    expect(result.current.comments[0]?.body).toBe('Updated comment');
  });

  it('should clear all comments and remove from localStorage', () => {
    const { result } = renderHook(() => useLocalComments('test-commit'));

    // Add multiple comments
    act(() => {
      result.current.addComment('test.ts', 10, 'Comment 1');
      result.current.addComment('test.ts', 20, 'Comment 2');
      result.current.addComment('other.ts', 5, 'Comment 3');
    });

    expect(result.current.comments).toHaveLength(3);

    act(() => {
      result.current.clearAllComments();
    });

    expect(result.current.comments).toEqual([]);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('difit-comments-test-commit');
  });

  it('should generate prompt for a single comment', () => {
    const { result } = renderHook(() => useLocalComments());

    const comment = {
      id: 'test-id',
      file: 'test.ts',
      line: 10,
      body: 'Fix this bug',
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const prompt = result.current.generatePrompt(comment);

    expect(prompt).toBe('test.ts:L10\nFix this bug');
  });

  it('should generate prompt for a comment with line range', () => {
    const { result } = renderHook(() => useLocalComments());

    const comment = {
      id: 'test-id',
      file: 'test.ts',
      line: [10, 20] as [number, number],
      body: 'Refactor this function',
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const prompt = result.current.generatePrompt(comment);

    expect(prompt).toBe('test.ts:L10-L20\nRefactor this function');
  });

  describe('generatePrompt format tests', () => {
    it('should format single line comment correctly', () => {
      const { result } = renderHook(() => useLocalComments());

      const comment = {
        id: '1',
        file: 'src/components/Button.tsx',
        line: 42,
        body: 'This button should be disabled when form is invalid',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      const prompt = result.current.generatePrompt(comment);

      expect(prompt).toBe(
        'src/components/Button.tsx:L42\nThis button should be disabled when form is invalid',
      );
    });

    it('should format multi-line comment correctly', () => {
      const { result } = renderHook(() => useLocalComments());

      const comment = {
        id: '2',
        file: 'src/utils/validation.ts',
        line: [100, 150] as [number, number],
        body: 'Extract this validation logic into a separate function',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      const prompt = result.current.generatePrompt(comment);

      expect(prompt).toBe(
        'src/utils/validation.ts:L100-L150\nExtract this validation logic into a separate function',
      );
    });

    it('should handle comment body with multiple lines', () => {
      const { result } = renderHook(() => useLocalComments());

      const comment = {
        id: '3',
        file: 'src/api/client.ts',
        line: 25,
        body: 'Add error handling:\n- Network errors\n- Timeout errors\n- Invalid response format',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      const prompt = result.current.generatePrompt(comment);

      expect(prompt).toBe(
        'src/api/client.ts:L25\nAdd error handling:\n- Network errors\n- Timeout errors\n- Invalid response format',
      );
    });

    it('should handle file paths with special characters', () => {
      const { result } = renderHook(() => useLocalComments());

      const comment = {
        id: '4',
        file: 'src/@types/custom-types.d.ts',
        line: 5,
        body: 'Add type definition for CustomWidget',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      const prompt = result.current.generatePrompt(comment);

      expect(prompt).toBe('src/@types/custom-types.d.ts:L5\nAdd type definition for CustomWidget');
    });
  });

  it('should generate prompt for all comments', () => {
    const { result } = renderHook(() => useLocalComments());

    act(() => {
      result.current.addComment('test.ts', 10, 'Comment 1');
      result.current.addComment('test.ts', [20, 25] as [number, number], 'Comment 2');
      result.current.addComment('other.ts', 5, 'Comment 3');
    });

    const allPrompts = result.current.generateAllCommentsPrompt();

    expect(allPrompts).toContain('test.ts:L10\nComment 1');
    expect(allPrompts).toContain('test.ts:L20-L25\nComment 2');
    expect(allPrompts).toContain('other.ts:L5\nComment 3');
    expect(allPrompts).toContain('=====');
  });

  it('should return appropriate message when no comments exist', () => {
    const { result } = renderHook(() => useLocalComments());

    const allPrompts = result.current.generateAllCommentsPrompt();

    expect(allPrompts).toBe('No comments available.');
  });

  describe('generateAllCommentsPrompt format tests', () => {
    it('should format multiple comments correctly with separator', () => {
      const { result } = renderHook(() => useLocalComments());

      act(() => {
        result.current.addComment('src/index.ts', 10, 'Fix import statement');
        result.current.addComment(
          'src/App.tsx',
          [50, 60] as [number, number],
          'Refactor this component',
        );
        result.current.addComment('src/utils/helper.ts', 100, 'Add type annotations');
      });

      const allPrompts = result.current.generateAllCommentsPrompt();
      const expectedOutput =
        'src/index.ts:L10\nFix import statement\n=====\n' +
        'src/App.tsx:L50-L60\nRefactor this component\n=====\n' +
        'src/utils/helper.ts:L100\nAdd type annotations';

      expect(allPrompts).toBe(expectedOutput);
    });

    it('should handle single comment without trailing separator', () => {
      const { result } = renderHook(() => useLocalComments());

      act(() => {
        result.current.addComment('src/main.ts', 42, 'Single comment test');
      });

      const allPrompts = result.current.generateAllCommentsPrompt();

      expect(allPrompts).toBe('src/main.ts:L42\nSingle comment test');
      expect(allPrompts).not.toMatch(/=====$/);
    });

    it('should preserve order of comments', () => {
      const { result } = renderHook(() => useLocalComments());

      act(() => {
        result.current.addComment('first.ts', 1, 'First comment');
        result.current.addComment('second.ts', 2, 'Second comment');
        result.current.addComment('third.ts', 3, 'Third comment');
      });

      const allPrompts = result.current.generateAllCommentsPrompt();
      const lines = allPrompts.split('\n');

      expect(lines[0]).toBe('first.ts:L1');
      expect(lines[1]).toBe('First comment');
      expect(lines[2]).toBe('=====');
      expect(lines[3]).toBe('second.ts:L2');
      expect(lines[4]).toBe('Second comment');
      expect(lines[5]).toBe('=====');
      expect(lines[6]).toBe('third.ts:L3');
      expect(lines[7]).toBe('Third comment');
    });

    it('should handle comments with complex multi-line bodies', () => {
      const { result } = renderHook(() => useLocalComments());

      act(() => {
        result.current.addComment(
          'src/components/Form.tsx',
          [10, 30] as [number, number],
          'Refactor this form component:\n' +
            '1. Extract validation logic\n' +
            '2. Add error handling\n' +
            '3. Improve accessibility',
        );
        result.current.addComment('src/api/auth.ts', 45, 'TODO: Implement refresh token logic');
      });

      const allPrompts = result.current.generateAllCommentsPrompt();

      expect(allPrompts).toBe(
        'src/components/Form.tsx:L10-L30\n' +
          'Refactor this form component:\n' +
          '1. Extract validation logic\n' +
          '2. Add error handling\n' +
          '3. Improve accessibility\n' +
          '=====\n' +
          'src/api/auth.ts:L45\n' +
          'TODO: Implement refresh token logic',
      );
    });
  });

  it('should save comments to localStorage whenever they change', () => {
    const { result } = renderHook(() => useLocalComments('test-commit'));

    act(() => {
      result.current.addComment('test.ts', 10, 'Comment 1');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'difit-comments-test-commit',
      expect.stringContaining('Comment 1'),
    );

    act(() => {
      result.current.clearAllComments();
    });

    // Should set empty array before removing
    expect(localStorageMock.setItem).toHaveBeenCalledWith('difit-comments-test-commit', '[]');
  });

  it('should use default storage key when no commit hash provided', () => {
    const { result } = renderHook(() => useLocalComments());

    act(() => {
      result.current.addComment('test.ts', 10, 'Comment');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith('difit-comments', expect.any(String));
  });

  it('should handle corrupted localStorage data gracefully', () => {
    localStorageMock.getItem.mockReturnValue('invalid json');

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useLocalComments('test-commit'));

    expect(result.current.comments).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to parse saved comments:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });
});
