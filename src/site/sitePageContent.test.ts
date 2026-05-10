import { describe, expect, it } from 'vitest';

import { resolveSiteLanguage } from './sitePageContent';

describe('resolveSiteLanguage', () => {
  it('matches supported browser language tags by primary language subtag', () => {
    expect(resolveSiteLanguage(['ko-KR', 'en-US'])).toBe('ko');
    expect(resolveSiteLanguage(['zh-Hant-TW', 'en-US'])).toBe('zh');
  });

  it('falls back to English when no supported language matches', () => {
    expect(resolveSiteLanguage(['fr-FR', 'de-DE'])).toBe('en');
  });
});
