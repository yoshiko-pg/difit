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

function getTreeRow(title: string): HTMLElement {
  const row = screen.getByTitle(title).closest<HTMLElement>('[data-tree-row="true"]');
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

function getLabel(title: string): HTMLElement {
  return screen.getByTitle(title);
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

  it('strikes through directories when all descendant files are reviewed', () => {
    const files = [
      createFile('src/cli/index.ts'),
      createFile('src/client/App.tsx'),
      createFile('README.md'),
    ];
    const props = {
      files,
      onScrollToFile: vi.fn(),
      comments: [],
      onToggleReviewed: vi.fn(),
      selectedFileIndex: null,
    };
    const { rerender } = render(
      <FileList {...props} reviewedFiles={new Set(['README.md', 'src/cli/index.ts'])} />,
    );

    expect(getLabel('src')).not.toHaveClass('line-through');
    expect(getTreeRow('src')).not.toHaveClass('opacity-70');
    expect(getLabel('cli')).toHaveClass('line-through');
    expect(getTreeRow('cli')).toHaveClass('opacity-70');
    expect(getLabel('client')).not.toHaveClass('line-through');
    expect(getTreeRow('client')).not.toHaveClass('opacity-70');

    rerender(
      <FileList
        {...props}
        reviewedFiles={new Set(['README.md', 'src/cli/index.ts', 'src/client/App.tsx'])}
      />,
    );

    expect(getLabel('src')).toHaveClass('line-through');
    expect(getTreeRow('src')).toHaveClass('opacity-70');
    expect(getLabel('cli')).toHaveClass('line-through');
    expect(getTreeRow('cli')).toHaveClass('opacity-70');
    expect(getLabel('client')).toHaveClass('line-through');
    expect(getTreeRow('client')).toHaveClass('opacity-70');
  });
});
