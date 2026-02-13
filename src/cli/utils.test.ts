import { describe, it, expect } from 'vitest';

import {
  detectStdinSource,
  parseGitHubPrUrl,
  shortHash,
  shouldReadStdin,
  validateCommitish,
  validateDiffArguments,
} from './utils';

describe('CLI Utils', () => {
  describe('stdin detection', () => {
    it('detects pipe from stdin stat', () => {
      expect(
        detectStdinSource({
          isFIFO: () => true,
          isFile: () => false,
          isSocket: () => false,
        }),
      ).toBe('pipe');
    });

    it('detects file from stdin stat', () => {
      expect(
        detectStdinSource({
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
        }),
      ).toBe('file');
    });

    it('detects socket from stdin stat', () => {
      expect(
        detectStdinSource({
          isFIFO: () => false,
          isFile: () => false,
          isSocket: () => true,
        }),
      ).toBe('socket');
    });

    it('detects tty for character device stdin stat', () => {
      expect(
        detectStdinSource({
          isFIFO: () => false,
          isFile: () => false,
          isSocket: () => false,
        }),
      ).toBe('tty');
    });

    it('reads stdin when commitish is explicit stdin marker', () => {
      expect(
        shouldReadStdin({
          commitish: '-',
          hasPositionalArgs: true,
          hasPrOption: true,
          hasTuiOption: true,
          stdinSource: 'tty',
        }),
      ).toBe(true);
    });

    it('does not read stdin when positional args are explicitly passed', () => {
      expect(
        shouldReadStdin({
          commitish: '.',
          hasPositionalArgs: true,
          hasPrOption: false,
          hasTuiOption: false,
          stdinSource: 'pipe',
        }),
      ).toBe(false);
    });

    it('does not read stdin when --pr is specified', () => {
      expect(
        shouldReadStdin({
          commitish: 'HEAD',
          hasPositionalArgs: false,
          hasPrOption: true,
          hasTuiOption: false,
          stdinSource: 'pipe',
        }),
      ).toBe(false);
    });

    it('does not read stdin when --tui is specified', () => {
      expect(
        shouldReadStdin({
          commitish: 'HEAD',
          hasPositionalArgs: false,
          hasPrOption: false,
          hasTuiOption: true,
          stdinSource: 'pipe',
        }),
      ).toBe(false);
    });

    it('auto-detects stdin for pipe/file/socket only when no explicit git mode is selected', () => {
      expect(
        shouldReadStdin({
          commitish: 'HEAD',
          hasPositionalArgs: false,
          hasPrOption: false,
          hasTuiOption: false,
          stdinSource: 'pipe',
        }),
      ).toBe(true);

      expect(
        shouldReadStdin({
          commitish: 'HEAD',
          hasPositionalArgs: false,
          hasPrOption: false,
          hasTuiOption: false,
          stdinSource: 'file',
        }),
      ).toBe(true);

      expect(
        shouldReadStdin({
          commitish: 'HEAD',
          hasPositionalArgs: false,
          hasPrOption: false,
          hasTuiOption: false,
          stdinSource: 'socket',
        }),
      ).toBe(true);
    });

    it('does not auto-read stdin for tty source', () => {
      expect(
        shouldReadStdin({
          commitish: 'HEAD',
          hasPositionalArgs: false,
          hasPrOption: false,
          hasTuiOption: false,
          stdinSource: 'tty',
        }),
      ).toBe(false);
    });
  });

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

    it('should validate @ references (Git alias for HEAD)', () => {
      expect(validateCommitish('@')).toBe(true);
      expect(validateCommitish('@~1')).toBe(true);
      expect(validateCommitish('@~10')).toBe(true);
      expect(validateCommitish('@^')).toBe(true);
      expect(validateCommitish('@^1')).toBe(true);
      expect(validateCommitish('@^2')).toBe(true);
      expect(validateCommitish('@~2^1')).toBe(true);
    });

    it('should validate branch names', () => {
      // Valid branch names according to git rules
      expect(validateCommitish('main')).toBe(true);
      expect(validateCommitish('feature/new-feature')).toBe(true);
      expect(validateCommitish('develop')).toBe(true);
      expect(validateCommitish('feature-123')).toBe(true); // dash and numbers (not at start)
      expect(validateCommitish('feature_branch')).toBe(true); // underscore
      expect(validateCommitish('hotfix@bug')).toBe(true); // @ character (not followed by {)
      expect(validateCommitish('feature+new')).toBe(true); // plus character
      expect(validateCommitish('feature=test')).toBe(true); // equals character
      expect(validateCommitish('feature!important')).toBe(true); // exclamation
      expect(validateCommitish('feature,list')).toBe(true); // comma
      expect(validateCommitish('feature;test')).toBe(true); // semicolon
      expect(validateCommitish('feature"quoted"')).toBe(true); // quotes
      expect(validateCommitish("feature'quoted'")).toBe(true); // single quotes
      expect(validateCommitish('release/v2.3.1')).toBe(true); // version numbers
      expect(validateCommitish('bugfix/login-timeout')).toBe(true); // path with dash
    });

    it('should validate special cases', () => {
      expect(validateCommitish('.')).toBe(true); // working directory diff
    });

    it('should reject invalid input', () => {
      expect(validateCommitish('')).toBe(false);
      expect(validateCommitish('   ')).toBe(false);
      expect(validateCommitish('HEAD~')).toBe(false);
      expect(validateCommitish('abc')).toBe(true); // short hashes are valid

      // Invalid branch names according to git rules
      expect(validateCommitish('-feature')).toBe(false); // cannot start with dash
      expect(validateCommitish('feature.')).toBe(false); // cannot end with dot
      expect(validateCommitish('@')).toBe(true); // @ is a valid Git alias for HEAD
      expect(validateCommitish('feature..test')).toBe(false); // no consecutive dots
      expect(validateCommitish('feature@{upstream}')).toBe(false); // no @{ sequence
      expect(validateCommitish('feature//test')).toBe(false); // no consecutive slashes
      expect(validateCommitish('/feature')).toBe(false); // cannot start with slash
      expect(validateCommitish('feature/')).toBe(false); // cannot end with slash
      expect(validateCommitish('feature.lock')).toBe(false); // cannot end with .lock
      expect(validateCommitish('feature^invalid')).toBe(false); // ^ not allowed
      expect(validateCommitish('feature~invalid')).toBe(false); // ~ not allowed
      expect(validateCommitish('feature:invalid')).toBe(false); // : not allowed
      expect(validateCommitish('feature?invalid')).toBe(false); // ? not allowed
      expect(validateCommitish('feature*invalid')).toBe(false); // * not allowed
      expect(validateCommitish('feature[invalid')).toBe(false); // [ not allowed
      expect(validateCommitish('feature\\invalid')).toBe(false); // \ not allowed
      expect(validateCommitish('feature invalid')).toBe(false); // space not allowed
      expect(validateCommitish('feature/.hidden')).toBe(false); // component cannot start with dot
      expect(validateCommitish('feature/test.lock')).toBe(false); // component cannot end with .lock
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
          'Special arguments (working, staged, .) are only allowed as target, not base. Got base: working',
        );

        const result2 = validateDiffArguments('main', 'staged');
        expect(result2.valid).toBe(false);
        expect(result2.error).toBe(
          'Special arguments (working, staged, .) are only allowed as target, not base. Got base: staged',
        );

        const result3 = validateDiffArguments('HEAD', '.');
        expect(result3.valid).toBe(false);
        expect(result3.error).toBe(
          'Special arguments (working, staged, .) are only allowed as target, not base. Got base: .',
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
          'Special arguments (working, staged, .) are only allowed as target, not base. Got base: staged',
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
          '"working" shows unstaged changes and cannot be compared with another commit. Use "." instead to compare all uncommitted changes with a specific commit.',
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
          '"working" shows unstaged changes and cannot be compared with another commit. Use "." instead to compare all uncommitted changes with a specific commit.',
        );

        const result2 = validateDiffArguments('working', 'abc123');
        expect(result2.valid).toBe(false);
        expect(result2.error).toBe(
          '"working" shows unstaged changes and cannot be compared with another commit. Use "." instead to compare all uncommitted changes with a specific commit.',
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
          validateDiffArguments('bd4b7513e075b5b245284c38fd23427b9bd0f42e^', 'abc123'),
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
        hostname: 'github.com',
      });
    });

    it('should parse GitHub PR URLs with additional path segments', () => {
      const result = parseGitHubPrUrl('https://github.com/owner/repo/pull/456/files');
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        pullNumber: 456,
        hostname: 'github.com',
      });
    });

    it('should parse GitHub PR URLs with query parameters', () => {
      const result = parseGitHubPrUrl('https://github.com/owner/repo/pull/789?tab=files');
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        pullNumber: 789,
        hostname: 'github.com',
      });
    });

    it('should handle URLs with hyphens and underscores in owner/repo names', () => {
      const result = parseGitHubPrUrl('https://github.com/owner-name/repo_name/pull/123');
      expect(result).toEqual({
        owner: 'owner-name',
        repo: 'repo_name',
        pullNumber: 123,
        hostname: 'github.com',
      });
    });

    it('should parse GitHub Enterprise PR URLs', () => {
      const result1 = parseGitHubPrUrl('https://github.enterprise.com/owner/repo/pull/123');
      expect(result1).toEqual({
        owner: 'owner',
        repo: 'repo',
        pullNumber: 123,
        hostname: 'github.enterprise.com',
      });

      const result2 = parseGitHubPrUrl('https://git.company.io/team/project/pull/456');
      expect(result2).toEqual({
        owner: 'team',
        repo: 'project',
        pullNumber: 456,
        hostname: 'git.company.io',
      });
    });

    it('should return null for invalid URLs', () => {
      expect(parseGitHubPrUrl('not-a-url')).toBe(null);
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
