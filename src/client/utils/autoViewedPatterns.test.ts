import { describe, expect, it } from 'vitest';

import {
  formatAutoViewedPatterns,
  matchesAutoViewedPattern,
  matchesAutoViewedPatterns,
  normalizeAutoViewedPatterns,
  parseAutoViewedPatterns,
} from './autoViewedPatterns';

describe('autoViewedPatterns', () => {
  it('normalizes stored patterns', () => {
    expect(
      normalizeAutoViewedPatterns(['  *.test.ts  ', '', 'src/**/*.snap', '*.test.ts', 42]),
    ).toEqual(['*.test.ts', 'src/**/*.snap']);
  });

  it('parses textarea input into normalized patterns', () => {
    expect(parseAutoViewedPatterns('*.test.ts\n\n src/**/*.snap \n')).toEqual([
      '*.test.ts',
      'src/**/*.snap',
    ]);
  });

  it('formats patterns for the textarea', () => {
    expect(formatAutoViewedPatterns(['*.test.ts', 'src/**/*.snap'])).toBe(
      '*.test.ts\nsrc/**/*.snap',
    );
  });

  it('matches basename-only patterns against nested files', () => {
    expect(matchesAutoViewedPattern('src/client/App.test.tsx', '*.test.tsx')).toBe(true);
    expect(matchesAutoViewedPattern('src/client/App.tsx', '*.test.tsx')).toBe(false);
  });

  it('matches globstar path patterns across directories', () => {
    expect(matchesAutoViewedPattern('src/components/Button.test.tsx', 'src/**/*.test.tsx')).toBe(
      true,
    );
    expect(matchesAutoViewedPattern('src/Button.test.tsx', 'src/**/*.test.tsx')).toBe(true);
    expect(matchesAutoViewedPattern('test/components/Button.test.tsx', 'src/**/*.test.tsx')).toBe(
      false,
    );
  });

  it('matches when any configured pattern matches', () => {
    expect(
      matchesAutoViewedPatterns('packages/vscode/src/extension.test.ts', [
        '*.spec.ts',
        'packages/**/src/*.test.ts',
      ]),
    ).toBe(true);
  });
});
