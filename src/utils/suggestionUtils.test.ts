import { describe, it, expect } from 'vitest';

import {
  hasSuggestionBlock,
  parseSuggestionBlocks,
  createSuggestionTemplate,
} from './suggestionUtils';

describe('suggestionUtils', () => {
  describe('hasSuggestionBlock', () => {
    it('should return true when suggestion block exists', () => {
      const body = `Some comment text
\`\`\`suggestion
const x = 42;
\`\`\`
More text`;
      expect(hasSuggestionBlock(body)).toBe(true);
    });

    it('should return false when no suggestion block exists', () => {
      const body = 'Just a regular comment without any code blocks';
      expect(hasSuggestionBlock(body)).toBe(false);
    });

    it('should return false for regular code blocks', () => {
      const body = `\`\`\`typescript
const x = 42;
\`\`\``;
      expect(hasSuggestionBlock(body)).toBe(false);
    });

    it('should handle multiple calls correctly (regex state reset)', () => {
      const body = `\`\`\`suggestion
code
\`\`\``;
      expect(hasSuggestionBlock(body)).toBe(true);
      expect(hasSuggestionBlock(body)).toBe(true);
    });
  });

  describe('parseSuggestionBlocks', () => {
    it('should parse single suggestion block', () => {
      const body = `Some comment text
\`\`\`suggestion
const x = 42;
\`\`\`
More text`;
      const result = parseSuggestionBlocks(body);
      expect(result).toHaveLength(1);
      expect(result[0].suggestedCode).toBe('const x = 42;');
    });

    it('should parse multiple suggestion blocks', () => {
      const body = `First suggestion:
\`\`\`suggestion
const a = 1;
\`\`\`
Second suggestion:
\`\`\`suggestion
const b = 2;
\`\`\``;
      const result = parseSuggestionBlocks(body);
      expect(result).toHaveLength(2);
      expect(result[0].suggestedCode).toBe('const a = 1;');
      expect(result[1].suggestedCode).toBe('const b = 2;');
    });

    it('should return empty array for no suggestions', () => {
      const body = 'Just a regular comment';
      const result = parseSuggestionBlocks(body);
      expect(result).toHaveLength(0);
    });

    it('should include start and end indices', () => {
      const body = `Text before\`\`\`suggestion
code
\`\`\`text after`;
      const result = parseSuggestionBlocks(body);
      expect(result).toHaveLength(1);
      expect(result[0].startIndex).toBe(11); // Position of first backtick
      expect(result[0].endIndex).toBeGreaterThan(result[0].startIndex);
    });

    it('should preserve multi-line suggested code', () => {
      const body = `\`\`\`suggestion
function example() {
  return {
    value: 42,
  };
}
\`\`\``;
      const result = parseSuggestionBlocks(body);
      expect(result).toHaveLength(1);
      expect(result[0].suggestedCode).toContain('function example()');
      expect(result[0].suggestedCode).toContain('return {');
      expect(result[0].suggestedCode).toContain('value: 42');
    });
  });

  describe('createSuggestionTemplate', () => {
    it('should create proper template', () => {
      const code = 'const x = 1;';
      const result = createSuggestionTemplate(code);
      expect(result).toBe('```suggestion\nconst x = 1;\n```');
    });

    it('should handle code that already ends with newline', () => {
      const code = 'const x = 1;\n';
      const result = createSuggestionTemplate(code);
      expect(result).toBe('```suggestion\nconst x = 1;\n```');
    });

    it('should handle multi-line code', () => {
      const code = 'const x = 1;\nconst y = 2;';
      const result = createSuggestionTemplate(code);
      expect(result).toBe('```suggestion\nconst x = 1;\nconst y = 2;\n```');
    });

    it('should handle empty code', () => {
      const result = createSuggestionTemplate('');
      expect(result).toBe('```suggestion\n\n```');
    });
  });
});
