import { describe, it, expect } from 'vitest';

import { getUniqueCommentAuthors, hasMultipleCommentAuthors } from './commentAuthors';

describe('commentAuthors', () => {
  it('returns false when only one author type exists', () => {
    expect(hasMultipleCommentAuthors([{ author: 'User' }, { author: 'User' }])).toBe(false);
  });

  it('returns true when multiple author types exist', () => {
    expect(hasMultipleCommentAuthors([{ author: 'User' }, { author: 'Reviewer' }])).toBe(true);
  });

  it('ignores missing and blank authors', () => {
    expect(
      getUniqueCommentAuthors([{ author: 'User' }, {}, { author: '   ' }, { author: 'User' }]),
    ).toEqual(['User']);
  });
});
