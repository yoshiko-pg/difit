import type { Comment } from '../types/diff';

export function formatCommentPrompt(file: string, line: number | number[], body: string): string {
  const lineInfo =
    typeof line === 'number' ? `L${line}`
    : Array.isArray(line) ? `L${line[0]}-L${line[1]}`
    : '';

  // Handle undefined or null file paths
  const filePath = file || '<unknown file>';

  return `${filePath}:${lineInfo}\n${body}`;
}

export function formatAllCommentsPrompt(comments: Comment[]): string {
  if (comments.length === 0) return '';

  const prompts = comments.map((comment) =>
    formatCommentPrompt(comment.file, comment.line, comment.body)
  );

  return prompts.join('\n=====\n');
}

export function formatCommentsOutput(comments: Comment[]): string {
  const allPrompts = formatAllCommentsPrompt(comments);

  return [
    '\n📝 Comments from review session:',
    '='.repeat(50),
    allPrompts,
    '='.repeat(50),
    `Total comments: ${comments.length}\n`,
  ].join('\n');
}
