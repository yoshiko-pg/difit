import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders messages inline while keeping the reply indentation line', () => {
    const { container } = render(
      <CommentThreadCard
        thread={mockThread}
        onGeneratePrompt={() => 'thread prompt'}
        onRemoveThread={vi.fn()}
        onReplyToThread={vi.fn().mockResolvedValue(undefined)}
        onRemoveMessage={vi.fn()}
        onUpdateMessage={vi.fn()}
      />,
    );

    expect(screen.getByText('Root comment')).toBeInTheDocument();
    expect(screen.getByText('Reply comment')).toBeInTheDocument();
    expect(screen.getByTitle('Resolve thread')).toBeInTheDocument();
    expect(screen.getAllByTitle('Edit message')).toHaveLength(1);
    expect(screen.queryByTitle('Delete reply')).not.toBeInTheDocument();
    expect(container.querySelector('.ml-4.border-l.border-github-border.pl-3')).toBeTruthy();
    expect(
      container.querySelector(
        '.rounded-md.border.border-github-border.bg-github-bg-secondary.p-3.pr-28',
      ),
    ).toBeNull();
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

  it('confirms before resolving a root comment by default', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.fn(() => false);
    const onRemoveThread = vi.fn();
    vi.stubGlobal('confirm', confirmSpy);

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

    expect(confirmSpy).toHaveBeenCalledWith('Resolve this thread?\n\n"Root comment"');
    expect(onRemoveThread).not.toHaveBeenCalled();
  });

  it('confirms before deleting a user-authored reply', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.fn(() => false);
    const onRemoveMessage = vi.fn();
    vi.stubGlobal('confirm', confirmSpy);

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

    expect(confirmSpy).toHaveBeenCalledWith('Delete this reply?\n\n"Reply comment"');
    expect(onRemoveMessage).not.toHaveBeenCalled();
  });

  it('shows the shared comment form layout while editing', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CommentThreadCard
        thread={mockThread}
        onGeneratePrompt={() => 'thread prompt'}
        onRemoveThread={vi.fn()}
        onReplyToThread={vi.fn().mockResolvedValue(undefined)}
        onRemoveMessage={vi.fn()}
        onUpdateMessage={vi.fn()}
      />,
    );

    await user.click(screen.getAllByTitle('Edit message')[0]!);

    expect(screen.getByText('Edit comment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add suggestion/i })).toBeInTheDocument();
    expect(container.querySelector('form')?.className).not.toContain('border-yellow-600/50');
  });
});
