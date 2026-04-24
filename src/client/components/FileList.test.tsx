import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

import type { DiffFile } from '../../types/diff';

import { FileList } from './FileList';

const createFile = (path: string): DiffFile => ({
  path,
  status: 'modified',
  additions: 1,
  deletions: 1,
  chunks: [],
});

function getTreeRowPaddingLeft(title: string): string {
  const row = screen.getByTitle(title).closest<HTMLElement>('[data-tree-row="true"]');
  expect(row).not.toBeNull();
  return row?.style.paddingLeft ?? '';
}

describe('FileList', () => {
  it('includes the row gap in nested tree indentation', () => {
    render(
      <FileList
        files={[
          createFile('README.md'),
          createFile('src/cli/index.ts'),
          createFile('src/client/App.tsx'),
        ]}
        onScrollToFile={vi.fn()}
        comments={[]}
        reviewedFiles={new Set()}
        onToggleReviewed={vi.fn()}
        selectedFileIndex={null}
      />,
    );

    expect(getTreeRowPaddingLeft('README.md')).toBe('16px');
    expect(getTreeRowPaddingLeft('src')).toBe('16px');
    expect(getTreeRowPaddingLeft('cli')).toBe('40px');
    expect(getTreeRowPaddingLeft('src/cli/index.ts')).toBe('64px');
  });
});
