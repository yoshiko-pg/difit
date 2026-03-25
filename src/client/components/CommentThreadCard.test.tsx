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
    expect(container.querySelector('.ml-4.border-l.border-github-border.pl-3')).toBeTruthy();
    expect(
      container.querySelector(
        '.rounded-md.border.border-github-border.bg-github-bg-secondary.p-3.pr-28',
      ),
    ).toBeNull();
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
