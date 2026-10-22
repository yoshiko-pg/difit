import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CommentForm } from './CommentForm';

describe('CommentForm', () => {
  it('marks the cancel action independently from other form buttons', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <CommentForm onSubmit={vi.fn()} onCancel={onCancel} selectedCode="const value = 1;" />,
    );

    const cancelButton = container.querySelector<HTMLButtonElement>('[data-comment-cancel="true"]');
    expect(cancelButton).toBe(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(cancelButton!);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('hides the question toggle unless enabled', () => {
    render(<CommentForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('checkbox', { name: 'Question' })).not.toBeInTheDocument();
  });

  it('submits the question flag when the toggle is checked', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CommentForm onSubmit={onSubmit} onCancel={vi.fn()} showQuestionToggle={true} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Why is this cached?' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Question' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('Why is this cached?', { isQuestion: true }),
    );
  });
});
