import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

import type { DiffFile } from '../../types/diff';

import { FileList } from './FileList';

const createFile = (
  path: string,
  totals: { additions?: number; deletions?: number } = {},
): DiffFile => ({
  path,
  status: 'modified',
  additions: totals.additions ?? 1,
  deletions: totals.deletions ?? 1,
  chunks: [],
});

describe('FileList', () => {
  it('renders total additions and deletions beside the file count', () => {
    render(
      <FileList
        files={[
          createFile('README.md', { additions: 3, deletions: 1 }),
          createFile('src/client/App.tsx', { additions: 2, deletions: 4 }),
        ]}
        onScrollToFile={vi.fn()}
        comments={[]}
        reviewedFiles={new Set()}
        onToggleReviewed={vi.fn()}
        selectedFileIndex={null}
      />,
    );

    expect(screen.getByText('Files changed (2)')).toBeInTheDocument();
    expect(screen.getByLabelText('5 additions and 5 deletions')).toBeInTheDocument();
    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('-5')).toBeInTheDocument();
  });
});
