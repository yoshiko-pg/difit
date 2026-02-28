import { useEffect, useRef } from 'react';

import { type Comment, type DiffComment, type DiffSide, type LineNumber } from '../../types/diff';

interface UsePreloadedCommentsOptions {
  addComment: (params: {
    filePath: string;
    body: string;
    side: DiffSide;
    line: number | { start: number; end: number };
  }) => DiffComment;
  comments: DiffComment[];
  ready: boolean;
}

function normalizeLineNumber(line: LineNumber): number | { start: number; end: number } {
  if (typeof line === 'number') return line;
  return { start: line[0], end: line[1] };
}

/**
 * Fetches preloaded comments from the server and injects them into the comment state.
 * Also subscribes to SSE for real-time comment updates from external POST /api/comments.
 */
export function usePreloadedComments({ addComment, comments, ready }: UsePreloadedCommentsOptions) {
  const hasLoadedRef = useRef(false);

  // Fetch preloaded comments on mount (once ready)
  useEffect(() => {
    if (!ready || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    fetch('/api/comments')
      .then((res) => (res.ok ? (res.json() as Promise<{ comments: Comment[] }>) : null))
      .then((data) => {
        if (!data?.comments?.length) return;

        const existingIds = new Set(comments.map((c) => c.id));

        for (const comment of data.comments) {
          // Skip if already present (e.g., from localStorage)
          if (existingIds.has(comment.id)) continue;

          addComment({
            filePath: comment.file,
            body: comment.body,
            side: comment.side || 'new',
            line: normalizeLineNumber(comment.line),
          });
        }
      })
      .catch((error) => {
        console.error('Failed to fetch preloaded comments:', error);
      });
  }, [ready, addComment, comments]);

  // Subscribe to SSE comment stream for live updates
  useEffect(() => {
    const eventSource = new EventSource('/api/comments-stream');

    eventSource.onmessage = (event) => {
      if (event.data === 'connected') return;

      try {
        const serverComments = JSON.parse(event.data as string) as Comment[];
        if (!Array.isArray(serverComments)) return;

        // Find comments from the server that don't exist locally
        // This handles externally POSTed comments being reflected to the frontend
        const existingFiles = new Set(
          comments.map((c) => `${c.filePath}:${JSON.stringify(c.position.line)}:${c.body}`),
        );

        for (const sc of serverComments) {
          const key = `${sc.file}:${JSON.stringify(sc.line)}:${sc.body}`;
          if (existingFiles.has(key)) continue;

          addComment({
            filePath: sc.file,
            body: sc.body,
            side: sc.side || 'new',
            line: normalizeLineNumber(sc.line),
          });
        }
      } catch {
        // Ignore parse errors for non-JSON messages
      }
    };

    return () => {
      eventSource.close();
    };
  }, [addComment, comments]);
}
