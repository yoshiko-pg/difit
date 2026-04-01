import { describe, expect, it, vi } from 'vitest';

import { createId } from './createId';

describe('createId', () => {
  it('creates a 16-character lowercase alphanumeric id', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(createId()).toBe('aaaaaaaaaaaaaaaa');

    randomSpy.mockRestore();
  });

  it('creates different ids across successive calls', () => {
    const randomSpy = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1 / 36)
      .mockReturnValueOnce(2 / 36)
      .mockReturnValueOnce(3 / 36)
      .mockReturnValueOnce(4 / 36)
      .mockReturnValueOnce(5 / 36)
      .mockReturnValueOnce(6 / 36)
      .mockReturnValueOnce(7 / 36)
      .mockReturnValueOnce(8 / 36)
      .mockReturnValueOnce(9 / 36)
      .mockReturnValueOnce(10 / 36)
      .mockReturnValueOnce(11 / 36)
      .mockReturnValueOnce(12 / 36)
      .mockReturnValueOnce(13 / 36)
      .mockReturnValueOnce(14 / 36)
      .mockReturnValueOnce(15 / 36)
      .mockReturnValueOnce(16 / 36)
      .mockReturnValueOnce(17 / 36)
      .mockReturnValueOnce(18 / 36)
      .mockReturnValueOnce(19 / 36)
      .mockReturnValueOnce(20 / 36)
      .mockReturnValueOnce(21 / 36)
      .mockReturnValueOnce(22 / 36)
      .mockReturnValueOnce(23 / 36)
      .mockReturnValueOnce(24 / 36)
      .mockReturnValueOnce(25 / 36)
      .mockReturnValueOnce(26 / 36)
      .mockReturnValueOnce(27 / 36)
      .mockReturnValueOnce(28 / 36)
      .mockReturnValueOnce(29 / 36)
      .mockReturnValueOnce(30 / 36)
      .mockReturnValueOnce(31 / 36);

    expect(createId()).toBe('abcdefghijklmnop');
    expect(createId()).toBe('qrstuvwxyz012345');

    randomSpy.mockRestore();
  });
});
