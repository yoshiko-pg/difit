import { useState, useEffect, useCallback } from 'react';

import { type DiffComment, type DiffSide } from '../../types/diff';
import { formatCommentPrompt, formatAllCommentsPrompt } from '../../utils/commentFormatting';
import { storageService } from '../services/StorageService';
import { getLanguageFromPath } from '../utils/diffUtils';

export interface AddCommentParams {
  filePath: string;
  body: string;
  side: DiffSide;
  line: number | { start: number; end: number };
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
  branchToHash?: Map<string, string>,
  repositoryId?: string,
): UseDiffCommentsReturn {
  const [comments, setComments] = useState<DiffComment[]>([]);

  // Load comments from storage when commitish changes
  useEffect(() => {
    if (!baseCommitish || !targetCommitish) return;

    const loadedComments = storageService.getComments(
      baseCommitish,
      targetCommitish,
      currentCommitHash,
      branchToHash,
      repositoryId,
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync state from external storage on prop change
    setComments(loadedComments);
  }, [baseCommitish, targetCommitish, currentCommitHash, branchToHash, repositoryId]);

  // Save comments to storage
  const saveComments = useCallback(
    (newComments: DiffComment[]) => {
      if (!baseCommitish || !targetCommitish) return;

      storageService.saveComments(
        baseCommitish,
        targetCommitish,
        newComments,
        currentCommitHash,
        branchToHash,
        repositoryId,
      );
      setComments(newComments);
    },
    [baseCommitish, targetCommitish, currentCommitHash, branchToHash, repositoryId],
  );

  const addComment = useCallback(
    (params: AddCommentParams): DiffComment => {
      const newComment: DiffComment = {
        id: crypto.randomUUID(),
        filePath: params.filePath,
        body: params.body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
    [comments, saveComments],
  );

  const removeComment = useCallback(
    (commentId: string) => {
      const newComments = comments.filter((c) => c.id !== commentId);
      saveComments(newComments);
    },
    [comments, saveComments],
  );

  const updateComment = useCallback(
    (commentId: string, newBody: string) => {
      const newComments = comments.map((c) =>
        c.id === commentId ? { ...c, body: newBody, updatedAt: new Date().toISOString() } : c,
      );
      saveComments(newComments);
    },
    [comments, saveComments],
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
    [comments],
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
