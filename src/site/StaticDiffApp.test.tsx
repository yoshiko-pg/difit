import { render, screen, waitFor } from '@testing-library/react';
import { HotkeysProvider } from 'react-hotkeys-hook';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import StaticDiffApp from './StaticDiffApp';
import type { StaticDiffDataset, StaticDiffManifest, StaticDiffSnapshot } from './types/staticDiff';

const staticDataset: StaticDiffDataset = {
  generatedAt: '2026-02-08T00:00:00.000Z',
  repository: 'difit',
  initialRevisionId: '1111111...2222222',
  revisions: [
    {
      id: '1111111...2222222',
      baseHash: '1111111222222233333334444444555555566666',
      baseShortHash: '1111111',
      targetHash: '2222222333333344444445555555666666677777',
      targetShortHash: '2222222',
      message: 'feat: first snapshot',
      authorName: 'Tester',
      date: '2026-02-08T00:00:00.000Z',
    },
    {
      id: '2222222...3333333',
      baseHash: '2222222333333344444445555555666666677777',
      baseShortHash: '2222222',
      targetHash: '3333333444444455555556666666777777788888',
      targetShortHash: '3333333',
      message: 'fix: second snapshot',
      authorName: 'Tester',
      date: '2026-02-07T00:00:00.000Z',
    },
  ],
  diffs: {
    '1111111...2222222': {
      commit: '1111111...2222222',
      baseCommitish: '1111111',
      targetCommitish: '2222222',
      files: [
        {
          path: 'src/first.ts',
          status: 'modified',
          additions: 1,
          deletions: 1,
          chunks: [
            {
              header: '@@ -1 +1 @@',
              oldStart: 1,
              oldLines: 1,
              newStart: 1,
              newLines: 1,
              lines: [
                { type: 'delete', content: 'const version = 1;', oldLineNumber: 1 },
                { type: 'add', content: 'const version = 2;', newLineNumber: 1 },
              ],
            },
          ],
        },
      ],
      isEmpty: false,
      ignoreWhitespace: true,
      mode: 'split',
      requestedBaseCommitish: '1111111',
      requestedTargetCommitish: '2222222',
    },
    '2222222...3333333': {
      commit: '2222222...3333333',
      baseCommitish: '2222222',
      targetCommitish: '3333333',
      files: [
        {
          path: 'src/second.ts',
          status: 'added',
          additions: 1,
          deletions: 0,
          chunks: [
            {
              header: '@@ -0,0 +1 @@',
              oldStart: 0,
              oldLines: 0,
              newStart: 1,
              newLines: 1,
              lines: [{ type: 'add', content: 'export const v = 3;', newLineNumber: 1 }],
            },
          ],
        },
      ],
      isEmpty: false,
      ignoreWhitespace: true,
      mode: 'split',
      requestedBaseCommitish: '2222222',
      requestedTargetCommitish: '3333333',
    },
  },
  blobs: {
    '2222222:src/first.ts': 'const version = 2;\n',
    '3333333:src/second.ts': 'export const v = 3;\n',
  },
  comments: {
    '2222222...3333333': [
      {
        id: 'static-comment-thread',
        filePath: 'src/second.ts',
        createdAt: '2026-02-08T00:00:00.000Z',
        updatedAt: '2026-02-08T00:00:00.000Z',
        position: {
          side: 'new',
          line: 1,
        },
        messages: [
          {
            id: 'static-comment-message',
            body: 'Static snapshot comment',
            author: 'Reviewer',
            createdAt: '2026-02-08T00:00:00.000Z',
            updatedAt: '2026-02-08T00:00:00.000Z',
          },
        ],
      },
    ],
  },
};

const staticManifest: StaticDiffManifest = {
  generatedAt: staticDataset.generatedAt,
  repository: staticDataset.repository,
  initialRevisionId: staticDataset.initialRevisionId,
  revisions: staticDataset.revisions,
};

const staticSnapshots: Record<string, StaticDiffSnapshot> = Object.fromEntries(
  staticDataset.revisions.map((revision) => [
    revision.id,
    {
      revision,
      diff: staticDataset.diffs[revision.id]!,
      blobs: staticDataset.blobs,
      blobUrls: staticDataset.blobUrls,
      comments: staticDataset.comments?.[revision.id] ?? [],
    },
  ]),
);

describe('StaticDiffApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/preview');
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const target = String(input);
      if (target.includes('/site-data/manifest.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => staticManifest,
        });
      }

      const snapshotId = target.match(/\/site-data\/snapshots\/(.+)\.json/)?.[1];
      if (snapshotId) {
        const snapshot = staticSnapshots[decodeURIComponent(snapshotId)];
        return Promise.resolve({
          ok: Boolean(snapshot),
          status: snapshot ? 200 : 404,
          statusText: snapshot ? 'OK' : 'Not Found',
          json: async () => snapshot,
        });
      }

      return Promise.reject(new Error(`Unexpected fetch in test: ${target}`));
    }) as unknown as typeof fetch;
  });

  it('loads static dataset and renders first snapshot', async () => {
    render(
      <HotkeysProvider initiallyActiveScopes={['navigation']}>
        <StaticDiffApp />
      </HotkeysProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('src/first.ts')).toBeInTheDocument();
    });
  });

  it('applies snapshot query and renders requested revision', async () => {
    window.history.pushState({}, '', '/preview?snapshot=2222222...3333333');
    render(
      <HotkeysProvider initiallyActiveScopes={['navigation']}>
        <StaticDiffApp />
      </HotkeysProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('src/second.ts')).toBeInTheDocument();
    });
  });

  it('disables open in editor in static snapshot mode', async () => {
    render(
      <HotkeysProvider initiallyActiveScopes={['navigation']}>
        <StaticDiffApp />
      </HotkeysProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('src/first.ts')).toBeInTheDocument();
    });

    const response = await fetch('/api/diff');
    const data = (await response.json()) as { openInEditorAvailable?: boolean };
    expect(data.openInEditorAvailable).toBe(false);
  });

  it('serves static blob content for preview-backed viewers', async () => {
    render(
      <HotkeysProvider initiallyActiveScopes={['navigation']}>
        <StaticDiffApp />
      </HotkeysProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('src/first.ts')).toBeInTheDocument();
    });

    const response = await fetch('/api/blob/src%2Ffirst.ts?ref=2222222');
    expect(response.ok).toBe(true);
    await expect(response.text()).resolves.toBe('const version = 2;\n');
  });

  it('serves snapshot-specific static comments', async () => {
    window.history.pushState({}, '', '/preview?snapshot=2222222...3333333');
    render(
      <HotkeysProvider initiallyActiveScopes={['navigation']}>
        <StaticDiffApp />
      </HotkeysProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('src/second.ts')).toBeInTheDocument();
    });

    const response = await fetch('/api/comments-json');
    const data = (await response.json()) as { threads?: Array<{ id: string }> };
    expect(data.threads).toEqual([expect.objectContaining({ id: 'static-comment-thread' })]);
  });
});
