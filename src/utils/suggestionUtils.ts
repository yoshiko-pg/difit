import type { SuggestionBlock } from '../types/diff';

// Regex pattern to match GitHub-style suggestion blocks
// Matches: ```suggestion ... ```
const SUGGESTION_BLOCK_REGEX = /```suggestion\n([\s\S]*?)```/g;

/**
 * Check if a comment body contains any suggestion blocks
 */
export function hasSuggestionBlock(body: string): boolean {
  SUGGESTION_BLOCK_REGEX.lastIndex = 0; // Reset regex state
  return SUGGESTION_BLOCK_REGEX.test(body);
}

/**
 * Parse all suggestion blocks from a comment body
 */
export function parseSuggestionBlocks(
  body: string,
  originalCode?: string,
  language?: string,
): SuggestionBlock[] {
  const blocks: SuggestionBlock[] = [];
  const regex = /```suggestion\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(body)) !== null) {
    blocks.push({
      originalCode: originalCode ?? '',
      suggestedCode: match[1].replace(/\n$/, ''), // Remove trailing newline
      language,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return blocks;
}

/**
 * Create a suggestion template with the given code
 */
export function createSuggestionTemplate(code: string, _language?: string): string {
  // Ensure code ends with a newline for proper formatting
  const normalizedCode = code.endsWith('\n') ? code : code + '\n';
  return `\`\`\`suggestion\n${normalizedCode}\`\`\``;
}

/**
 * Extract the suggested code from a comment body (first suggestion only)
 */
export function extractFirstSuggestion(body: string): string | null {
  const blocks = parseSuggestionBlocks(body);
  return blocks.length > 0 ? blocks[0].suggestedCode : null;
}

/**
 * Format a suggestion for prompt output with ORIGINAL/SUGGESTED structure
 */
export function formatSuggestionForPrompt(
  filePath: string,
  line: number | [number, number],
  originalCode: string,
  suggestedCode: string,
): string {
  const lineInfo = typeof line === 'number' ? `L${line}` : `L${line[0]}-L${line[1]}`;

  return `${filePath}:${lineInfo}
ORIGINAL:
\`\`\`
${originalCode}
\`\`\`
SUGGESTED:
\`\`\`
${suggestedCode}
\`\`\``;
}
