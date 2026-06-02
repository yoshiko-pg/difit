import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

import type { DiffFile } from '../../types/diff';

import { DiffViewerHeader } from './DiffViewerHeader';

const file: DiffFile = {
  path: 'src/app.ts',
  status: 'modified',
  additions: 1,
  deletions: 1,
  chunks: [],
};

const baseProps = {
  file,
  isCollapsed: false,
  isReviewed: false,
  onToggleCollapsed: vi.fn(),
  onToggleAllCollapsed: vi.fn(),
  onToggleReviewed: vi.fn(),
};

describe('DiffViewerHeader', () => {
  it('shows the "Updated" badge when the file changed since last viewed', () => {
    render(<DiffViewerHeader {...baseProps} isChangedSinceViewed />);

    const badge = screen.getByLabelText('Updated since you last viewed this file');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Updated');
    expect(badge).toHaveAttribute('title', 'Updated since you last viewed this file');
  });

  it('hides the "Updated" badge once the file is marked as reviewed', () => {
    render(<DiffViewerHeader {...baseProps} isChangedSinceViewed isReviewed />);

    expect(
      screen.queryByLabelText('Updated since you last viewed this file'),
    ).not.toBeInTheDocument();
  });

  it('hides the "Updated" badge when the file is unchanged since last viewed', () => {
    render(<DiffViewerHeader {...baseProps} isChangedSinceViewed={false} />);

    expect(
      screen.queryByLabelText('Updated since you last viewed this file'),
    ).not.toBeInTheDocument();
  });
});
