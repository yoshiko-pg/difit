import type { BaseMode, Comment, CommentThread, DiffSide } from '../types/diff';

import { hasSuggestionBlock, parseSuggestionBlocks } from './suggestionUtils.js';

function getLineInfo(line: number | number[]): string {
  return typeof line === 'number' ? `L${line}` : `L${line[0]}-L${line[1]}`;
}

export interface CommentPromptDiffContext {
  requestedBaseCommitish?: string;
  requestedTargetCommitish?: string;
  baseMode?: BaseMode;
  resolvedBaseCommitish?: string;
  resolvedTargetCommitish?: string;
}

function formatCommentLocation(file: string, line: number | number[], side?: DiffSide): string {
  const filePath = file || '<unknown file>';
  return `${filePath}:${getLineInfo(line)}${side ? ` side=${side}` : ''}`;
}

function formatDiffContextHeader(context: CommentPromptDiffContext): string {
  const resolvedBaseCommitish =
    context.resolvedBaseCommitish !== context.requestedBaseCommitish
      ? context.resolvedBaseCommitish
      : undefined;
  const resolvedTargetCommitish =
    context.resolvedTargetCommitish !== context.requestedTargetCommitish
      ? context.resolvedTargetCommitish
      : undefined;
  const fields = [
    context.requestedBaseCommitish ? `base=${context.requestedBaseCommitish}` : '',
    context.requestedTargetCommitish ? `target=${context.requestedTargetCommitish}` : '',
    context.baseMode ? `mode=${context.baseMode}` : '',
    resolvedBaseCommitish ? `resolved-base=${resolvedBaseCommitish}` : '',
    resolvedTargetCommitish ? `resolved-target=${resolvedTargetCommitish}` : '',
  ].filter(Boolean);

  return ['diff', ...fields].join(' ');
}

function formatCommentContent(body: string, codeContent?: string): string {
  if (hasSuggestionBlock(body)) {
    const suggestions = parseSuggestionBlocks(body);
    if (suggestions.length > 0) {
      let result = '';
      let lastIndex = 0;

      for (const suggestion of suggestions) {
        const textBefore = body.slice(lastIndex, suggestion.startIndex).trim();
        if (textBefore) {
          result += `${result ? '\n' : ''}${textBefore}`;
        }

        if (codeContent) {
          result += `${result ? '\n' : ''}ORIGINAL:\n\`\`\`\n${codeContent}\n\`\`\``;
        }
        result += `${result ? '\n' : ''}SUGGESTED:\n\`\`\`\n${suggestion.suggestedCode}\n\`\`\``;
        lastIndex = suggestion.endIndex;
      }

      const textAfter = body.slice(lastIndex).trim();
      if (textAfter) {
        result += `${result ? '\n' : ''}${textAfter}`;
      }

      return result;
    }
  }

  return body;
}

function normalizeLegacyComment(comment: Comment): CommentThread {
  return {
    id: comment.id,
    file: comment.file,
    line: comment.line,
    side: comment.side,
    createdAt: comment.timestamp,
    updatedAt: comment.timestamp,
    codeContent: comment.codeContent,
    messages: [
      {
        id: comment.id,
        body: comment.body,
        author: comment.author,
        createdAt: comment.timestamp,
        updatedAt: comment.timestamp,
      },
    ],
  };
}

export function formatCommentPrompt(
  file: string,
  line: number | number[],
  body: string,
  codeContent?: string,
  side?: DiffSide,
): string {
  return `${formatCommentLocation(file, line, side)}\n${formatCommentContent(body, codeContent)}`;
}

export function formatAllCommentsPrompt(comments: Comment[]): string {
  if (comments.length === 0) return '';

  const prompts = comments.map((comment) =>
    formatCommentPrompt(
      comment.file,
      comment.line,
      comment.body,
      comment.codeContent,
      comment.side,
    ),
  );

  return prompts.join('\n=====\n');
}

export function formatCommentThreadPrompt(thread: CommentThread): string {
  const sections: string[] = [formatCommentLocation(thread.file, thread.line, thread.side)];

  thread.messages.forEach((message, index) => {
    if (index === 0) {
      sections.push(formatCommentContent(message.body, thread.codeContent));
      return;
    }

    const replyIndex = index;
    const authorLabel = message.author?.trim() || 'Unknown';
    sections.push(`Reply ${replyIndex} (${authorLabel})`);
    sections.push(formatCommentContent(message.body, thread.codeContent));
  });

  return sections.filter(Boolean).join('\n');
}

export function formatAllCommentThreadsPrompt(
  threads: CommentThread[],
  context?: CommentPromptDiffContext,
): string {
  if (threads.length === 0) return '';

  const sections = threads.map((thread) => formatCommentThreadPrompt(thread));
  if (context) {
    sections.unshift(formatDiffContextHeader(context));
  }

  return sections.join('\n=====\n');
}

export function formatCommentsOutput(input: Comment[] | CommentThread[]): string {
  const threads = input.map((item) => ('messages' in item ? item : normalizeLegacyComment(item)));
  const allPrompts = formatAllCommentThreadsPrompt(threads);

  return [
    '\n📝 Comments from review session:',
    '='.repeat(50),
    allPrompts,
    '='.repeat(50),
    `Total comments: ${threads.length}\n`,
  ].join('\n');
}
