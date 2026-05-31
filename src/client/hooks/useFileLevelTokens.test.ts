import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DiffFile } from '../../types/diff';

import { useFileLevelTokens } from './useFileLevelTokens';

const VUE_FILE_V1 = `<template>
  <div class="greeting">{{ message }}</div>
</template>

<script setup>
import { ref } from 'vue';
const message = ref('hello');
</script>

<style scoped>
.greeting {
  color: rebeccapurple;
}
</style>
`;

const VUE_FILE_V2 = `<template>
  <div class="greeting">{{ message }}</div>
</template>

<script setup>
import { ref } from 'vue';
const message = ref('updated');
</script>

<style scoped>
.greeting {
  color: tomato;
}
</style>
`;

function createVueFile(): DiffFile {
  return {
    path: 'src/Sample.vue',
    status: 'modified',
    additions: 1,
    deletions: 1,
    chunks: [],
  };
}

function createTsFile(): DiffFile {
  return {
    path: 'src/sample.ts',
    status: 'modified',
    additions: 1,
    deletions: 1,
    chunks: [],
  };
}

function mockBlobFetch(payload: Record<string, string>) {
  vi.mocked(global.fetch).mockImplementation((input: string | URL | Request) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');
    const ref = url.searchParams.get('ref') ?? '';
    const body = payload[ref];
    if (body == null) {
      return Promise.resolve({ ok: false, text: async () => '' } as Response);
    }
    return Promise.resolve({ ok: true, text: async () => body } as Response);
  });
}

