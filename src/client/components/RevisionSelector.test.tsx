import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RevisionSelector } from './RevisionSelector';

vi.mock('lucide-react', () => ({
  ChevronDown: ({ size, className }: { size: number; className: string }) => (
    <div data-testid="chevron-icon" data-size={size} className={className}>
      ChevronDown
    </div>
  ),
  Search: ({ size, className }: { size: number; className: string }) => (
    <div data-testid="search-icon" data-size={size} className={className}>
      Search
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

    const workingOption = screen.getByRole('button', {
      name: 'Working Directory',
    });
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

  it('filters options by the search query', () => {
    render(<RevisionSelector label="Base" value="main" onChange={vi.fn()} options={options} />);

    fireEvent.click(screen.getByRole('button', { name: /Base:/ }));

    const searchInput = screen.getByPlaceholderText('Filter branches and commits...');
    fireEvent.change(searchInput, { target: { value: 'staging' } });

    expect(screen.getByRole('button', { name: 'Staging Area' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Working Directory' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'main' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Commit A/ })).not.toBeInTheDocument();
  });

  it('filters commits by hash and message', () => {
    render(<RevisionSelector label="Base" value="main" onChange={vi.fn()} options={options} />);

    fireEvent.click(screen.getByRole('button', { name: /Base:/ }));

    const searchInput = screen.getByPlaceholderText('Filter branches and commits...');
    fireEvent.change(searchInput, { target: { value: 'commit a' } });

    expect(screen.getByRole('button', { name: /abc1234/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'main' })).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing matches the query', () => {
    render(<RevisionSelector label="Base" value="main" onChange={vi.fn()} options={options} />);

    fireEvent.click(screen.getByRole('button', { name: /Base:/ }));

    const searchInput = screen.getByPlaceholderText('Filter branches and commits...');
    fireEvent.change(searchInput, { target: { value: 'does-not-exist' } });

    expect(screen.getByText('No matching branches or commits')).toBeInTheDocument();
  });

  it('selects the first enabled match when pressing Enter in the search box', () => {
    const onChange = vi.fn();
    render(<RevisionSelector label="Base" value="main" onChange={onChange} options={options} />);

    fireEvent.click(screen.getByRole('button', { name: /Base:/ }));

    const searchInput = screen.getByPlaceholderText('Filter branches and commits...');
    fireEvent.change(searchInput, { target: { value: 'commit a' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('abc1234');
  });

  it('skips disabled options when selecting with Enter', () => {
    const onChange = vi.fn();
    render(
      <RevisionSelector
        label="Base"
        value="main"
        onChange={onChange}
        options={options}
        disabledValues={['working']}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Base:/ }));

    const searchInput = screen.getByPlaceholderText('Filter branches and commits...');
    fireEvent.change(searchInput, { target: { value: 'working' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('hides reserved quick preset values from the special options list', () => {
    render(
      <RevisionSelector
        label="Base"
        value="main"
        onChange={vi.fn()}
        options={{
          ...options,
          specialOptions: [...options.specialOptions, { value: 'merge-base', label: 'Merge Base' }],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Base:/ }));

    expect(screen.queryByRole('button', { name: 'Merge Base' })).not.toBeInTheDocument();
  });
});
