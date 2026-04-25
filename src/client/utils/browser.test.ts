import { describe, expect, it } from 'vitest';

import { isSafariBrowser } from './browser';

describe('isSafariBrowser', () => {
  it('returns true for Safari on macOS', () => {
    expect(
      isSafariBrowser(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      ),
    ).toBe(true);
  });

  it('returns true for Safari on iOS', () => {
    expect(
      isSafariBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(true);
  });

  it('returns false for Chrome', () => {
    expect(
      isSafariBrowser(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      ),
    ).toBe(false);
  });

  it('returns false for Chrome on iOS', () => {
    expect(
      isSafariBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/135.0.7049.83 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(false);
  });
});
