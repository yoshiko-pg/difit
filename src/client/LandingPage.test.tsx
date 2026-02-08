import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { LandingPage } from './LandingPage';
import type { StaticDiffDataset } from './types/staticDiff';

const staticDataset: StaticDiffDataset = {
  generatedAt: '2026-02-08T00:00:00.000Z',
  repository: 'difit',
  initialRevisionId: 'aaaaaaa...bbbbbbb',
  revisions: [
    {
      id: 'aaaaaaa...bbbbbbb',
      baseHash: 'aaaaaaa111111111111111111111111111111111',
      baseShortHash: 'aaaaaaa',
      targetHash: 'bbbbbbb222222222222222222222222222222222',
      targetShortHash: 'bbbbbbb',
      message: 'feat: snapshot',
      authorName: 'Tester',
      date: '2026-02-08T00:00:00.000Z',
    },
  ],
  diffs: {
    'aaaaaaa...bbbbbbb': {
      commit: 'aaaaaaa...bbbbbbb',
      files: [],
      isEmpty: true,
    },
  },
};

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => staticDataset,
    });
  });

  it('renders the interactive difit iframe at the top', async () => {
    render(<LandingPage />);

    await waitFor(() => {
      const frame = screen.getByTitle('difit live preview');
      expect(frame).toBeInTheDocument();
      expect(frame).toHaveAttribute('src', '/app-static?snapshot=aaaaaaa...bbbbbbb');
    });
  });

  it('shows a quick-start command', () => {
    render(<LandingPage />);

    expect(screen.getByText('pnpm dlx difit HEAD')).toBeInTheDocument();
  });
});
