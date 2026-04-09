import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createCommentCommand } from './comment.js';

describe('createCommentCommand', () => {
  const command = createCommentCommand();

  it('creates a command named "comment"', () => {
    expect(command.name()).toBe('comment');
  });

  it('has "add" and "get" subcommands', () => {
    const subcommandNames = command.commands.map((c) => c.name());
    expect(subcommandNames).toContain('add');
    expect(subcommandNames).toContain('get');
  });

  describe('add subcommand', () => {
    const addCommand = command.commands.find((c) => c.name() === 'add')!;

    it('requires --port option', () => {
      const portOption = addCommand.options.find((o) => o.long === '--port');
      expect(portOption).toBeDefined();
      expect(portOption?.mandatory).toBe(true);
    });

    it('accepts optional json argument', () => {
      const args = addCommand.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe('json');
      expect(args[0].required).toBe(false);
    });
  });

  describe('get subcommand', () => {
    const getCommand = command.commands.find((c) => c.name() === 'get')!;

    it('requires --port option', () => {
      const portOption = getCommand.options.find((o) => o.long === '--port');
      expect(portOption).toBeDefined();
      expect(portOption?.mandatory).toBe(true);
    });

    it('has --format option with choices', () => {
      const formatOption = getCommand.options.find((o) => o.long === '--format');
      expect(formatOption).toBeDefined();
      expect(formatOption?.defaultValue).toBe('text');
      expect(formatOption?.argChoices).toEqual(['text', 'json']);
    });
  });
});

describe('comment subcommand integration', () => {
  let originalFetch: typeof globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;
  let originalProcessExit: typeof process.exit;
  let consoleOutput: string[];
  let consoleErrors: string[];

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    originalProcessExit = process.exit;
    process.exit = vi.fn() as any;

    consoleOutput = [];
    consoleErrors = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      consoleOutput.push(args.join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      consoleErrors.push(args.join(' '));
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.exit = originalProcessExit;
    vi.restoreAllMocks();
  });

  describe('add', () => {
    it('sends comment imports to the server', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, importId: 'abc123', count: 1 }),
      });

      const command = createCommentCommand();
      await command.parseAsync([
        'node',
        'difit',
        'add',
        '--port',
        '4966',
        '{"type":"thread","filePath":"test.ts","position":{"side":"new","line":1},"body":"Test"}',
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4966/api/comment-imports',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(consoleOutput[0]).toContain('"success":true');
    });

    it('validates JSON before sending', async () => {
      const command = createCommentCommand();
      await command.parseAsync(['node', 'difit', 'add', '--port', '4966', 'not-valid-json']);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(consoleErrors[0]).toContain('Error:');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('handles server error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Bad request' }),
      });

      const command = createCommentCommand();
      await command.parseAsync([
        'node',
        'difit',
        'add',
        '--port',
        '4966',
        '{"type":"thread","filePath":"test.ts","position":{"side":"new","line":1},"body":"Test"}',
      ]);

      expect(consoleErrors[0]).toContain('Bad request');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('handles connection error', async () => {
      const fetchError = new TypeError('fetch failed');
      mockFetch.mockRejectedValue(fetchError);

      const command = createCommentCommand();
      await command.parseAsync([
        'node',
        'difit',
        'add',
        '--port',
        '9999',
        '{"type":"thread","filePath":"test.ts","position":{"side":"new","line":1},"body":"Test"}',
      ]);

      expect(consoleErrors[0]).toContain('Cannot connect');
      expect(consoleErrors[0]).toContain('9999');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('get', () => {
    it('fetches comments in text format by default', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('Comments output text'),
      });

      const command = createCommentCommand();
      await command.parseAsync(['node', 'difit', 'get', '--port', '4966']);

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4966/api/comments-output');
      expect(consoleOutput[0]).toBe('Comments output text');
    });

    it('fetches comments in json format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ threads: [{ id: '1' }] }),
      });

      const command = createCommentCommand();
      await command.parseAsync(['node', 'difit', 'get', '--port', '4966', '--format', 'json']);

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4966/api/comments-json');
      expect(consoleOutput[0]).toContain('"threads"');
    });

    it('handles connection error', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      const command = createCommentCommand();
      await command.parseAsync(['node', 'difit', 'get', '--port', '9999']);

      expect(consoleErrors[0]).toContain('Cannot connect');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('handles empty text output silently', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('  '),
      });

      const command = createCommentCommand();
      await command.parseAsync(['node', 'difit', 'get', '--port', '4966']);

      expect(consoleOutput).toHaveLength(0);
    });
  });
});
