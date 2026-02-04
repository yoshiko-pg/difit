import { describe, it, expect } from 'vitest';

import {
  hasSuggestionBlock,
  parseSuggestionBlocks,
  createSuggestionTemplate,
  extractFirstSuggestion,
  formatSuggestionForPrompt,
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

    it('should pass through originalCode and language', () => {
      const body = `\`\`\`suggestion
new code
\`\`\``;
      const result = parseSuggestionBlocks(body, 'old code', 'typescript');
      expect(result[0].originalCode).toBe('old code');
      expect(result[0].language).toBe('typescript');
    });

    it('should use empty string for originalCode when not provided', () => {
      const body = `\`\`\`suggestion
code
\`\`\``;
      const result = parseSuggestionBlocks(body);
      expect(result[0].originalCode).toBe('');
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

  describe('extractFirstSuggestion', () => {
    it('should extract the first suggestion from body', () => {
      const body = `Comment with suggestions:
\`\`\`suggestion
first code
\`\`\`
\`\`\`suggestion
second code
\`\`\``;
      const result = extractFirstSuggestion(body);
      expect(result).toBe('first code');
    });

    it('should return null when no suggestions exist', () => {
      const body = 'Regular comment without suggestions';
      const result = extractFirstSuggestion(body);
      expect(result).toBeNull();
    });
  });

  describe('formatSuggestionForPrompt', () => {
    it('should format suggestion with single line number', () => {
      const result = formatSuggestionForPrompt(
        'src/Button.tsx',
        42,
        'const old = 1;',
        'const new = 2;',
      );
      expect(result).toContain('src/Button.tsx:L42');
      expect(result).toContain('ORIGINAL:');
      expect(result).toContain('const old = 1;');
      expect(result).toContain('SUGGESTED:');
      expect(result).toContain('const new = 2;');
    });

    it('should format suggestion with line range', () => {
      const result = formatSuggestionForPrompt(
        'src/utils.ts',
        [10, 20],
        'original code',
        'suggested code',
      );
      expect(result).toContain('src/utils.ts:L10-L20');
      expect(result).toContain('original code');
      expect(result).toContain('suggested code');
    });

    it('should handle multi-line code in both original and suggested', () => {
      const originalCode = `function old() {
  return 1;
}`;
      const suggestedCode = `function new() {
  return 2;
}`;
      const result = formatSuggestionForPrompt('src/func.ts', [1, 3], originalCode, suggestedCode);
      expect(result).toContain('function old()');
      expect(result).toContain('function new()');
    });
  });
});
