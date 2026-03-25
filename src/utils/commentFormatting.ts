import type { Comment } from '../types/diff';

import { hasSuggestionBlock, parseSuggestionBlocks } from './suggestionUtils.js';

export function formatCommentPrompt(
  file: string,
  line: number | number[],
  body: string,
  codeContent?: string,
): string {
  const lineInfo =
    typeof line === 'number' ? `L${line}` : Array.isArray(line) ? `L${line[0]}-L${line[1]}` : '';

  // Handle undefined or null file paths
  const filePath = file || '<unknown file>';

  // Check if body contains suggestion blocks
  if (hasSuggestionBlock(body)) {
    const suggestions = parseSuggestionBlocks(body);
    if (suggestions.length > 0) {
      let result = `${filePath}:${lineInfo}`;

      // Walk through body preserving text between suggestion blocks
      let lastIndex = 0;
      for (const suggestion of suggestions) {
        // Add text before this suggestion block
        const textBefore = body.slice(lastIndex, suggestion.startIndex).trim();
        if (textBefore) {
          result += `\n${textBefore}`;
        }

        // Add structured ORIGINAL/SUGGESTED format
        if (codeContent) {
          result += `\nORIGINAL:\n\`\`\`\n${codeContent}\n\`\`\``;
        }
        result += `\nSUGGESTED:\n\`\`\`\n${suggestion.suggestedCode}\n\`\`\``;

        lastIndex = suggestion.endIndex;
      }

      // Add remaining text after the last suggestion block
      const textAfter = body.slice(lastIndex).trim();
      if (textAfter) {
        result += `\n${textAfter}`;
      }

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
