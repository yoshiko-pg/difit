import { describe, expect, it, vi } from 'vitest';

import { createCliStdoutProxy, shouldSuppressCliLine } from './dev-stdout.js';

describe('shouldSuppressCliLine', () => {
  it('suppresses dev-only startup lines while preserving review output', () => {
    expect(shouldSuppressCliLine('📋 Reviewing: HEAD')).toBe(true);
    expect(shouldSuppressCliLine('💡 Use --open to automatically open browser')).toBe(true);
    expect(shouldSuppressCliLine('📝 Comments from review session:')).toBe(false);
    expect(shouldSuppressCliLine('Total comments: 2')).toBe(false);
  });
});

describe('createCliStdoutProxy', () => {
  it('detects the CLI server URL across chunks and emits shutdown comments', () => {
    const onServerUrl = vi.fn();
    const output = [];
    const proxy = createCliStdoutProxy({
      onServerUrl,
      onOutput: (text) => output.push(text),
    });

    proxy.push('\n🚀 difit server started on http://localhost:4966\n📋 Rev');
    proxy.push('iewing: HEAD\n💡 Use --open to automatically open browser\n');
    proxy.push('\n👋 Shutting down difit server...\n\n📝 Comments from review session:\n');
    proxy.push('==================================================\n');
    proxy.push('src/index.ts:L10\nFix this edge case\n');
    proxy.push('==================================================\nTotal comments: 1\n');
    proxy.flush();

    expect(onServerUrl).toHaveBeenCalledWith('http://localhost:4966');
    expect(output.join('')).toBe(
      '\n👋 Shutting down difit server...\n\n📝 Comments from review session:\n' +
        '==================================================\n' +
        'src/index.ts:L10\nFix this edge case\n' +
        '==================================================\n' +
        'Total comments: 1\n',
    );
  });

  it('drops blank lines that only belong to suppressed output', () => {
    const output = [];
    const proxy = createCliStdoutProxy({
      onServerUrl: vi.fn(),
      onOutput: (text) => output.push(text),
    });

    proxy.push('\n🚀 difit server started on http://localhost:4966\n📋 Reviewing: HEAD\n');
    proxy.flush();

    expect(output).toEqual([]);
  });
});
