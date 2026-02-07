import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DiffQuickMenu, getPreviousCommitPreset } from './DiffQuickMenu';

const options = {
  specialOptions: [
    { value: '.', label: 'All Uncommitted Changes' },
    { value: 'staged', label: 'Staging Area' },
    { value: 'working', label: 'Working Directory' },
  ],
  branches: [{ name: 'main', current: true }],
  commits: [
    {
      hash: '1f23cd1aaaaabbbbbcccccdddddeeeeefffff000',
      shortHash: '1f23cd1',
      message: 'chore: release v3.1.5',
    },
  ],
};

describe('getPreviousCommitPreset', () => {
  it.each(['', '.', 'staged', 'working'])('uses HEAD as target for %s', (targetRevision) => {
    expect(getPreviousCommitPreset(targetRevision)).toEqual({
      base: 'HEAD^',
      target: 'HEAD',
    });
  });

  it('uses selected target when it is already a commit-ish', () => {
    expect(getPreviousCommitPreset('HEAD')).toEqual({
      base: 'HEAD^^',
      target: 'HEAD^',
    });

    expect(getPreviousCommitPreset('main')).toEqual({
      base: 'main^^',
      target: 'main^',
    });

    expect(getPreviousCommitPreset('abc1234')).toEqual({
      base: 'abc1234^^',
      target: 'abc1234^',
    });
  });
});

describe('DiffQuickMenu', () => {
  it('shows commit label when previous-pair target resolves to a listed commit', () => {
    render(
      createElement(DiffQuickMenu, {
        options,
        baseRevision: 'HEAD^^',
        targetRevision: 'HEAD^',
        resolvedBaseRevision: '88aabb0',
        resolvedTargetRevision: '1f23cd1',
        onSelectDiff: vi.fn(),
        onOpenAdvanced: vi.fn(),
      }),
    );

    expect(screen.getByText('1f23cd1 chore: release v3.1.5')).toBeInTheDocument();
  });

  it('highlights resolved commit in Pick Commit list for previous-pair selection', async () => {
    render(
      createElement(DiffQuickMenu, {
        options,
        baseRevision: 'HEAD^^',
        targetRevision: 'HEAD^',
        resolvedBaseRevision: '88aabb0',
        resolvedTargetRevision: '1f23cd1',
        onSelectDiff: vi.fn(),
        onOpenAdvanced: vi.fn(),
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Revision menu:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick Commit...' }));

    const commitButtons = await screen.findAllByRole('button', { name: /1f23cd1/ });
    const highlightedCommitButton = commitButtons.find((button) =>
      button.className.includes('border-l-diff-selected-border'),
    );
    expect(highlightedCommitButton).toBeDefined();
  });
});
