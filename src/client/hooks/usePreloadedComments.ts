import { useCallback, useEffect, useRef } from 'react';

import { type Comment, type DiffComment, type DiffSide, type LineNumber } from '../../types/diff';

interface AddCommentParams {
  filePath: string;
  body: string;
  side: DiffSide;
  line: number | { start: number; end: number };
}

interface UsePreloadedCommentsOptions {
  addCommentsBatch: (paramsList: AddCommentParams[]) => void;
  comments: DiffComment[];
  ready: boolean;
}

function normalizeLineNumber(line: LineNumber): number | { start: number; end: number } {
  if (typeof line === 'number') return line;
  return { start: line[0], end: line[1] };
}

function buildExistingKeys(comments: DiffComment[]): Set<string> {
  return new Set(
    comments.map(
      (c) => `${c.filePath}:${c.position.side}:${JSON.stringify(c.position.line)}:${c.body}`,
    ),
  );
}

function filterNewComments(
  serverComments: Comment[],
  existingKeys: Set<string>,
): AddCommentParams[] {
  const result: AddCommentParams[] = [];
  for (const sc of serverComments) {
    // Normalize line before building key so the format matches local keys
    // (server sends [start,end] arrays, local stores {start,end} objects)
    const normalized = normalizeLineNumber(sc.line);
    const side = sc.side === 'old' || sc.side === 'new' ? sc.side : 'new';
    const key = `${sc.file}:${side}:${JSON.stringify(normalized)}:${sc.body}`;
    if (existingKeys.has(key)) continue;
    result.push({
      filePath: sc.file,
      body: sc.body,
      side,
      line: normalized,
    });
  }
  return result;
}

/**
 * Fetches preloaded comments from the server and injects them into the comment state.
 * Also subscribes to SSE for real-time comment updates from external POST /api/comments.
 */
export function usePreloadedComments({
  addCommentsBatch,
  comments,
  ready,
}: UsePreloadedCommentsOptions) {
  const hasLoadedRef = useRef(false);
  // Keep refs so the SSE effect doesn't need to re-run on every change
  const commentsRef = useRef(comments);
  const addCommentsBatchRef = useRef(addCommentsBatch);

  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  useEffect(() => {
    addCommentsBatchRef.current = addCommentsBatch;
  }, [addCommentsBatch]);

  const ingestComments = useCallback((serverComments: Comment[]) => {
    const existingKeys = buildExistingKeys(commentsRef.current);
    const newComments = filterNewComments(serverComments, existingKeys);
    if (newComments.length > 0) {
      addCommentsBatchRef.current(newComments);
    }
  }, []);

  // Fetch preloaded comments on mount (once ready)
  useEffect(() => {
    if (!ready || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    fetch('/api/comments')
      .then((res) => (res.ok ? (res.json() as Promise<{ comments: Comment[] }>) : null))
      .then((data) => {
        if (!data?.comments?.length) return;
        ingestComments(data.comments);
      })
      .catch((error) => {
        console.error('Failed to fetch preloaded comments:', error);
      });
  }, [ready, ingestComments]);

  // Subscribe to SSE comment stream for live updates (stable — no reconnect on comment changes)
  useEffect(() => {
    const eventSource = new EventSource('/api/comments-stream');

    eventSource.onmessage = (event) => {
      if (event.data === 'connected') return;

      try {
        const serverComments = JSON.parse(event.data as string) as Comment[];
        if (!Array.isArray(serverComments)) return;
        ingestComments(serverComments);
      } catch {
        // Ignore parse errors for non-JSON messages
      }
    };

    return () => {
      eventSource.close();
    };
  }, [ingestComments]);
}
