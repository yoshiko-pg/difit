import { describe, it, expect } from 'vitest';

import { detectWords, isValidWord, isWordToken } from './wordDetection';

describe('wordDetection', () => {
  describe('detectWords', () => {
    it('should detect simple words', () => {
      const text = 'hello world';
      const words = detectWords(text);
      expect(words).toEqual([
        { word: 'hello', start: 0, end: 5 },
        { word: 'world', start: 6, end: 11 },
      ]);
    });

    it('should detect words with numbers and underscores', () => {
      const text = 'variable_1 test2 _private';
      const words = detectWords(text);
      expect(words).toEqual([
        { word: 'variable_1', start: 0, end: 10 },
        { word: 'test2', start: 11, end: 16 },
        { word: '_private', start: 17, end: 25 },
      ]);
    });

    it('should skip special characters', () => {
      const text = 'hello, world! foo.bar';
      const words = detectWords(text);
      expect(words).toEqual([
        { word: 'hello', start: 0, end: 5 },
        { word: 'world', start: 7, end: 12 },
        { word: 'foo', start: 14, end: 17 },
        { word: 'bar', start: 18, end: 21 },
      ]);
    });

    it('should return empty array for empty string', () => {
      expect(detectWords('')).toEqual([]);
    });

    it('should return empty array for only special characters', () => {
      expect(detectWords('!@#$%^&*()')).toEqual([]);
    });
  });

  describe('isValidWord', () => {
    it('should accept valid words', () => {
      expect(isValidWord('hello')).toBe(true);
      expect(isValidWord('test123')).toBe(true);
      expect(isValidWord('_private')).toBe(true);
      expect(isValidWord('CONSTANT')).toBe(true);
    });

    it('should reject words that are too short', () => {
      expect(isValidWord('a')).toBe(false);
      expect(isValidWord('ab')).toBe(true);
    });

    it('should reject words that are too long', () => {
      const longWord = 'a'.repeat(101);
      expect(isValidWord(longWord)).toBe(false);

      const maxLengthWord = 'a'.repeat(100);
      expect(isValidWord(maxLengthWord)).toBe(true);
    });

    it('should accept keywords (no filtering)', () => {
      expect(isValidWord('if')).toBe(true);
      expect(isValidWord('for')).toBe(true);
      expect(isValidWord('var')).toBe(true);
      expect(isValidWord('let')).toBe(true);
      expect(isValidWord('const')).toBe(true);
      expect(isValidWord('function')).toBe(true);
    });
  });

  describe('isWordToken', () => {
    it('should return true for valid word tokens', () => {
      expect(isWordToken('hello')).toBe(true);
      expect(isWordToken('world123')).toBe(true);
      expect(isWordToken('foo_bar')).toBe(true);
      expect(isWordToken('camelCase')).toBe(true);
    });

    it('should return false for symbols and punctuation', () => {
      expect(isWordToken('+')).toBe(false);
      expect(isWordToken('-')).toBe(false);
      expect(isWordToken('=')).toBe(false);
      expect(isWordToken('!')).toBe(false);
      expect(isWordToken('@')).toBe(false);
      expect(isWordToken('#')).toBe(false);
      expect(isWordToken('$')).toBe(false);
      expect(isWordToken('%')).toBe(false);
      expect(isWordToken('^')).toBe(false);
      expect(isWordToken('&')).toBe(false);
      expect(isWordToken('*')).toBe(false);
      expect(isWordToken('(')).toBe(false);
      expect(isWordToken(')')).toBe(false);
      expect(isWordToken('[')).toBe(false);
      expect(isWordToken(']')).toBe(false);
      expect(isWordToken('{')).toBe(false);
      expect(isWordToken('}')).toBe(false);
      expect(isWordToken(';')).toBe(false);
      expect(isWordToken(':')).toBe(false);
      expect(isWordToken(',')).toBe(false);
      expect(isWordToken('.')).toBe(false);
      expect(isWordToken('<')).toBe(false);
      expect(isWordToken('>')).toBe(false);
      expect(isWordToken('/')).toBe(false);
      expect(isWordToken('?')).toBe(false);
    });

    it('should return false for mixed content', () => {
      expect(isWordToken('hello,')).toBe(false);
      expect(isWordToken('world!')).toBe(false);
      expect(isWordToken('foo.bar')).toBe(false);
      expect(isWordToken('test()')).toBe(false);
    });

    it('should return true for keywords (no filtering)', () => {
      expect(isWordToken('if')).toBe(true);
      expect(isWordToken('for')).toBe(true);
      expect(isWordToken('function')).toBe(true);
      expect(isWordToken('class')).toBe(true);
    });

    it('should return false for too short words', () => {
      expect(isWordToken('a')).toBe(false);
      expect(isWordToken('i')).toBe(false);
    });

    it('should handle tokens with leading/trailing spaces', () => {
      expect(isWordToken(' hello')).toBe(true);
      expect(isWordToken('hello ')).toBe(true);
      expect(isWordToken(' hello ')).toBe(true);
      expect(isWordToken('  world  ')).toBe(true);
    });

    it('should return false for only spaces', () => {
      expect(isWordToken(' ')).toBe(false);
      expect(isWordToken('   ')).toBe(false);
      expect(isWordToken('\t')).toBe(false);
      expect(isWordToken('\n')).toBe(false);
    });
  });
});
