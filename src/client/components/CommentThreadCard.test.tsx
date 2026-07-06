import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CommentThread } from '../../types/diff';

import { CommentThreadCard } from './CommentThreadCard';

const mockThread: CommentThread = {
  id: 'thread-1',
  file: 'src/client/components/CommentThreadCard.tsx',
  line: 80,
  side: 'new',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  codeContent: 'const value = 1;',
  messages: [
    {
      id: 'message-1',
      body: 'Root comment',
      author: 'User',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'message-2',
      body: 'Reply comment',
      author: 'Reviewer',
      createdAt: '2024-01-01T00:01:00Z',
      updatedAt: '2024-01-01T00:01:00Z',
    },
  ],
};

describe('CommentThreadCard', () => {
  it('does not show delete action for replies authored by someone else', () => {
    render(
      <CommentThreadCard
        thread={mockThread}
        onGeneratePrompt={() => 'thread prompt'}
        onRemoveThread={vi.fn()}
        onReplyToThread={vi.fn().mockResolvedValue(undefined)}
        onRemoveMessage={vi.fn()}
        onUpdateMessage={vi.fn()}
      />,
    );

    expect(screen.getByText('Reply comment')).toBeInTheDocument();
    expect(screen.queryByTitle('Delete reply')).not.toBeInTheDocument();
  });

  it('keeps resolve available for root comments even when not authored by the user', () => {
    render(
      <CommentThreadCard
        thread={{
          ...mockThread,
          messages: [
            {
              ...mockThread.messages[0]!,
              author: 'Reviewer',
            },
          ],
        }}
        onGeneratePrompt={() => 'thread prompt'}
        onRemoveThread={vi.fn()}
        onReplyToThread={vi.fn().mockResolvedValue(undefined)}
        onRemoveMessage={vi.fn()}
        onUpdateMessage={vi.fn()}
      />,
    );

    expect(screen.getByTitle('Resolve thread')).toBeInTheDocument();
    expect(screen.queryByTitle('Edit message')).not.toBeInTheDocument();
  });

  it('shows an inline confirmation before resolving a root comment by default', async () => {
    const user = userEvent.setup();
    const onRemoveThread = vi.fn();

    render(
      <CommentThreadCard
        thread={mockThread}
        onGeneratePrompt={() => 'thread prompt'}
        onRemoveThread={onRemoveThread}
        onReplyToThread={vi.fn().mockResolvedValue(undefined)}
        onRemoveMessage={vi.fn()}
        onUpdateMessage={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle('Resolve thread'));

    expect(onRemoveThread).not.toHaveBeenCalled();
    expect(screen.getByText('Resolve?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Resolve' }));

    expect(onRemoveThread).toHaveBeenCalledWith('thread-1');
  });

  it('cancels the inline resolve confirmation with the cancel button', async () => {
    const user = userEvent.setup();
    const onRemoveThread = vi.fn();

    render(
      <CommentThreadCard
        thread={mockThread}
        onGeneratePrompt={() => 'thread prompt'}
        onRemoveThread={onRemoveThread}
        onReplyToThread={vi.fn().mockResolvedValue(undefined)}
        onRemoveMessage={vi.fn()}
        onUpdateMessage={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle('Resolve thread'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onRemoveThread).not.toHaveBeenCalled();
    expect(screen.queryByText('Resolve?')).not.toBeInTheDocument();
    expect(screen.getByTitle('Resolve thread')).toBeInTheDocument();
  });

  it('cancels the inline resolve confirmation with Escape', async () => {
    const user = userEvent.setup();
    const onRemoveThread = vi.fn();

    render(
      <CommentThreadCard
        thread={mockThread}
        onGeneratePrompt={() => 'thread prompt'}
        onRemoveThread={onRemoveThread}
        onReplyToThread={vi.fn().mockResolvedValue(undefined)}
        onRemoveMessage={vi.fn()}
        onUpdateMessage={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle('Resolve thread'));
    await user.keyboard('{Escape}');

    expect(onRemoveThread).not.toHaveBeenCalled();
    expect(screen.queryByText('Resolve?')).not.toBeInTheDocument();
  });

  it('cancels the inline resolve confirmation when clicking outside', async () => {
    const user = userEvent.setup();
    const onRemoveThread = vi.fn();

    render(
      <div>
        <button type="button">outside</button>
        <CommentThreadCard
          thread={mockThread}
          onGeneratePrompt={() => 'thread prompt'}
          onRemoveThread={onRemoveThread}
          onReplyToThread={vi.fn().mockResolvedValue(undefined)}
          onRemoveMessage={vi.fn()}
          onUpdateMessage={vi.fn()}
        />
      </div>,
    );

    await user.click(screen.getByTitle('Resolve thread'));
    await user.click(screen.getByRole('button', { name: 'outside' }));

    expect(onRemoveThread).not.toHaveBeenCalled();
    expect(screen.queryByText('Resolve?')).not.toBeInTheDocument();
  });

  it('resolves immediately without confirmation when confirmRootAction is false', async () => {
    const user = userEvent.setup();
    const onRemoveThread = vi.fn();

    render(
      <CommentThreadCard
        thread={mockThread}
        confirmRootAction={false}
        onGeneratePrompt={() => 'thread prompt'}
        onRemoveThread={onRemoveThread}
        onReplyToThread={vi.fn().mockResolvedValue(undefined)}
        onRemoveMessage={vi.fn()}
        onUpdateMessage={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle('Resolve thread'));

    expect(screen.queryByText('Resolve?')).not.toBeInTheDocument();
    expect(onRemoveThread).toHaveBeenCalledWith('thread-1');
  });

  it('shows the "Outdated" badge when the thread is marked outdated', () => {
    render(
      <CommentThreadCard
        thread={{ ...mockThread, isOutdated: true }}
        onGeneratePrompt={() => 'thread prompt'}
        onRemoveThread={vi.fn()}
        onReplyToThread={vi.fn().mockResolvedValue(undefined)}
        onRemoveMessage={vi.fn()}
        onUpdateMessage={vi.fn()}
      />,
    );

    const badge = screen.getByLabelText('Outdated comment');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Outdated');
    expect(badge).toHaveAttribute('title', 'Code has changed since this comment was made');
  });

  it('does not render the "Outdated" badge when the thread is up to date', () => {
    render(
      <CommentThreadCard
        thread={mockThread}
        onGeneratePrompt={() => 'thread prompt'}
        onRemoveThread={vi.fn()}
        onReplyToThread={vi.fn().mockResolvedValue(undefined)}
        onRemoveMessage={vi.fn()}
        onUpdateMessage={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Outdated comment')).not.toBeInTheDocument();
  });

  it('shows an inline confirmation before deleting a user-authored reply', async () => {
    const user = userEvent.setup();
    const onRemoveMessage = vi.fn();

    render(
      <CommentThreadCard
        thread={{
          ...mockThread,
          messages: [
            mockThread.messages[0]!,
            {
              ...mockThread.messages[1]!,
              author: 'User',
            },
          ],
        }}
        onGeneratePrompt={() => 'thread prompt'}
        onRemoveThread={vi.fn()}
        onReplyToThread={vi.fn().mockResolvedValue(undefined)}
        onRemoveMessage={onRemoveMessage}
        onUpdateMessage={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle('Delete reply'));

    expect(onRemoveMessage).not.toHaveBeenCalled();
    expect(screen.getByText('Delete?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onRemoveMessage).toHaveBeenCalledWith('thread-1', 'message-2');
  });
});
