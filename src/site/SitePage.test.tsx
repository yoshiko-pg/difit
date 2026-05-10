import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SitePage from './SitePage';
import type { StaticDiffManifest } from './types/staticDiff';

const mockManifest: StaticDiffManifest = {
  generatedAt: new Date().toISOString(),
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

  it('renders landing page with preview iframe', () => {
    render(<SitePage />);

    const frame = screen.getByTitle('difit live preview');
    expect(frame).toBeInTheDocument();
    expect(frame).toHaveAttribute('src', '/preview');
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

  it('uses the browser language for the initial localized copy', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ja-JP', 'en-US']);
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('ja-JP');

    render(<SitePage />);

    expect(screen.getByText(/ローカルgitのためのGitHubスタイル差分ビューア。/)).toBeInTheDocument();
    expect(screen.getByText(/今すぐ試す/)).toBeInTheDocument();
    expect(screen.getByText(/単一コミットの差分を表示/)).toBeInTheDocument();
  });

  it('switches language in place for hero and shell comments', () => {
    render(<SitePage />);

    expect(screen.getByText(/GitHub-style diff viewer for local git\./)).toBeInTheDocument();
    expect(screen.getByText(/Try it now/)).toBeInTheDocument();
    expect(screen.getByText(/view single commit diff/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'JA' }));

    expect(screen.getByText(/ローカルgitのためのGitHubスタイル差分ビューア。/)).toBeInTheDocument();
    expect(screen.getByText(/今すぐ試す/)).toBeInTheDocument();
    expect(screen.getByText(/単一コミットの差分を表示/)).toBeInTheDocument();
    expect(screen.getByText(/表示される画面 ↓/)).toBeInTheDocument();
    expect(screen.getByText(/GitHubでスター ⭐️/)).toBeInTheDocument();
  });

  it('switches revision selector title by language without showing a description line', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockManifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<SitePage />);

    const menuButton = await screen.findByRole('button', {
      name: /Revision menu: Large implementation diff/,
    });

    fireEvent.click(screen.getByRole('button', { name: 'JA' }));

    expect(
      await screen.findByRole('button', { name: /Revision menu: 大きな実装diff/ }),
    ).toBeInTheDocument();

    fireEvent.click(menuButton);

    expect(screen.queryByText('ランディングページデモ用の広い機能差分。')).not.toBeInTheDocument();
    expect(screen.queryByText('ランディングページのヘッダーを追加')).not.toBeInTheDocument();
  });

  it('keeps the revision selector trigger width fixed and stacks chrome on mobile', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockManifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<SitePage />);

    const menuButton = await screen.findByRole('button', {
      name: /Revision menu: Large implementation diff/,
    });
    const triggerFrame = menuButton.firstElementChild;
    expect(triggerFrame).toHaveClass('w-[220px]');
    expect(triggerFrame).toHaveClass('sm:w-[260px]');
    expect(triggerFrame?.querySelector('code')).toHaveClass('flex-1');

    const revisionLabel = screen.getByText('Revision:');
    const chrome = revisionLabel.parentElement?.parentElement;
    expect(chrome).toBeDefined();
    expect(chrome!).toHaveClass('flex-col');
    expect(chrome!).toHaveClass('sm:flex-row');
  });

  it('does not render the removed feature tab window', () => {
    render(<SitePage />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText(/multi-source input/)).not.toBeInTheDocument();
  });
});
