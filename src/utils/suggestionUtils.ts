// Suggestion block parsed from comment body (GitHub-style ```suggestion blocks)
interface SuggestionBlock {
  suggestedCode: string; // The suggested replacement code
  startIndex: number; // Start position in the comment body
  endIndex: number; // End position in the comment body
}

/**
 * Check if a comment body contains any suggestion blocks
 */
export function hasSuggestionBlock(body: string): boolean {
  return /```suggestion\n([\s\S]*?)```/.test(body);
}

/**
 * Parse all suggestion blocks from a comment body.
 * Pure parser: only extracts suggestion blocks and their positions from the body text.
 */
export function parseSuggestionBlocks(body: string): SuggestionBlock[] {
  const blocks: SuggestionBlock[] = [];
  const regex = /```suggestion\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(body)) !== null) {
    blocks.push({
      suggestedCode: match[1].replace(/\n$/, ''), // Remove trailing newline
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return blocks;
}

/**
 * Create a suggestion template with the given code
 */
export function createSuggestionTemplate(code: string): string {
  // Ensure code ends with a newline for proper formatting
  const normalizedCode = code.endsWith('\n') ? code : code + '\n';
  return `\`\`\`suggestion\n${normalizedCode}\`\`\``;
}
