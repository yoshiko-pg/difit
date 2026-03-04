import { describe, expect, it } from 'vitest';

import { DEFAULT_EDITOR_ID, EDITOR_OPTIONS, resolveEditorOption } from './editorOptions';

describe('editorOptions', () => {
  it('includes Zed in editor options', () => {
    const zed = EDITOR_OPTIONS.find((option) => option.id === 'zed');

    expect(zed).toBeDefined();
    expect(zed).toMatchObject({
      id: 'zed',
      label: 'Zed',
      protocol: 'zed',
      cliCommand: 'zed',
      lineFormat: 'path-suffix',
    });
  });

  it('resolves zed editor from id', () => {
    expect(resolveEditorOption('zed').id).toBe('zed');
  });

  it('resolves zed editor case-insensitively', () => {
    expect(resolveEditorOption('ZED').id).toBe('zed');
  });

  it('falls back to default editor when unknown value is passed', () => {
    expect(resolveEditorOption('unknown-editor').id).toBe(DEFAULT_EDITOR_ID);
  });
});