describe('useFileLevelTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enabled=trueのときVue SFCの<script>ブロック内をJavaScriptとしてトークン化する', async () => {
    mockBlobFetch({ HEAD: VUE_FILE_V1, '.': VUE_FILE_V1 });

    const { result } = renderHook(() =>
      useFileLevelTokens({
        file: createVueFile(),
        enabled: true,
        baseCommitish: 'HEAD',
        targetCommitish: '.',
      }),
    );

    await waitFor(() => {
      expect(result.current.getNewTokens).not.toBeNull();
    });

    const tokensL7 = result.current.getNewTokens?.(7) ?? [];
    expect(tokensL7.length).toBeGreaterThan(0);
    expect(tokensL7.some((t) => t.types.includes('keyword') && t.content === 'const')).toBe(true);
    expect(tokensL7.some((t) => t.types.includes('function') && t.content === 'ref')).toBe(true);
  });

  it('enabled=trueのときVue SFCの<style>ブロック内をCSSとしてトークン化する', async () => {
    mockBlobFetch({ HEAD: VUE_FILE_V1, '.': VUE_FILE_V1 });

    const { result } = renderHook(() =>
      useFileLevelTokens({
        file: createVueFile(),
        enabled: true,
        baseCommitish: 'HEAD',
        targetCommitish: '.',
      }),
    );

    await waitFor(() => {
      expect(result.current.getNewTokens).not.toBeNull();
    });

    const tokensL12 = result.current.getNewTokens?.(12) ?? [];
    expect(tokensL12.some((t) => t.types.includes('property') && t.content === 'color')).toBe(true);
  });

  it('enabled=falseのときは拡張子に関係なくfetchせずgetterはnullのまま', async () => {
    const { result } = renderHook(() =>
      useFileLevelTokens({
        file: createVueFile(),
        enabled: false,
        baseCommitish: 'HEAD',
        targetCommitish: '.',
      }),
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.getOldTokens).toBeNull();
    expect(result.current.getNewTokens).toBeNull();
  });

  it('enabled=trueなら.tsファイルでもファイル単位トークン化する（拡張子で判断しない）', async () => {
    const tsContent = "const greeting = 'hi';\n";
    mockBlobFetch({ HEAD: tsContent, '.': tsContent });

    const { result } = renderHook(() =>
      useFileLevelTokens({
        file: createTsFile(),
        enabled: true,
        baseCommitish: 'HEAD',
        targetCommitish: '.',
      }),
    );

    await waitFor(() => {
      expect(result.current.getNewTokens).not.toBeNull();
    });

    const tokensL1 = result.current.getNewTokens?.(1) ?? [];
    expect(tokensL1.some((t) => t.types.includes('keyword') && t.content === 'const')).toBe(true);
  });

  it('2000行を超えるファイルはトークン化せずper-lineにフォールバックする', async () => {
    const content = Array.from({ length: 2001 }, () => "const x = 'a';").join('\n');
    mockBlobFetch({ HEAD: content, '.': content });

    const { result } = renderHook(() =>
      useFileLevelTokens({
        file: createTsFile(),
        enabled: true,
        baseCommitish: 'HEAD',
        targetCommitish: '.',
      }),
    );

    // Wait until the blob fetch has resolved so the tokens memo has run.
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(result.current.getNewTokens).toBeNull();
    expect(result.current.getOldTokens).toBeNull();
  });

  it('ちょうど2000行のファイルはトークン化する（境界）', async () => {
    const content = Array.from({ length: 2000 }, () => "const x = 'a';").join('\n');
    mockBlobFetch({ HEAD: content, '.': content });

    const { result } = renderHook(() =>
      useFileLevelTokens({
        file: createTsFile(),
        enabled: true,
        baseCommitish: 'HEAD',
        targetCommitish: '.',
      }),
    );

    await waitFor(() => {
      expect(result.current.getNewTokens).not.toBeNull();
    });

    const tokensL1 = result.current.getNewTokens?.(1) ?? [];
    expect(tokensL1.some((t) => t.types.includes('keyword') && t.content === 'const')).toBe(true);
  });

  it('reloadKeyが変わるとblobを再フェッチして最新内容でトークン化する', async () => {
    const responses: Record<string, string> = { HEAD: VUE_FILE_V1, '.': VUE_FILE_V1 };
    mockBlobFetch(responses);

    const { result, rerender } = renderHook(
      ({ reloadKey }) =>
        useFileLevelTokens({
          file: createVueFile(),
          enabled: true,
          baseCommitish: 'HEAD',
          targetCommitish: '.',
          reloadKey,
        }),
      { initialProps: { reloadKey: 1 } },
    );

    await waitFor(() => {
      const tokens = result.current.getNewTokens?.(7) ?? [];
      expect(tokens.some((t) => t.types.includes('string') && t.content === "'hello'")).toBe(true);
    });

    const fetchCallsAfterFirstLoad = vi.mocked(global.fetch).mock.calls.length;

    responses['.'] = VUE_FILE_V2;
    responses['HEAD'] = VUE_FILE_V2;

    rerender({ reloadKey: 2 });

    await waitFor(() => {
      const tokens = result.current.getNewTokens?.(7) ?? [];
      expect(tokens.some((t) => t.types.includes('string') && t.content === "'updated'")).toBe(
        true,
      );
    });

    expect(vi.mocked(global.fetch).mock.calls.length).toBeGreaterThan(fetchCallsAfterFirstLoad);
  });

  it('追加ファイルでは新側のみフェッチし、削除ファイルでは旧側のみフェッチする', async () => {
    mockBlobFetch({ HEAD: VUE_FILE_V1, '.': VUE_FILE_V1 });

    const { result: addedResult } = renderHook(() =>
      useFileLevelTokens({
        file: { ...createVueFile(), status: 'added' },
        enabled: true,
        baseCommitish: 'HEAD',
        targetCommitish: '.',
      }),
    );

    await waitFor(() => {
      expect(addedResult.current.getNewTokens).not.toBeNull();
    });
    expect(addedResult.current.getOldTokens).toBeNull();

    vi.clearAllMocks();
    mockBlobFetch({ HEAD: VUE_FILE_V1, '.': VUE_FILE_V1 });

    const { result: deletedResult } = renderHook(() =>
      useFileLevelTokens({
        file: { ...createVueFile(), status: 'deleted' },
        enabled: true,
        baseCommitish: 'HEAD',
        targetCommitish: '.',
      }),
    );

    await waitFor(() => {
      expect(deletedResult.current.getOldTokens).not.toBeNull();
    });
    expect(deletedResult.current.getNewTokens).toBeNull();
  });
});
