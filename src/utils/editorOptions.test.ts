import { describe, expect, it } from 'vitest';

import {
  buildEditorSpawnSpec,
  CUSTOM_EDITOR_ID,
  DEFAULT_EDITOR_ID,
  EDITOR_OPTIONS,
  NONE_EDITOR_ID,
  parseEditorArgsTemplate,
  resolveEditorOption,
} from './editorOptions';

describe('editorOptions', () => {
  it('includes Zed in editor options with the unified command+args shape', () => {
    const zed = EDITOR_OPTIONS.find((option) => option.id === 'zed');

    expect(zed).toBeDefined();
    expect(zed).toMatchObject({
      id: 'zed',
      label: 'Zed',
      command: 'zed',
      argsTemplate: '%file:%line',
    });
  });

  it('resolves zed editor from id and case-insensitively', () => {
    expect(resolveEditorOption('zed').id).toBe('zed');
    expect(resolveEditorOption('ZED').id).toBe('zed');
  });

  it('falls back to the default editor when an unknown value is passed', () => {
    expect(resolveEditorOption('unknown-editor').id).toBe(DEFAULT_EDITOR_ID);
  });

  it('keeps the "none" option with empty command/args so the UI can hide inputs', () => {
    const none = EDITOR_OPTIONS.find((option) => option.id === NONE_EDITOR_ID);
    expect(none).toBeDefined();
    expect(none?.command).toBe('');
    expect(none?.argsTemplate).toBe('');
  });

  it('exposes a "custom" placeholder entry with empty command/args', () => {
    const custom = EDITOR_OPTIONS.find((option) => option.id === CUSTOM_EDITOR_ID);
    expect(custom).toBeDefined();
    expect(custom?.label).toBe('Custom…');
    expect(custom?.command).toBe('');
    expect(custom?.argsTemplate).toBe('');
  });

  it('excludes editors that are no longer widely used for code review', () => {
    const ids = EDITOR_OPTIONS.map((option) => option.id);
    for (const deprecated of ['textwrangler', 'lyx', 'texmaker', 'alpha', 'atom', 'textadept']) {
      expect(ids, `${deprecated} should not be registered`).not.toContain(deprecated);
    }
  });

  describe('preset editor templates', () => {
    interface PresetCase {
      id: string;
      command: string;
      argsTemplate: string;
      expectedArgs: readonly string[];
    }

    const cases: readonly PresetCase[] = [
      {
        id: 'vscode',
        command: 'code',
        argsTemplate: '-g %file:%line',
        expectedArgs: ['-g', '/tmp/file.ts:42'],
      },
      {
        id: 'cursor',
        command: 'cursor',
        argsTemplate: '-g %file:%line',
        expectedArgs: ['-g', '/tmp/file.ts:42'],
      },
      {
        id: 'zed',
        command: 'zed',
        argsTemplate: '%file:%line',
        expectedArgs: ['/tmp/file.ts:42'],
      },
      {
        id: 'textmate',
        command: 'mate',
        argsTemplate: '-l %line %file',
        expectedArgs: ['-l', '42', '/tmp/file.ts'],
      },
      {
        id: 'bbedit',
        command: 'bbedit',
        argsTemplate: '+%line %file',
        expectedArgs: ['+42', '/tmp/file.ts'],
      },
      {
        id: 'emacs',
        command: 'emacsclient',
        argsTemplate: '--no-wait +%line %file',
        expectedArgs: ['--no-wait', '+42', '/tmp/file.ts'],
      },
      {
        id: 'macvim',
        command: 'mvim',
        argsTemplate: '--remote-silent +%line %file',
        expectedArgs: ['--remote-silent', '+42', '/tmp/file.ts'],
      },
      {
        id: 'sublime',
        command: 'subl',
        argsTemplate: '%file:%line',
        expectedArgs: ['/tmp/file.ts:42'],
      },
      {
        id: 'nova',
        command: 'nova',
        argsTemplate: 'open %file -l %line',
        expectedArgs: ['open', '/tmp/file.ts', '-l', '42'],
      },
    ];

    for (const testCase of cases) {
      it(`registers ${testCase.id} with the expected command and template`, () => {
        const option = EDITOR_OPTIONS.find((entry) => entry.id === testCase.id);
        expect(option, `${testCase.id} should be registered`).toBeDefined();
        expect(option?.command).toBe(testCase.command);
        expect(option?.argsTemplate).toBe(testCase.argsTemplate);
      });

      it(`builds a spawn spec for ${testCase.id} with %file/%line substituted`, () => {
        const option = resolveEditorOption(testCase.id);
        const spec = buildEditorSpawnSpec({
          command: option.command,
          argsTemplate: option.argsTemplate,
          filePath: '/tmp/file.ts',
          lineNumber: 42,
        });
        expect(spec).not.toBeNull();
        expect(spec?.command).toBe(testCase.command);
        expect(spec?.args).toEqual(testCase.expectedArgs);
      });
    }
  });

  describe('parseEditorArgsTemplate', () => {
    it('splits whitespace-separated tokens', () => {
      expect(parseEditorArgsTemplate('-l %line %file')).toEqual(['-l', '%line', '%file']);
    });

    it('collapses runs of whitespace', () => {
      expect(parseEditorArgsTemplate('  -l   %line\t%file  ')).toEqual(['-l', '%line', '%file']);
    });

    it('preserves double-quoted segments', () => {
      expect(parseEditorArgsTemplate('+%line "%file"')).toEqual(['+%line', '%file']);
    });

    it('preserves single-quoted segments', () => {
      expect(parseEditorArgsTemplate("'%file' -line %line")).toEqual(['%file', '-line', '%line']);
    });

    it('keeps adjacent quoted and unquoted fragments in a single token', () => {
      expect(parseEditorArgsTemplate('"%file":%line')).toEqual(['%file:%line']);
    });

    it('returns an empty array for empty or whitespace-only input', () => {
      expect(parseEditorArgsTemplate('')).toEqual([]);
      expect(parseEditorArgsTemplate('   \t  ')).toEqual([]);
      expect(parseEditorArgsTemplate(undefined)).toEqual([]);
      expect(parseEditorArgsTemplate(null)).toEqual([]);
    });

    it('decodes \\" and \\\\ inside double-quoted segments', () => {
      expect(parseEditorArgsTemplate('--msg "say \\"hi\\""')).toEqual(['--msg', 'say "hi"']);
      expect(parseEditorArgsTemplate('"a\\\\b"')).toEqual(['a\\b']);
    });

    it('leaves other backslash sequences inside double quotes untouched', () => {
      expect(parseEditorArgsTemplate('"\\s+ \\$PATH"')).toEqual(['\\s+ \\$PATH']);
    });

    it('treats single-quoted segments as fully literal', () => {
      expect(parseEditorArgsTemplate('\'say \\"hi\\"\'')).toEqual(['say \\"hi\\"']);
    });

    it('supports an emacsclient --eval template with escaped double quotes', () => {
      const template = '--eval "(tctony/persp-view-file-line-external \\"%file\\" %line)"';
      expect(parseEditorArgsTemplate(template)).toEqual([
        '--eval',
        '(tctony/persp-view-file-line-external "%file" %line)',
      ]);
    });
  });

  describe('buildEditorSpawnSpec', () => {
    it('returns null when the command is blank', () => {
      expect(
        buildEditorSpawnSpec({
          command: '',
          argsTemplate: '-l %line %file',
          filePath: '/tmp/file.ts',
          lineNumber: 1,
        }),
      ).toBeNull();
      expect(
        buildEditorSpawnSpec({
          command: '   ',
          argsTemplate: '%file',
          filePath: '/tmp/file.ts',
          lineNumber: 1,
        }),
      ).toBeNull();
    });

    it('trims the command and substitutes %file and %line', () => {
      const spec = buildEditorSpawnSpec({
        command: '  mate  ',
        argsTemplate: '-l %line "%file"',
        filePath: '/tmp/file.ts',
        lineNumber: 12,
      });
      expect(spec).toEqual({
        command: 'mate',
        args: ['-l', '12', '/tmp/file.ts'],
      });
    });

    it('substitutes line 1 when no line number is provided', () => {
      const spec = buildEditorSpawnSpec({
        command: 'mate',
        argsTemplate: '-l %line %file',
        filePath: '/tmp/file.ts',
        lineNumber: null,
      });
      expect(spec?.args).toEqual(['-l', '1', '/tmp/file.ts']);
    });

    it('returns an empty args array when the template is empty', () => {
      const spec = buildEditorSpawnSpec({
        command: 'my-editor',
        argsTemplate: '',
        filePath: '/tmp/file.ts',
        lineNumber: 3,
      });
      expect(spec).toEqual({ command: 'my-editor', args: [] });
    });

    it('builds a spawn spec for an emacsclient --eval elisp invocation', () => {
      const spec = buildEditorSpawnSpec({
        command: 'emacsclient',
        argsTemplate: '--eval "(tctony/persp-view-file-line-external \\"%file\\" %line)"',
        filePath: '/tmp/foo.ts',
        lineNumber: 42,
      });
      expect(spec).toEqual({
        command: 'emacsclient',
        args: ['--eval', '(tctony/persp-view-file-line-external "/tmp/foo.ts" 42)'],
      });
    });
  });
});
