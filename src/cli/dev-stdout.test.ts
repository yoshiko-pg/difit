import { describe, expect, it, vi } from 'vitest';

import { createCliStdoutProxy } from '../../scripts/dev-stdout.js';

describe('createCliStdoutProxy', () => {
  it('detects the CLI server URL across chunks and hides only that line', () => {
    const onServerUrl = vi.fn();
    const output: string[] = [];
    const proxy = createCliStdoutProxy({
      onServerUrl,
      onOutput: (text: string) => output.push(text),
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
      '📋 Reviewing: HEAD\n' +
        '💡 Use --open to automatically open browser\n' +
        '\n👋 Shutting down difit server...\n\n📝 Comments from review session:\n' +
        '==================================================\n' +
        'src/index.ts:L10\nFix this edge case\n' +
        '==================================================\n' +
        'Total comments: 1\n',
    );
  });

  it('drops the leading blank line that only belongs to the hidden server URL', () => {
    const output: string[] = [];
    const proxy = createCliStdoutProxy({
      onServerUrl: vi.fn(),
      onOutput: (text: string) => output.push(text),
    });

    proxy.push('\n🚀 difit server started on http://localhost:4966\n📋 Reviewing: HEAD\n');
    proxy.flush();

    expect(output).toEqual(['📋 Reviewing: HEAD\n']);
  });
});
