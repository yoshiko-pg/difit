import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  TUI_DEPRECATION_NOTICE_LINES,
  TUI_DEPRECATION_PROMPT,
  warnAboutTuiDeprecation,
} from './tuiDeprecation.js';

describe('TUI deprecation warning', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows bilingual warnings and waits for Enter before continuing', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const waitForEnter = vi.fn<(_: string) => Promise<void>>().mockResolvedValue(undefined);

    await warnAboutTuiDeprecation(waitForEnter);

    expect(consoleWarn).toHaveBeenNthCalledWith(1, TUI_DEPRECATION_NOTICE_LINES[0]);
    expect(consoleWarn).toHaveBeenNthCalledWith(2, TUI_DEPRECATION_NOTICE_LINES[1]);
    expect(waitForEnter).toHaveBeenCalledWith(`${TUI_DEPRECATION_PROMPT}\n`);
    expect(consoleWarn.mock.invocationCallOrder[1]).toBeLessThan(
      waitForEnter.mock.invocationCallOrder[0]!,
    );
  });
});
