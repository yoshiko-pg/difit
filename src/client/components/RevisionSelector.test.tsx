import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RevisionSelector } from './RevisionSelector';

vi.mock('lucide-react', () => ({
  ChevronDown: ({ size, className }: { size: number; className: string }) => (
    <div data-testid="chevron-icon" data-size={size} className={className}>
      ChevronDown
    </div>
  ),
}));

describe('RevisionSelector', () => {
  const options = {
    specialOptions: [
      { value: '.', label: 'All Uncommitted Changes' },
      { value: 'staged', label: 'Staging Area' },
      { value: 'working', label: 'Working Directory' },
    ],
    branches: [{ name: 'main', current: false }],
    commits: [{ hash: 'abc1234', shortHash: 'abc1234', message: 'Commit A' }],
  };

  it('renders special options and keeps working disabled when specified', () => {
    render(
      <RevisionSelector
        label="Base"
        value="main"
        onChange={vi.fn()}
        options={options}
        disabledValues={['working']}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Base:/ }));

    const workingOption = screen.getByRole('button', { name: 'Working Directory' });
    expect(workingOption).toBeDisabled();
  });

  it('highlights selected branch and resolved commit', () => {
    render(
      <RevisionSelector
        label="Target"
        value="main"
        resolvedValue="abc1234"
        onChange={vi.fn()}
        options={options}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Target:/ }));

    const branchButton = screen.getByRole('button', { name: 'main' });
    const commitButton = screen.getByRole('button', { name: /abc1234/ });

    expect(branchButton).toHaveClass('border-l-diff-selected-border');
    expect(commitButton).toHaveClass('border-l-diff-selected-border');
  });
});
