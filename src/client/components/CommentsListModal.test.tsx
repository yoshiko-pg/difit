import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { HotkeysProvider } from 'react-hotkeys-hook';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { CommentThread } from '../../types/diff';

import { CommentsListModal } from './CommentsListModal';

vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn(),
  useHotkeysContext: vi.fn(() => ({
    enableScope: vi.fn(),
    disableScope: vi.fn(),
  })),
  HotkeysProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockThreads: CommentThread[] = [
  {
    id: 'thread-1',
    file: 'src/file1.ts',
    line: 10,
    side: 'new',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    codeContent: 'const value = 1;',
    messages: [
      {
        id: 'thread-1',
        body: 'First root comment',
        author: 'User',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'reply-1',
        body: 'First reply',
        author: 'Reviewer',
        createdAt: '2024-01-01T00:01:00Z',
        updatedAt: '2024-01-01T00:01:00Z',
      },
    ],
  },
  {
    id: 'thread-2',
    file: 'src/file2.ts',
    line: [20, 25],
    side: 'new',
    createdAt: '2024-01-01T00:02:00Z',
    updatedAt: '2024-01-01T00:02:00Z',
    messages: [
      {
        id: 'thread-2',
        body: 'Second root comment',
        author: 'User',
        createdAt: '2024-01-01T00:02:00Z',
        updatedAt: '2024-01-01T00:02:00Z',
      },
    ],
  },
];

const mockRemoveThread = vi.fn();
const mockGenerateThreadPrompt = vi.fn().mockReturnValue('thread prompt');
const mockReplyToThread = vi.fn().mockResolvedValue(undefined);
const mockRemoveMessage = vi.fn();
const mockUpdateMessage = vi.fn();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HotkeysProvider initiallyActiveScopes={['global']}>{children}</HotkeysProvider>
);

describe('CommentsListModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <CommentsListModal
        isOpen={false}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        comments={mockThreads}
        onRemoveThread={mockRemoveThread}
        onGenerateThreadPrompt={mockGenerateThreadPrompt}
        onReplyToThread={mockReplyToThread}
        onRemoveMessage={mockRemoveMessage}
        onUpdateMessage={mockUpdateMessage}
      />,
      { wrapper },
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders thread content when open', () => {
    render(
      <CommentsListModal
        isOpen={true}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        comments={mockThreads}
        onRemoveThread={mockRemoveThread}
        onGenerateThreadPrompt={mockGenerateThreadPrompt}
        onReplyToThread={mockReplyToThread}
        onRemoveMessage={mockRemoveMessage}
        onUpdateMessage={mockUpdateMessage}
      />,
      { wrapper },
    );

    expect(screen.getByText('All Comments')).toBeInTheDocument();
    expect(screen.getByText('First root comment')).toBeInTheDocument();
    expect(screen.getByText('First reply')).toBeInTheDocument();
    expect(screen.getByText('Second root comment')).toBeInTheDocument();
    expect(screen.getByText('src/file1.ts:10')).toBeInTheDocument();
    expect(screen.getByText('src/file2.ts:20-25')).toBeInTheDocument();
  });

  it('shows author badges when enabled', () => {
    render(
      <CommentsListModal
        isOpen={true}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        comments={mockThreads}
        showAuthorBadges={true}
        onRemoveThread={mockRemoveThread}
        onGenerateThreadPrompt={mockGenerateThreadPrompt}
        onReplyToThread={mockReplyToThread}
        onRemoveMessage={mockRemoveMessage}
        onUpdateMessage={mockUpdateMessage}
      />,
      { wrapper },
    );

    expect(screen.getAllByText('User').length).toBeGreaterThan(0);
    expect(screen.getByText('Reviewer')).toBeInTheDocument();
  });

  it('navigates when clicking a thread', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();

    render(
      <CommentsListModal
        isOpen={true}
        onClose={onClose}
        onNavigate={onNavigate}
        comments={mockThreads}
        onRemoveThread={mockRemoveThread}
        onGenerateThreadPrompt={mockGenerateThreadPrompt}
        onReplyToThread={mockReplyToThread}
        onRemoveMessage={mockRemoveMessage}
        onUpdateMessage={mockUpdateMessage}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByText('First root comment'));

    expect(onNavigate).toHaveBeenCalledWith(mockThreads[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the modal open when clicking inside the reply form', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onNavigate = vi.fn();

    render(
      <CommentsListModal
        isOpen={true}
        onClose={onClose}
        onNavigate={onNavigate}
        comments={mockThreads}
        onRemoveThread={mockRemoveThread}
        onGenerateThreadPrompt={mockGenerateThreadPrompt}
        onReplyToThread={mockReplyToThread}
        onRemoveMessage={mockRemoveMessage}
        onUpdateMessage={mockUpdateMessage}
      />,
      { wrapper },
    );

    await user.click(screen.getAllByRole('button', { name: 'Reply' })[0]!);
    await user.click(screen.getByPlaceholderText('Write a reply...'));

    expect(screen.getByText('Reply to thread')).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses the modal delete handler from the delete button', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmSpy);

    render(
      <CommentsListModal
        isOpen={true}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        comments={mockThreads}
        onRemoveThread={mockRemoveThread}
        onGenerateThreadPrompt={mockGenerateThreadPrompt}
        onReplyToThread={mockReplyToThread}
        onRemoveMessage={mockRemoveMessage}
        onUpdateMessage={mockUpdateMessage}
      />,
      { wrapper },
    );

    await user.click(screen.getAllByTitle('Delete thread')[0]!);

    expect(confirmSpy).toHaveBeenCalledWith('Delete this thread?\n\n"First root comment"');
    expect(mockRemoveThread).not.toHaveBeenCalled();
  });

  it('shows empty state when there are no threads', () => {
    render(
      <CommentsListModal
        isOpen={true}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        comments={[]}
        onRemoveThread={mockRemoveThread}
        onGenerateThreadPrompt={mockGenerateThreadPrompt}
        onReplyToThread={mockReplyToThread}
        onRemoveMessage={mockRemoveMessage}
        onUpdateMessage={mockUpdateMessage}
      />,
      { wrapper },
    );

    expect(screen.getByText('No comments yet')).toBeInTheDocument();
  });
});
