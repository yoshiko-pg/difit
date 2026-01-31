import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HotkeysProvider } from 'react-hotkeys-hook';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Comment } from '../../types/diff';

import { CommentsListModal } from './CommentsListModal';

// Mock react-hotkeys-hook
vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn(),
  useHotkeysContext: vi.fn(() => ({
    enableScope: vi.fn(),
    disableScope: vi.fn(),
  })),
  HotkeysProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockComments: Comment[] = [
  {
    id: '1',
    file: 'src/file1.ts',
    line: 10,
    body: 'First comment',
    timestamp: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    file: 'src/file1.ts',
    line: [20, 25],
    body: 'Second comment on range',
    timestamp: '2024-01-01T00:01:00Z',
  },
  {
    id: '3',
    file: 'src/file2.ts',
    line: 42,
    body: 'Third comment',
    timestamp: '2024-01-01T00:02:00Z',
  },
];

const mockRemoveComment = vi.fn();
const mockGeneratePrompt = vi.fn().mockReturnValue('test prompt');
const mockUpdateComment = vi.fn();

// Wrapper component for HotkeysProvider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HotkeysProvider initiallyActiveScopes={['global']}>{children}</HotkeysProvider>
);

describe('CommentsListModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    const { container } = render(
      <CommentsListModal
        isOpen={false}
        onClose={onClose}
        onNavigate={onNavigate}
        comments={mockComments}
        onRemoveComment={mockRemoveComment}
        onGeneratePrompt={mockGeneratePrompt}
        onUpdateComment={mockUpdateComment}
      />,
      { wrapper },
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render when isOpen is true', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    render(
      <CommentsListModal
        isOpen={true}
        onClose={onClose}
        onNavigate={onNavigate}
        comments={mockComments}
        onRemoveComment={mockRemoveComment}
        onGeneratePrompt={mockGeneratePrompt}
        onUpdateComment={mockUpdateComment}
      />,
      { wrapper },
    );
    expect(screen.getByText('All Comments')).toBeInTheDocument();
  });

  it('should display all comments in a flat list', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    render(
      <CommentsListModal
        isOpen={true}
        onClose={onClose}
        onNavigate={onNavigate}
        comments={mockComments}
        onRemoveComment={mockRemoveComment}
        onGeneratePrompt={mockGeneratePrompt}
        onUpdateComment={mockUpdateComment}
      />,
      { wrapper },
    );

    // Check comment bodies
    expect(screen.getByText('First comment')).toBeInTheDocument();
    expect(screen.getByText('Second comment on range')).toBeInTheDocument();
    expect(screen.getByText('Third comment')).toBeInTheDocument();
  });

  it('should display line numbers correctly', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    render(
      <CommentsListModal
        isOpen={true}
        onClose={onClose}
        onNavigate={onNavigate}
        comments={mockComments}
        onRemoveComment={mockRemoveComment}
        onGeneratePrompt={mockGeneratePrompt}
        onUpdateComment={mockUpdateComment}
      />,
      { wrapper },
    );

    // Check that file paths and line numbers are displayed correctly
    expect(screen.getByText('src/file1.ts:10')).toBeInTheDocument();
    expect(screen.getByText('src/file1.ts:20-25')).toBeInTheDocument();
    expect(screen.getByText('src/file2.ts:42')).toBeInTheDocument();
  });

  it('should call onNavigate when clicking on a comment', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    render(
      <CommentsListModal
        isOpen={true}
        onClose={onClose}
        onNavigate={onNavigate}
        comments={mockComments}
        onRemoveComment={mockRemoveComment}
        onGeneratePrompt={mockGeneratePrompt}
        onUpdateComment={mockUpdateComment}
      />,
      { wrapper },
    );

    const firstComment = screen.getByText('First comment').closest('div');
    fireEvent.click(firstComment!);

    expect(onNavigate).toHaveBeenCalledWith(mockComments[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onRemoveComment when delete button is clicked', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();

    render(
      <CommentsListModal
        isOpen={true}
        onClose={onClose}
        onNavigate={onNavigate}
        comments={mockComments}
        onRemoveComment={mockRemoveComment}
        onGeneratePrompt={mockGeneratePrompt}
        onUpdateComment={mockUpdateComment}
      />,
      { wrapper },
    );

    const deleteButtons = screen.getAllByTitle('Resolve');
    fireEvent.click(deleteButtons[0]!);

    expect(mockRemoveComment).toHaveBeenCalledWith('1');
  });

  it('should show empty state when no comments', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    render(
      <CommentsListModal
        isOpen={true}
        onClose={onClose}
        onNavigate={onNavigate}
        comments={[]}
        onRemoveComment={mockRemoveComment}
        onGeneratePrompt={mockGeneratePrompt}
        onUpdateComment={mockUpdateComment}
      />,
      { wrapper },
    );

    expect(screen.getByText('No comments yet')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    render(
      <CommentsListModal
        isOpen={true}
        onClose={onClose}
        onNavigate={onNavigate}
        comments={mockComments}
        onRemoveComment={mockRemoveComment}
        onGeneratePrompt={mockGeneratePrompt}
        onUpdateComment={mockUpdateComment}
      />,
      { wrapper },
    );

    const closeButton = screen.getByLabelText('Close comments list');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    const { useHotkeys } = await import('react-hotkeys-hook');

    render(
      <CommentsListModal
        isOpen={true}
        onClose={onClose}
        onNavigate={onNavigate}
        comments={mockComments}
        onRemoveComment={mockRemoveComment}
        onGeneratePrompt={mockGeneratePrompt}
        onUpdateComment={mockUpdateComment}
      />,
      { wrapper },
    );

    // Find the escape handler
    const calls = (useHotkeys as any).mock.calls;
    const escapeCall = calls.find((call: any) => call[0] === 'escape');
    expect(escapeCall).toBeDefined();

    // Call the handler
    escapeCall[1]();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
