import { fireEvent, render, screen } from '@testing-library/react';
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
    const menuButton = await screen.findByRole('button', {
      name: /Revision menu: \[def5678\] Add landing page header/,
    });

    expect(menuButton).toBeInTheDocument();
    expect(frame).toHaveAttribute('src', '/preview?snapshot=abc1234...def5678');

    fireEvent.click(menuButton);
    fireEvent.click(await screen.findByRole('button', { name: /89abcde Fix style on diff/ }));

    expect(frame).toHaveAttribute('src', '/preview?snapshot=1234567...89abcde');

    vi.restoreAllMocks();
  });

  it('switches language in place for hero, features, and usage comments', () => {
    render(<SitePage />);

    expect(screen.getByText(/GitHub-style diff viewer for local git\./)).toBeInTheDocument();
    expect(screen.getByText(/multi-source input/)).toBeInTheDocument();
    expect(screen.getByText(/view single commit diff/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'JA' }));

    expect(screen.getByText(/ローカルgitのためのGitHubスタイル差分ビューア。/)).toBeInTheDocument();
    expect(screen.getByText(/多様な入力対応/)).toBeInTheDocument();
    expect(screen.getByText(/単一コミットの差分を表示/)).toBeInTheDocument();
  });

  it('switches feature content when a tab is clicked', () => {
    render(<SitePage />);

    expect(screen.getByText(/multi-source input/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '3:agents' }));

    expect(screen.getByText(/AI agent bridge/)).toBeInTheDocument();
    expect(screen.queryByText(/multi-source input/)).not.toBeInTheDocument();
  });
});
