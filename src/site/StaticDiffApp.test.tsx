import { render, screen, waitFor } from '@testing-library/react';
import { HotkeysProvider } from 'react-hotkeys-hook';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import StaticDiffApp from './StaticDiffApp';
import type { StaticDiffDataset } from './types/staticDiff';

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
};

describe('StaticDiffApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/app-static');
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const target = String(input);
      if (target.includes('/landing-data/diffs.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => staticDataset,
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
    window.history.pushState({}, '', '/app-static?snapshot=2222222...3333333');
    render(
      <HotkeysProvider initiallyActiveScopes={['navigation']}>
        <StaticDiffApp />
      </HotkeysProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('src/second.ts')).toBeInTheDocument();
    });
  });
});
