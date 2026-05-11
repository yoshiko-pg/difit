import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SitePage from './SitePage';
import type { StaticDiffManifest } from './types/staticDiff';

const mockManifest: StaticDiffManifest = {
  repository: 'difit-demo',
  initialRevisionId: 'abc1234...def5678',
  revisions: [
    {
      id: 'abc1234...def5678',
      demoTitle: 'Large implementation diff',
      demoTitleByLanguage: {
        ja: '大きな実装diff',
      },
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
};

describe('SitePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads revisions for a preview selector and updates the iframe src', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockManifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<SitePage />);
    const frame = await screen.findByTitle('difit live preview');
    const menuButton = await screen.findByRole('button', {
      name: /Revision menu: Large implementation diff/,
    });

    expect(menuButton).toBeInTheDocument();
    expect(frame).toHaveAttribute('src', '/preview?snapshot=abc1234...def5678');

    fireEvent.click(menuButton);
    expect(
      screen.queryByText('A broad feature diff for the landing page demo.'),
    ).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /89abcde Fix style on diff/ }));

    expect(frame).toHaveAttribute('src', '/preview?snapshot=1234567...89abcde');
  });
});
