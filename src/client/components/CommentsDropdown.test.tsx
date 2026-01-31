import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { CommentsDropdown } from './CommentsDropdown';

describe('CommentsDropdown', () => {
  it('should show "View All Comments" option when dropdown is open', () => {
    const onCopyAll = vi.fn();
    const onDeleteAll = vi.fn();
    const onViewAll = vi.fn();

    render(
      <CommentsDropdown
        commentsCount={3}
        isCopiedAll={false}
        onCopyAll={onCopyAll}
        onDeleteAll={onDeleteAll}
        onViewAll={onViewAll}
      />,
    );

    // Click dropdown arrow
    const dropdownButton = screen.getByTitle('More options');
    fireEvent.click(dropdownButton);

    // Check "View All Comments" is visible
    expect(screen.getByText('View All Comments')).toBeInTheDocument();
  });

  it('should call onViewAll when "View All Comments" is clicked', () => {
    const onCopyAll = vi.fn();
    const onDeleteAll = vi.fn();
    const onViewAll = vi.fn();

    render(
      <CommentsDropdown
        commentsCount={3}
        isCopiedAll={false}
        onCopyAll={onCopyAll}
        onDeleteAll={onDeleteAll}
        onViewAll={onViewAll}
      />,
    );

    // Click dropdown arrow
    const dropdownButton = screen.getByTitle('More options');
    fireEvent.click(dropdownButton);

    // Click "View All Comments"
    const viewAllButton = screen.getByText('View All Comments');
    fireEvent.click(viewAllButton);

    expect(onViewAll).toHaveBeenCalledTimes(1);
  });

  it('should disable "View All Comments" when no comments', () => {
    const onCopyAll = vi.fn();
    const onDeleteAll = vi.fn();
    const onViewAll = vi.fn();

    render(
      <CommentsDropdown
        commentsCount={0}
        isCopiedAll={false}
        onCopyAll={onCopyAll}
        onDeleteAll={onDeleteAll}
        onViewAll={onViewAll}
      />,
    );

    // Click dropdown arrow
    const dropdownButton = screen.getByTitle('More options');
    fireEvent.click(dropdownButton);

    // Check "View All Comments" is disabled
    const viewAllButton = screen.getByText('View All Comments');
    expect(viewAllButton).toHaveAttribute('disabled');
  });
});
