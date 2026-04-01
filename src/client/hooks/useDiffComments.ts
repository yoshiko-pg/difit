import { useState, useEffect, useCallback } from 'react';

import {
  type CommentImport,
  type CommentThread,
  type DiffContextStorage,
  type DiffCommentThread,
  type DiffSide,
  type LegacyDiffComment,
} from '../../types/diff';
import {
  formatCommentThreadPrompt,
  formatAllCommentThreadsPrompt,
} from '../../utils/commentFormatting';
import { createId } from '../../utils/createId';
import { mergeCommentImports } from '../../utils/commentImports';
import { storageService } from '../services/StorageService';
import { getLanguageFromPath } from '../utils/diffUtils';

interface AddThreadParams {
  filePath: string;
  body: string;
  side: DiffSide;
  line: number | { start: number; end: number };
  codeSnapshot?: DiffCommentThread['codeSnapshot'];
}

interface ReplyToThreadParams {
  threadId: string;
  body: string;
}

interface UseDiffCommentsReturn {
  comments: LegacyDiffComment[];
  threads: DiffCommentThread[];
  addComment: (params: AddThreadParams) => LegacyDiffComment;
  addThread: (params: AddThreadParams) => DiffCommentThread;
  removeComment: (commentId: string) => void;
  replyToThread: (params: ReplyToThreadParams) => void;
  removeThread: (threadId: string) => void;
  updateComment: (commentId: string, newBody: string) => void;
  removeMessage: (threadId: string, messageId: string) => void;
  updateMessage: (threadId: string, messageId: string, newBody: string) => void;
  clearAllComments: (options?: { resetAppliedCommentImportIds?: boolean }) => void;
  applyCommentImports: (imports: CommentImport[], importId: string) => string[];
  generatePrompt: (commentId: string) => string;
  generateThreadPrompt: (threadId: string) => string;
  generateAllCommentsPrompt: () => string;
}

function normalizeThread(thread: DiffCommentThread): CommentThread {
  return {
    id: thread.id,
    file: thread.filePath,
    line:
      typeof thread.position.line === 'number'
        ? thread.position.line
        : ([thread.position.line.start, thread.position.line.end] as [number, number]),
    side: thread.position.side,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    codeContent: thread.codeSnapshot?.content,
    messages: thread.messages,
  };
}

function normalizeRootComment(thread: DiffCommentThread): LegacyDiffComment | null {
  const rootMessage = thread.messages[0];
  if (!rootMessage) return null;

  return {
    id: thread.id,
    filePath: thread.filePath,
    body: rootMessage.body,
    author: rootMessage.author,
    createdAt: rootMessage.createdAt,
    updatedAt: rootMessage.updatedAt,
    position: thread.position,
    codeSnapshot: thread.codeSnapshot,
  };
}

