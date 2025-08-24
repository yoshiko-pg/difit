import { useState, useEffect, useCallback } from 'react';

import { type DiffComment } from '../../types/diff';
import { formatCommentPrompt, formatAllCommentsPrompt } from '../../utils/commentFormatting';
import { storageService } from '../services/StorageService';
import { getLanguageFromPath } from '../utils/diffUtils';

export interface AddCommentParams {
  filePath: string;
  body: string;
  side: 'old' | 'new';
  line: number | { start: number; end: number };
  chunkHeader: string;
  codeSnapshot?: DiffComment['codeSnapshot'];
}

export interface UseDiffCommentsReturn {
  comments: DiffComment[];
  addComment: (params: AddCommentParams) => DiffComment;
  removeComment: (commentId: string) => void;
  updateComment: (commentId: string, newBody: string) => void;
  clearAllComments: () => void;
  generatePrompt: (commentId: string) => string;
  generateAllCommentsPrompt: () => string;
}

export function useDiffComments(
  baseCommitish?: string,
  targetCommitish?: string,
  currentCommitHash?: string,
  branchToHash?: Map<string, string>
): UseDiffCommentsReturn {
  const [comments, setComments] = useState<DiffComment[]>([]);

  // Load comments from storage
  useEffect(() => {
    if (!baseCommitish || !targetCommitish) return;

    const loadedComments = storageService.getComments(
      baseCommitish,
      targetCommitish,
      currentCommitHash,
      branchToHash
    );
    setComments(loadedComments);
  }, [baseCommitish, targetCommitish, currentCommitHash, branchToHash]);

  // Save comments to storage
  const saveComments = useCallback(
    (newComments: DiffComment[]) => {
      if (!baseCommitish || !targetCommitish) return;

      storageService.saveComments(
        baseCommitish,
        targetCommitish,
        newComments,
        currentCommitHash,
        branchToHash
      );
      setComments(newComments);
    },
    [baseCommitish, targetCommitish, currentCommitHash, branchToHash]
  );

  const addComment = useCallback(
    (params: AddCommentParams): DiffComment => {
      const newComment: DiffComment = {
        id: crypto.randomUUID(),
        filePath: params.filePath,
        body: params.body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        chunkHeader: params.chunkHeader,
        position: {
          side: params.side,
          line: params.line,
        },
        codeSnapshot: params.codeSnapshot || {
          content: '',
          language: getLanguageFromPath(params.filePath),
        },
      };

      const newComments = [...comments, newComment];
      saveComments(newComments);
      return newComment;
    },
    [comments, saveComments]
  );

  const removeComment = useCallback(
    (commentId: string) => {
      const newComments = comments.filter((c) => c.id !== commentId);
      saveComments(newComments);
    },
    [comments, saveComments]
  );

  const updateComment = useCallback(
    (commentId: string, newBody: string) => {
      const newComments = comments.map((c) =>
        c.id === commentId ? { ...c, body: newBody, updatedAt: new Date().toISOString() } : c
      );
      saveComments(newComments);
    },
    [comments, saveComments]
  );

  const clearAllComments = useCallback(() => {
    saveComments([]);
  }, [saveComments]);

  const generatePrompt = useCallback(
    (commentId: string): string => {
      const comment = comments.find((c) => c.id === commentId);
      if (!comment) return '';

      const line =
        typeof comment.position.line === 'number' ?
          comment.position.line
        : [comment.position.line.start, comment.position.line.end];

      return formatCommentPrompt(comment.filePath, line, comment.body);
    },
    [comments]
  );

  const generateAllCommentsPrompt = useCallback((): string => {
    const transformedComments = comments.map((comment) => ({
      id: comment.id,
      file: comment.filePath,
      line:
        typeof comment.position.line === 'number' ?
          comment.position.line
        : ([comment.position.line.start, comment.position.line.end] as [number, number]),
      body: comment.body,
      timestamp: comment.createdAt,
    }));

    return formatAllCommentsPrompt(transformedComments);
  }, [comments]);

  return {
    comments,
    addComment,
    removeComment,
    updateComment,
    clearAllComments,
    generatePrompt,
    generateAllCommentsPrompt,
  };
}
