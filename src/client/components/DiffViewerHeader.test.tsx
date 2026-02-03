import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { DiffFile } from '../../types/diff';

import { DiffViewerHeader } from './DiffViewerHeader';

const createMockFile = (overrides: Partial<DiffFile> = {}): DiffFile => ({
  path: 'src/test.ts',
  status: 'modified',
  additions: 10,
  deletions: 5,
  chunks: [],
  ...overrides,
});

describe('DiffViewerHeader', () => {
  const defaultProps = {
    file: createMockFile(),
    isCollapsed: false,
    isReviewed: false,
    onToggleCollapsed: vi.fn(),
    onToggleAllCollapsed: vi.fn(),
    onToggleReviewed: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders file path', () => {
    render(<DiffViewerHeader {...defaultProps} />);
    expect(screen.getByText('src/test.ts')).toBeInTheDocument();
  });

  it('renders additions and deletions count', () => {
    render(<DiffViewerHeader {...defaultProps} />);
    expect(screen.getByText('+10')).toBeInTheDocument();
    expect(screen.getByText('-5')).toBeInTheDocument();
  });

  it('renders Viewed button', () => {
    render(<DiffViewerHeader {...defaultProps} />);
    expect(screen.getByText('Viewed')).toBeInTheDocument();
  });

  it('calls onToggleReviewed when Viewed button is clicked', () => {
    render(<DiffViewerHeader {...defaultProps} />);
    fireEvent.click(screen.getByText('Viewed'));
    expect(defaultProps.onToggleReviewed).toHaveBeenCalledWith('src/test.ts');
  });

  it('calls onToggleCollapsed when collapse button is clicked', () => {
    render(<DiffViewerHeader {...defaultProps} />);
    const collapseButton = screen.getByTitle('Collapse file (Alt+Click to collapse all)');
    fireEvent.click(collapseButton);
    expect(defaultProps.onToggleCollapsed).toHaveBeenCalledWith('src/test.ts');
  });
});