export function useDiffComments(
  baseCommitish?: string,
  targetCommitish?: string,
  currentCommitHash?: string,
  branchToHash?: Map<string, string>,
  repositoryId?: string,
): UseDiffCommentsReturn {
  const [threads, setThreads] = useState<DiffCommentThread[]>([]);

  const loadDiffContextData = useCallback(() => {
    if (!baseCommitish || !targetCommitish) {
      return null;
    }

    return storageService.getDiffContextData(
      baseCommitish,
      targetCommitish,
      currentCommitHash,
      branchToHash,
      repositoryId,
    );
  }, [baseCommitish, targetCommitish, currentCommitHash, branchToHash, repositoryId]);

  const createEmptyDiffContext = useCallback((): DiffContextStorage | null => {
    if (!baseCommitish || !targetCommitish) {
      return null;
    }

    const now = new Date().toISOString();
    return {
      version: 2,
      baseCommitish,
      targetCommitish,
      createdAt: now,
      lastModifiedAt: now,
      threads: [],
      viewedFiles: [],
      appliedCommentImportIds: [],
    };
  }, [baseCommitish, targetCommitish]);

  useEffect(() => {
    if (!baseCommitish || !targetCommitish) return;

    const loadedThreads =
      loadDiffContextData()?.threads ||
      storageService.getCommentThreads(
        baseCommitish,
        targetCommitish,
        currentCommitHash,
        branchToHash,
        repositoryId,
      );
    // oxlint-disable-next-line react-hooks-js/set-state-in-effect -- intentional: sync state from external storage on prop change
    setThreads(loadedThreads);
  }, [
    baseCommitish,
    targetCommitish,
    currentCommitHash,
    branchToHash,
    repositoryId,
    loadDiffContextData,
  ]);

  const saveThreads = useCallback(
    (newThreads: DiffCommentThread[]) => {
      if (!baseCommitish || !targetCommitish) return;

      storageService.saveCommentThreads(
        baseCommitish,
        targetCommitish,
        newThreads,
        currentCommitHash,
        branchToHash,
        repositoryId,
      );
      setThreads(newThreads);
    },
    [baseCommitish, targetCommitish, currentCommitHash, branchToHash, repositoryId],
  );

  const addThread = useCallback(
    (params: AddThreadParams): DiffCommentThread => {
      const now = new Date().toISOString();
      const threadId = createId();
      const newThread: DiffCommentThread = {
        id: threadId,
        filePath: params.filePath,
        createdAt: now,
        updatedAt: now,
        position: {
          side: params.side,
          line: params.line,
        },
        codeSnapshot: params.codeSnapshot || {
          content: '',
          language: getLanguageFromPath(params.filePath),
        },
        messages: [
          {
            id: threadId,
            body: params.body,
            author: 'User',
            createdAt: now,
            updatedAt: now,
          },
        ],
      };

      const newThreads = [...threads, newThread];
      saveThreads(newThreads);
      return newThread;
    },
    [saveThreads, threads],
  );

  const addComment = useCallback(
    (params: AddThreadParams): LegacyDiffComment => {
      const thread = addThread(params);
      const rootComment = normalizeRootComment(thread);
      if (!rootComment) {
        throw new Error('Failed to create root comment');
      }
      return rootComment;
    },
    [addThread],
  );

  const replyToThread = useCallback(
    ({ threadId, body }: ReplyToThreadParams) => {
      const now = new Date().toISOString();
      const newThreads = threads.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              updatedAt: now,
              messages: [
                ...thread.messages,
                {
                  id: createId(),
                  body,
                  author: 'User',
                  createdAt: now,
                  updatedAt: now,
                },
              ],
            }
          : thread,
      );
      saveThreads(newThreads);
    },
    [saveThreads, threads],
  );

  const removeThread = useCallback(
    (threadId: string) => {
      const newThreads = threads.filter((thread) => thread.id !== threadId);
      saveThreads(newThreads);
    },
    [saveThreads, threads],
  );

  const removeComment = useCallback(
    (commentId: string) => {
      removeThread(commentId);
    },
    [removeThread],
  );

  const removeMessage = useCallback(
    (threadId: string, messageId: string) => {
      const thread = threads.find((item) => item.id === threadId);
      if (!thread) return;

      const targetIndex = thread.messages.findIndex((message) => message.id === messageId);
      if (targetIndex < 0) {
        return;
      }

      if (targetIndex === 0) {
        removeThread(threadId);
        return;
      }

      const now = new Date().toISOString();
      const newThreads = threads.map((item) =>
        item.id === threadId
          ? {
              ...item,
              updatedAt: now,
              messages: item.messages.filter((message) => message.id !== messageId),
            }
          : item,
      );
      saveThreads(newThreads);
    },
    [removeThread, saveThreads, threads],
  );

  const updateMessage = useCallback(
    (threadId: string, messageId: string, newBody: string) => {
      const now = new Date().toISOString();
      const newThreads = threads.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              updatedAt: now,
              messages: thread.messages.map((message) =>
                message.id === messageId ? { ...message, body: newBody, updatedAt: now } : message,
              ),
            }
          : thread,
      );
      saveThreads(newThreads);
    },
    [saveThreads, threads],
  );

  const updateComment = useCallback(
    (commentId: string, newBody: string) => {
      updateMessage(commentId, commentId, newBody);
    },
    [updateMessage],
  );

  const clearAllComments = useCallback(() => {
    saveThreads([]);
  }, [saveThreads]);

  const clearAllCommentsWithOptions = useCallback(
    (options?: { resetAppliedCommentImportIds?: boolean }) => {
      if (!options?.resetAppliedCommentImportIds) {
        clearAllComments();
        return;
      }

      const existingData = loadDiffContextData() || createEmptyDiffContext();
      if (!existingData || !baseCommitish || !targetCommitish) {
        return;
      }

      const nextData: DiffContextStorage = {
        ...existingData,
        threads: [],
        appliedCommentImportIds: [],
      };

      storageService.saveDiffContextData(
        baseCommitish,
        targetCommitish,
        nextData,
        currentCommitHash,
        branchToHash,
        repositoryId,
      );
      setThreads([]);
    },
    [
      baseCommitish,
      targetCommitish,
      branchToHash,
      clearAllComments,
      createEmptyDiffContext,
      currentCommitHash,
      loadDiffContextData,
      repositoryId,
    ],
  );

  const applyCommentImports = useCallback(
    (imports: CommentImport[], importId: string): string[] => {
      if (!baseCommitish || !targetCommitish || imports.length === 0 || importId.length === 0) {
        return [];
      }

      const existingData = loadDiffContextData() || createEmptyDiffContext();
      if (!existingData) {
        return [];
      }

      if (existingData.appliedCommentImportIds.includes(importId)) {
        setThreads(existingData.threads);
        return [];
      }

      const merged = mergeCommentImports(existingData.threads, imports);
      const nextData: DiffContextStorage = {
        ...existingData,
        threads: merged.threads,
        appliedCommentImportIds: [...existingData.appliedCommentImportIds, importId],
      };

      storageService.saveDiffContextData(
        baseCommitish,
        targetCommitish,
        nextData,
        currentCommitHash,
        branchToHash,
        repositoryId,
      );
      setThreads(merged.threads);
      return merged.warnings;
    },
    [
      baseCommitish,
      targetCommitish,
      branchToHash,
      createEmptyDiffContext,
      currentCommitHash,
      loadDiffContextData,
      repositoryId,
    ],
  );

  const generateThreadPrompt = useCallback(
    (threadId: string): string => {
      const thread = threads.find((item) => item.id === threadId);
      if (!thread) return '';

      return formatCommentThreadPrompt(normalizeThread(thread));
    },
    [threads],
  );

  const generatePrompt = useCallback(
    (commentId: string): string => {
      return generateThreadPrompt(commentId);
    },
    [generateThreadPrompt],
  );

  const generateAllCommentsPrompt = useCallback((): string => {
    return formatAllCommentThreadsPrompt(threads.map(normalizeThread));
  }, [threads]);

  const comments = threads
    .map((thread) => normalizeRootComment(thread))
    .filter((comment): comment is LegacyDiffComment => comment !== null);

  return {
    comments,
    threads,
    addComment,
    addThread,
    removeComment,
    replyToThread,
    removeThread,
    updateComment,
    removeMessage,
    updateMessage,
    clearAllComments: clearAllCommentsWithOptions,
    applyCommentImports,
    generatePrompt,
    generateThreadPrompt,
    generateAllCommentsPrompt,
  };
}
