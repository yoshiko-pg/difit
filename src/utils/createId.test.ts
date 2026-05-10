import { describe, expect, it, vi } from 'vitest';

import { createId } from './createId';

describe('createId', () => {
  it('creates a 16-character lowercase alphanumeric id', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(createId()).toBe('aaaaaaaaaaaaaaaa');

    randomSpy.mockRestore();
  });
});
