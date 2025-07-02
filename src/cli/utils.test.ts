import { describe, it, expect } from 'vitest';

import { validateCommitish, validateDiffArguments, shortHash, parseGitHubPrUrl } from './utils';

describe('CLI Utils', () => {
  describe('validateCommitish', () => {
    it('should validate full SHA hashes', () => {
      expect(validateCommitish('a1b2c3d4e5f6789012345678901234567890abcd')).toBe(true);
      expect(validateCommitish('abc123')).toBe(true);
    });

    it('should validate SHA hashes with parent references', () => {
      expect(validateCommitish('a1b2c3d4e5f6789012345678901234567890abcd^')).toBe(true);
      expect(validateCommitish('abc123^')).toBe(true);
      expect(validateCommitish('abc123^^')).toBe(true);
      expect(validateCommitish('bd4b7513e075b5b245284c38fd23427b9bd0f42e^')).toBe(true);
    });

    it('should validate SHA hashes with ancestor references', () => {
      expect(validateCommitish('a1b2c3d4e5f6789012345678901234567890abcd~1')).toBe(true);
      expect(validateCommitish('abc123~5')).toBe(true);
      expect(validateCommitish('abc123~10')).toBe(true);
      expect(validateCommitish('bd4b7513e075b5b245284c38fd23427b9bd0f42e~2')).toBe(true);
    });

    it('should validate HEAD references', () => {
      expect(validateCommitish('HEAD')).toBe(true);
      expect(validateCommitish('HEAD~1')).toBe(true);
      expect(validateCommitish('HEAD~10')).toBe(true);
      expect(validateCommitish('HEAD^')).toBe(true);
      expect(validateCommitish('HEAD^1')).toBe(true);
      expect(validateCommitish('HEAD^2')).toBe(true);
      expect(validateCommitish('HEAD~2^1')).toBe(true);
    });

    it('should validate branch names', () => {
      expect(validateCommitish('main')).toBe(true);
      expect(validateCommitish('feature/new-feature')).toBe(true);
      expect(validateCommitish('develop')).toBe(true);
    });

    it('should validate special cases', () => {
      expect(validateCommitish('.')).toBe(true); // working directory diff
    });

    it('should reject invalid input', () => {
      expect(validateCommitish('')).toBe(false);
      expect(validateCommitish('   ')).toBe(false);
      expect(validateCommitish('HEAD~')).toBe(false);
      expect(validateCommitish('abc')).toBe(true); // short hashes are valid
    });

    it('should reject non-string input', () => {
      expect(validateCommitish(null as any)).toBe(false);
      expect(validateCommitish(undefined as any)).toBe(false);
      expect(validateCommitish(123 as any)).toBe(false);
    });
  });

  describe('validateDiffArguments', () => {
    describe('format validation', () => {
      it('should accept valid commitish formats', () => {
        expect(validateDiffArguments('HEAD', 'HEAD^')).toEqual({ valid: true });
        expect(validateDiffArguments('main', 'develop')).toEqual({ valid: true });
        expect(validateDiffArguments('abc123', 'def456')).toEqual({ valid: true });
        expect(validateDiffArguments('working')).toEqual({ valid: true });
        expect(validateDiffArguments('staged', 'HEAD')).toEqual({ valid: true });
        expect(validateDiffArguments('.', 'main')).toEqual({ valid: true });
      });

      it('should reject invalid target commitish format', () => {
        const result = validateDiffArguments('', 'HEAD');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid target commit-ish format');
      });

      it('should reject invalid base commitish format', () => {
        const result = validateDiffArguments('HEAD', '');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid base commit-ish format');
      });
    });

    describe('special argument restrictions', () => {
      it('should reject special arguments in base position', () => {
        const result1 = validateDiffArguments('HEAD', 'working');
        expect(result1.valid).toBe(false);
        expect(result1.error).toBe(
          'Special arguments (working, staged, .) are only allowed as target, not base. Got base: working'
        );

        const result2 = validateDiffArguments('main', 'staged');
        expect(result2.valid).toBe(false);
        expect(result2.error).toBe(
          'Special arguments (working, staged, .) are only allowed as target, not base. Got base: staged'
        );

        const result3 = validateDiffArguments('HEAD', '.');
        expect(result3.valid).toBe(false);
        expect(result3.error).toBe(
          'Special arguments (working, staged, .) are only allowed as target, not base. Got base: .'
        );
      });

      it('should allow special arguments in target position', () => {
        expect(validateDiffArguments('working')).toEqual({ valid: true });
        expect(validateDiffArguments('staged', 'HEAD')).toEqual({ valid: true });
        expect(validateDiffArguments('.', 'main')).toEqual({ valid: true });
      });

      it('should allow staged as base only with working target', () => {
        expect(validateDiffArguments('working', 'staged')).toEqual({ valid: true });

        const result = validateDiffArguments('HEAD', 'staged');
        expect(result.valid).toBe(false);
        expect(result.error).toBe(
          'Special arguments (working, staged, .) are only allowed as target, not base. Got base: staged'
        );
      });
    });

    describe('same value comparison', () => {
      it('should reject same target and base values', () => {
        const result1 = validateDiffArguments('HEAD', 'HEAD');
        expect(result1.valid).toBe(false);
        expect(result1.error).toBe('Cannot compare HEAD with itself');

        const result2 = validateDiffArguments('main', 'main');
        expect(result2.valid).toBe(false);
        expect(result2.error).toBe('Cannot compare main with itself');
      });

      it('should allow different values', () => {
        expect(validateDiffArguments('HEAD', 'HEAD^')).toEqual({ valid: true });
        expect(validateDiffArguments('main', 'develop')).toEqual({ valid: true });
      });
    });

    describe('working directory restrictions', () => {
      it('should reject working with compareWith', () => {
        const result = validateDiffArguments('working', 'HEAD');
        expect(result.valid).toBe(false);
        expect(result.error).toBe(
          '"working" shows unstaged changes and cannot be compared with another commit. Use "." instead to compare all uncommitted changes with a specific commit.'
        );
      });

      it('should allow working without compareWith', () => {
        expect(validateDiffArguments('working')).toEqual({ valid: true });
      });

      it('should allow working with staged', () => {
        expect(validateDiffArguments('working', 'staged')).toEqual({ valid: true });
      });

      it('should reject working with other commits', () => {
        const result1 = validateDiffArguments('working', 'main');
        expect(result1.valid).toBe(false);
        expect(result1.error).toBe(
          '"working" shows unstaged changes and cannot be compared with another commit. Use "." instead to compare all uncommitted changes with a specific commit.'
        );

        const result2 = validateDiffArguments('working', 'abc123');
        expect(result2.valid).toBe(false);
        expect(result2.error).toBe(
          '"working" shows unstaged changes and cannot be compared with another commit. Use "." instead to compare all uncommitted changes with a specific commit.'
        );
      });

      it('should allow other special args with compareWith', () => {
        expect(validateDiffArguments('staged', 'HEAD')).toEqual({ valid: true });
        expect(validateDiffArguments('.', 'main')).toEqual({ valid: true });
      });
    });

    describe('edge cases', () => {
      it('should handle undefined base', () => {
        expect(validateDiffArguments('HEAD')).toEqual({ valid: true });
        expect(validateDiffArguments('main')).toEqual({ valid: true });
      });

      it('should handle complex git references', () => {
        expect(validateDiffArguments('HEAD~2', 'HEAD~3')).toEqual({ valid: true });
        expect(validateDiffArguments('HEAD^1', 'HEAD^2')).toEqual({ valid: true });
        expect(validateDiffArguments('feature/branch-name', 'origin/main')).toEqual({
          valid: true,
        });
      });

      it('should handle SHA hashes with parent/ancestor references', () => {
        expect(
          validateDiffArguments('bd4b7513e075b5b245284c38fd23427b9bd0f42e^', 'abc123')
        ).toEqual({ valid: true });
        expect(validateDiffArguments('abc123', 'def456^')).toEqual({ valid: true });
        expect(validateDiffArguments('abc123~1', 'def456~2')).toEqual({ valid: true });
        expect(validateDiffArguments('a1b2c3d4e5f6789012345678901234567890abcd^', 'HEAD')).toEqual({
          valid: true,
        });
      });
    });
  });

  describe('shortHash', () => {
    it('should return first 7 characters of hash', () => {
      expect(shortHash('a1b2c3d4e5f6789012345678901234567890abcd')).toBe('a1b2c3d');
      expect(shortHash('1234567890abcdef')).toBe('1234567');
      expect(shortHash('abc123')).toBe('abc123');
    });

    it('should handle short hashes', () => {
      expect(shortHash('abc')).toBe('abc');
      expect(shortHash('')).toBe('');
    });
  });

  describe('parseGitHubPrUrl', () => {
    it('should parse valid GitHub PR URLs', () => {
      const result = parseGitHubPrUrl('https://github.com/owner/repo/pull/123');
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        pullNumber: 123,
      });
    });

    it('should parse GitHub PR URLs with additional path segments', () => {
      const result = parseGitHubPrUrl('https://github.com/owner/repo/pull/456/files');
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        pullNumber: 456,
      });
    });

    it('should parse GitHub PR URLs with query parameters', () => {
      const result = parseGitHubPrUrl('https://github.com/owner/repo/pull/789?tab=files');
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        pullNumber: 789,
      });
    });

    it('should handle URLs with hyphens and underscores in owner/repo names', () => {
      const result = parseGitHubPrUrl('https://github.com/owner-name/repo_name/pull/123');
      expect(result).toEqual({
        owner: 'owner-name',
        repo: 'repo_name',
        pullNumber: 123,
      });
    });

    it('should return null for invalid URLs', () => {
      expect(parseGitHubPrUrl('not-a-url')).toBe(null);
      expect(parseGitHubPrUrl('https://example.com/owner/repo/pull/123')).toBe(null);
      expect(parseGitHubPrUrl('https://github.com/owner/repo/issues/123')).toBe(null);
      expect(parseGitHubPrUrl('https://github.com/owner/repo')).toBe(null);
      expect(parseGitHubPrUrl('https://github.com/owner/repo/pull/abc')).toBe(null);
    });

    it('should handle malformed URLs gracefully', () => {
      expect(parseGitHubPrUrl('')).toBe(null);
      expect(parseGitHubPrUrl('https://github.com')).toBe(null);
      expect(parseGitHubPrUrl('https://github.com/owner')).toBe(null);
      expect(parseGitHubPrUrl('https://github.com/owner/repo/pull')).toBe(null);
    });
  });
});
