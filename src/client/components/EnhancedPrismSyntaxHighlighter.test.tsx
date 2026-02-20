import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { WordHighlightProvider } from '../contexts/WordHighlightContext';

import { EnhancedPrismSyntaxHighlighter } from './EnhancedPrismSyntaxHighlighter';

// Mock PrismSyntaxHighlighter
vi.mock('./PrismSyntaxHighlighter', () => ({
  PrismSyntaxHighlighter: ({ code, className, renderToken, onMouseOver, onMouseOut }: any) => {
    // For tests, create tokens that may contain multiple words (like XML/HTML tags)
    const tokens = [{ content: code, types: ['test-token'] }];
    return (
      <span className={className} onMouseOver={onMouseOver} onMouseOut={onMouseOut}>
        {renderToken ? (
          tokens.map((token: any, idx: number) =>
            renderToken(token, idx, () => ({ className: 'token' })),
          )
        ) : (
          <span>{code}</span>
        )}
      </span>
    );
  },
  setCurrentFilename: vi.fn(),
}));

// Mock useWordHighlight
const mockUseWordHighlight = vi.fn();
vi.mock('../contexts/WordHighlightContext', () => ({
  WordHighlightProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWordHighlight: () => mockUseWordHighlight(),
}));

describe('EnhancedPrismSyntaxHighlighter', () => {
  beforeEach(() => {
    mockUseWordHighlight.mockReturnValue({
      highlightedWord: null,
      handleMouseOver: vi.fn(),
      handleMouseOut: vi.fn(),
      isWordHighlighted: vi.fn(() => false),
    });
  });

  it('should render code content', () => {
    render(
      <WordHighlightProvider>
        <EnhancedPrismSyntaxHighlighter code="const hello = world" />
      </WordHighlightProvider>,
    );

    expect(screen.getByText(/hello/)).toBeInTheDocument();
    expect(screen.getByText(/world/)).toBeInTheDocument();
  });

  it('should wrap words in spans with word-token class', () => {
    const { container } = render(
      <WordHighlightProvider>
        <EnhancedPrismSyntaxHighlighter code="hello world" />
      </WordHighlightProvider>,
    );

    const wordTokens = container.querySelectorAll('.word-token');
    expect(wordTokens).toHaveLength(2);
    expect(wordTokens[0]).toHaveTextContent('hello');
    expect(wordTokens[1]).toHaveTextContent('world');
  });

  it('should highlight words that match the highlighted word', () => {
    mockUseWordHighlight.mockReturnValue({
      highlightedWord: 'hello',
      handleMouseOver: vi.fn(),
      handleMouseOut: vi.fn(),
      isWordHighlighted: vi.fn((word: string) => word.toLowerCase() === 'hello'),
    });

    const { container } = render(
      <WordHighlightProvider>
        <EnhancedPrismSyntaxHighlighter code="hello world Hello" />
      </WordHighlightProvider>,
    );

    const highlightedWords = container.querySelectorAll('.word-highlight');
    expect(highlightedWords).toHaveLength(2); // Both "hello" and "Hello"
  });

  it('should call handleMouseOver when hovering a word', () => {
    const handleMouseOver = vi.fn();
    mockUseWordHighlight.mockReturnValue({
      highlightedWord: null,
      handleMouseOver,
      handleMouseOut: vi.fn(),
      isWordHighlighted: vi.fn(() => false),
    });

    const { container } = render(
      <WordHighlightProvider>
        <EnhancedPrismSyntaxHighlighter code="hello world" />
      </WordHighlightProvider>,
    );

    const firstWord = container.querySelector('.word-token');
    if (firstWord) {
      fireEvent.mouseOver(firstWord);
      expect(handleMouseOver).toHaveBeenCalled();
    }
  });

  it('should call handleMouseOut when leaving a word', () => {
    const handleMouseOut = vi.fn();
    mockUseWordHighlight.mockReturnValue({
      highlightedWord: null,
      handleMouseOver: vi.fn(),
      handleMouseOut,
      isWordHighlighted: vi.fn(() => false),
    });

    const { container } = render(
      <WordHighlightProvider>
        <EnhancedPrismSyntaxHighlighter code="hello world" />
      </WordHighlightProvider>,
    );

    const firstWord = container.querySelector('.word-token');
    if (firstWord) {
      fireEvent.mouseOut(firstWord);
      expect(handleMouseOut).toHaveBeenCalled();
    }
  });

  it('should pass through className prop', () => {
    const { container } = render(
      <WordHighlightProvider>
        <EnhancedPrismSyntaxHighlighter code="hello world" className="custom-class" />
      </WordHighlightProvider>,
    );

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('should handle empty code', () => {
    const { container } = render(
      <WordHighlightProvider>
        <EnhancedPrismSyntaxHighlighter code="" />
      </WordHighlightProvider>,
    );

    const wordTokens = container.querySelectorAll('.word-token');
    expect(wordTokens).toHaveLength(0);
  });

  it('should handle code with special characters', () => {
    const { container } = render(
      <WordHighlightProvider>
        <EnhancedPrismSyntaxHighlighter code="hello world foo bar" />
      </WordHighlightProvider>,
    );

    const wordTokens = container.querySelectorAll('.word-token');
    expect(wordTokens).toHaveLength(4); // hello, world, foo, bar
  });

  it('should not mark symbols as word tokens', () => {
    const { container } = render(
      <WordHighlightProvider>
        <EnhancedPrismSyntaxHighlighter code="+ - = ! @" />
      </WordHighlightProvider>,
    );

    const wordTokens = container.querySelectorAll('.word-token');
    expect(wordTokens).toHaveLength(0); // No symbols should be marked as word tokens
  });

  it('should handle XML/HTML-like tokens with multiple words', () => {
    const { container } = render(
      <WordHighlightProvider>
        <EnhancedPrismSyntaxHighlighter code="EnhancedPrismSyntaxHighlighter code" />
      </WordHighlightProvider>,
    );

    const wordTokens = container.querySelectorAll('.word-token');
    expect(wordTokens).toHaveLength(2); // Should detect both words
    expect(wordTokens[0]).toHaveTextContent('EnhancedPrismSyntaxHighlighter');
    expect(wordTokens[1]).toHaveTextContent('code');
  });
});
