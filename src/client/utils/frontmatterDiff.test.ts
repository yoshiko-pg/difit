import { describe, it, expect } from 'vitest';

import { computeFrontmatterDiff } from './frontmatterDiff';

describe('computeFrontmatterDiff', () => {
  it('treats key order changes as unchanged (canonical stringify)', () => {
    const old = { a: 1, b: 2 };
    const new_ = { b: 2, a: 1 };
    expect(computeFrontmatterDiff(old, new_)).toEqual([
      { key: 'b', status: 'unchanged', oldValue: 2, newValue: 2 },
      { key: 'a', status: 'unchanged', oldValue: 1, newValue: 1 },
    ]);
  });

  it('detects type conversions as modified', () => {
    const old = { published: 'true' };
    const new_ = { published: true };
    expect(computeFrontmatterDiff(old, new_)).toEqual([
      { key: 'published', status: 'modified', oldValue: 'true', newValue: true },
    ]);
  });

  it('treats nested object key order changes as unchanged', () => {
    const old = { seo: { title: 'A', desc: 'X' } };
    const new_ = { seo: { desc: 'X', title: 'A' } };
    expect(computeFrontmatterDiff(old, new_)).toEqual([
      { key: 'seo', status: 'unchanged', oldValue: old.seo, newValue: new_.seo },
    ]);
  });

  it('detects nested value changes as modified', () => {
    const old = { seo: { title: 'A' } };
    const new_ = { seo: { title: 'B' } };
    expect(computeFrontmatterDiff(old, new_)).toEqual([
      { key: 'seo', status: 'modified', oldValue: old.seo, newValue: new_.seo },
    ]);
  });

  it('treats identical arrays as unchanged', () => {
    const old = { tags: ['a', 'b'] };
    const new_ = { tags: ['a', 'b'] };
    expect(computeFrontmatterDiff(old, new_)).toEqual([
      { key: 'tags', status: 'unchanged', oldValue: old.tags, newValue: new_.tags },
    ]);
  });

  it('treats array order changes as modified', () => {
    const old = { tags: ['a', 'b'] };
    const new_ = { tags: ['b', 'a'] };
    expect(computeFrontmatterDiff(old, new_)).toEqual([
      { key: 'tags', status: 'modified', oldValue: old.tags, newValue: new_.tags },
    ]);
  });

  it('detects null to value transitions as modified', () => {
    const old = { x: null };
    const new_ = { x: 'value' };
    expect(computeFrontmatterDiff(old, new_)).toEqual([
      { key: 'x', status: 'modified', oldValue: null, newValue: 'value' },
    ]);
  });

  it('treats both-null values as unchanged', () => {
    const old = { x: null };
    const new_ = { x: null };
    expect(computeFrontmatterDiff(old, new_)).toEqual([
      { key: 'x', status: 'unchanged', oldValue: null, newValue: null },
    ]);
  });

  it('returns an empty array when both sides are null', () => {
    expect(computeFrontmatterDiff(null, null)).toEqual([]);
  });

  it('returns all keys as added when oldData is null', () => {
    expect(computeFrontmatterDiff(null, { title: 'X', desc: 'Y' })).toEqual([
      { key: 'title', status: 'added', oldValue: undefined, newValue: 'X' },
      { key: 'desc', status: 'added', oldValue: undefined, newValue: 'Y' },
    ]);
  });

  it('returns all keys as removed when newData is null', () => {
    expect(computeFrontmatterDiff({ old_key: 'X' }, null)).toEqual([
      { key: 'old_key', status: 'removed', oldValue: 'X', newValue: undefined },
    ]);
  });

  it('orders entries as new-first then old-only appendix', () => {
    const old = { common: 'Y', old_only: 'Z' };
    const new_ = { new_key: 'X', common: 'Y' };
    expect(computeFrontmatterDiff(old, new_)).toEqual([
      { key: 'new_key', status: 'added', oldValue: undefined, newValue: 'X' },
      { key: 'common', status: 'unchanged', oldValue: 'Y', newValue: 'Y' },
      { key: 'old_only', status: 'removed', oldValue: 'Z', newValue: undefined },
    ]);
  });

  it('treats equal Date values as unchanged', () => {
    const d1 = new Date('2020-01-01T00:00:00Z');
    const d2 = new Date('2020-01-01T00:00:00Z');
    expect(computeFrontmatterDiff({ date: d1 }, { date: d2 })).toEqual([
      { key: 'date', status: 'unchanged', oldValue: d1, newValue: d2 },
    ]);
  });
});
