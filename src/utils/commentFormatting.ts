import type { Comment } from '../types/diff';

import { hasSuggestionBlock, extractFirstSuggestion } from './suggestionUtils.js';

export function formatCommentPrompt(
  file: string,
  line: number | number[],
  body: string,
  codeContent?: string,
): string {
  const lineInfo =
    typeof line === 'number' ? `L${line}`
    : Array.isArray(line) ? `L${line[0]}-L${line[1]}`
    : '';

  // Handle undefined or null file paths
  const filePath = file || '<unknown file>';

  // Check if body contains a suggestion block
  if (hasSuggestionBlock(body)) {
    const suggestedCode = extractFirstSuggestion(body);
    if (suggestedCode !== null) {
      // Extract any text before/after the suggestion block as context
      const textBeforeSuggestion = body.split('```suggestion')[0].trim();

      let result = `${filePath}:${lineInfo}`;

      // Add context comment if exists
      if (textBeforeSuggestion) {
        result += `\n${textBeforeSuggestion}`;
      }

      // Add structured ORIGINAL/SUGGESTED format
      if (codeContent) {
        result += `\nORIGINAL:\n\`\`\`\n${codeContent}\n\`\`\``;
      }
      result += `\nSUGGESTED:\n\`\`\`\n${suggestedCode}\n\`\`\``;

      return result;
    }
  }

  // Regular comment without suggestion
  return `${filePath}:${lineInfo}\n${body}`;
}

export function formatAllCommentsPrompt(comments: Comment[]): string {
  if (comments.length === 0) return '';

  const prompts = comments.map((comment) =>
    formatCommentPrompt(comment.file, comment.line, comment.body, comment.codeContent),
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
