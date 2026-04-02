import { fireEvent, render, screen, within } from '@testing-library/react';
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
  originDefaultBranch: 'origin/main',
};

describe('getPreviousCommitPreset', () => {
  it.each(['', '.', 'staged', 'working'])('uses HEAD as target for %s', (targetRevision) => {
    expect(getPreviousCommitPreset(targetRevision)).toEqual({
      baseCommitish: 'HEAD^',
      targetCommitish: 'HEAD',
    });
  });

  it('uses selected target when it is already a commit-ish', () => {
    expect(getPreviousCommitPreset('HEAD')).toEqual({
      baseCommitish: 'HEAD^^',
      targetCommitish: 'HEAD^',
    });

    expect(getPreviousCommitPreset('main')).toEqual({
      baseCommitish: 'main^^',
      targetCommitish: 'main^',
    });

    expect(getPreviousCommitPreset('abc1234')).toEqual({
      baseCommitish: 'abc1234^^',
      targetCommitish: 'abc1234^',
    });
  });
});

describe('DiffQuickMenu', () => {
  it('shows commit label when previous-pair target resolves to a listed commit', () => {
    render(
      createElement(DiffQuickMenu, {
        options,
        selection: { baseCommitish: 'HEAD^^', targetCommitish: 'HEAD^' },
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
        selection: { baseCommitish: 'HEAD^^', targetCommitish: 'HEAD^' },
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

  it('shows only requested quick diff presets', () => {
    render(
      createElement(DiffQuickMenu, {
        options,
        selection: { baseCommitish: 'HEAD', targetCommitish: '.' },
        onSelectDiff: vi.fn(),
        onOpenAdvanced: vi.fn(),
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Revision menu:/ }));

    expect(screen.getByRole('button', { name: 'HEAD...Uncommitted' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'main...Uncommitted' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'origin/main...Uncommitted' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'HEAD' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'HEAD...Staging' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Staging...Working' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'main...HEAD' })).not.toBeInTheDocument();
  });

  it('places HEAD at the top of quick diffs', () => {
    render(
      createElement(DiffQuickMenu, {
        options,
        selection: { baseCommitish: 'HEAD', targetCommitish: '.' },
        onSelectDiff: vi.fn(),
        onOpenAdvanced: vi.fn(),
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Revision menu:/ }));

    const quickDiffSection = screen.getByText('Quick Diffs').parentElement;
    expect(quickDiffSection).not.toBeNull();

    const quickDiffButtons = within(quickDiffSection!).getAllByRole('button');
    expect(quickDiffButtons[0]).toHaveTextContent('HEAD');
  });

  it('selects HEAD commit when HEAD quick preset is clicked', () => {
    const onSelectDiff = vi.fn();
    render(
      createElement(DiffQuickMenu, {
        options,
        selection: { baseCommitish: 'HEAD', targetCommitish: '.' },
        onSelectDiff,
        onOpenAdvanced: vi.fn(),
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Revision menu:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'HEAD' }));

    expect(onSelectDiff).toHaveBeenCalledWith({
      baseCommitish: 'HEAD^',
      targetCommitish: 'HEAD',
    });
  });

  it('selects origin/main quick preset when available', () => {
    const onSelectDiff = vi.fn();
    render(
      createElement(DiffQuickMenu, {
        options,
        selection: { baseCommitish: 'HEAD', targetCommitish: '.' },
        onSelectDiff,
        onOpenAdvanced: vi.fn(),
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Revision menu:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'origin/main...Uncommitted' }));

    expect(onSelectDiff).toHaveBeenCalledWith({
      baseCommitish: 'origin/main',
      targetCommitish: '.',
    });
  });
});
