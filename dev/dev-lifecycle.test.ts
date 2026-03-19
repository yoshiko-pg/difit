import { describe, expect, it } from 'vitest';

import { getCompileCloseExitCode } from './dev-lifecycle.js';

describe('getCompileCloseExitCode', () => {
  it('returns zero when compile closes during shutdown', () => {
    expect(getCompileCloseExitCode(null, true)).toBe(0);
  });

  it('returns the compile exit code when shutdown was not requested', () => {
    expect(getCompileCloseExitCode(2, false)).toBe(2);
  });

  it('returns null when compile succeeds and dev should continue', () => {
    expect(getCompileCloseExitCode(0, false)).toBeNull();
  });
});
