import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SitePage from './SitePage';
import type { StaticDiffDataset } from './types/staticDiff';

const mockDataset: StaticDiffDataset = {
  generatedAt: new Date().toISOString(),
  repository: 'difit-demo',
  initialRevisionId: 'abc1234...def5678',
  revisions: [
    {
      id: 'abc1234...def5678',
      baseHash: 'abcdef1234567890',
      baseShortHash: 'abc1234',
      targetHash: 'def5678',
      targetShortHash: 'def5678',
      message: 'Add landing page header',
      authorName: 'Jane Doe',
      date: '2026-01-01T00:00:00.000Z',
    },
    {
      id: '1234567...89abcde',
      baseHash: '1234567',
      baseShortHash: '1234567',
      targetHash: '89abcde',
      targetShortHash: '89abcde',
      message: 'Fix style on diff',
      authorName: 'John Smith',
      date: '2026-01-02T00:00:00.000Z',
    },
  ],
  diffs: {},
};

describe('SitePage', () => {
  it('renders landing page with preview iframe', () => {
    render(<SitePage />);

    const frame = screen.getByTitle('difit live preview');
    expect(frame).toBeInTheDocument();
    expect(frame).toHaveAttribute('src', '/preview');
  });

  it('loads revisions for a preview selector and updates the iframe src', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockDataset), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<SitePage />);
    const frame = await screen.findByTitle('difit live preview');
    const select = await screen.findByLabelText('Revision');

    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('abc1234...def5678');
    expect(frame).toHaveAttribute('src', '/preview?snapshot=abc1234...def5678');

    vi.restoreAllMocks();
  });
});
