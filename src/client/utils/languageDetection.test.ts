import { describe, it, expect } from 'vitest';

import { isWholeFileHighlightExtension } from './languageDetection';

describe('languageDetection', () => {
  describe('isWholeFileHighlightExtension', () => {
    it('returns true for component-style extensions', () => {
      expect(isWholeFileHighlightExtension('src/App.vue')).toBe(true);
      expect(isWholeFileHighlightExtension('src/App.svelte')).toBe(true);
      expect(isWholeFileHighlightExtension('index.html')).toBe(true);
      expect(isWholeFileHighlightExtension('pages/index.astro')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isWholeFileHighlightExtension('Component.VUE')).toBe(true);
      expect(isWholeFileHighlightExtension('Index.HTML')).toBe(true);
    });

    it('returns false for other extensions', () => {
      expect(isWholeFileHighlightExtension('src/app.ts')).toBe(false);
      expect(isWholeFileHighlightExtension('src/app.tsx')).toBe(false);
      expect(isWholeFileHighlightExtension('main.js')).toBe(false);
      expect(isWholeFileHighlightExtension('styles.css')).toBe(false);
      expect(isWholeFileHighlightExtension('README.md')).toBe(false);
    });

    it('returns false when there is no extension', () => {
      expect(isWholeFileHighlightExtension('Dockerfile')).toBe(false);
      expect(isWholeFileHighlightExtension('')).toBe(false);
    });
  });
});
