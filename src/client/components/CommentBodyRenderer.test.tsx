import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WordHighlightProvider } from '../contexts/WordHighlightContext';

import { CommentBodyRenderer } from './CommentBodyRenderer';

describe('CommentBodyRenderer', () => {
  it('renders plain text', () => {
    render(<CommentBodyRenderer body="Just a plain comment" />);

    expect(screen.getByText('Just a plain comment')).toBeInTheDocument();
  });

  it('renders bold text as <strong>', () => {
    const { container } = render(<CommentBodyRenderer body="This is **important**" />);

    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong).toHaveTextContent('important');
  });

  it('renders inline code as <code>', () => {
    const { container } = render(<CommentBodyRenderer body="Use `foo()` here" />);

    const code = container.querySelector('code');
    expect(code).not.toBeNull();
    expect(code).toHaveTextContent('foo()');
  });

  it('renders strikethrough via GFM', () => {
    const { container } = render(<CommentBodyRenderer body="~~removed~~" />);

    const del = container.querySelector('del');
    expect(del).not.toBeNull();
    expect(del).toHaveTextContent('removed');
  });

  it('keeps single newlines as line breaks', () => {
    const { container } = render(<CommentBodyRenderer body={'line one\nline two'} />);

    expect(container.querySelector('br')).not.toBeNull();
    expect(container).toHaveTextContent('line one');
    expect(container).toHaveTextContent('line two');
  });

  it('keeps consecutive spaces inside paragraphs', () => {
    const { container } = render(<CommentBodyRenderer body={'aligned:    value'} />);

    const paragraph = container.querySelector('p');
    expect(paragraph).not.toBeNull();
    expect(paragraph?.textContent).toBe('aligned:    value');
    expect(paragraph?.className).toContain('whitespace-pre-wrap');
  });

  it('treats 4-space indented lines as code blocks (markdown semantics)', () => {
    const { container } = render(<CommentBodyRenderer body={'intro\n\n    indented line'} />);

    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre).toHaveTextContent('indented line');
  });

  it('renders fenced code blocks inside <pre>', () => {
    const { container } = render(
      <CommentBodyRenderer body={'Check this:\n\n```ts\nconst x = 1;\n```'} />,
    );

    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre).toHaveTextContent('const x = 1;');
  });

  it('renders fenced diff blocks with addition/deletion backgrounds', () => {
    const { container } = render(
      <CommentBodyRenderer body={'```diff\n- const x = 1;\n+ const x = 2;\n  unchanged\n```'} />,
    );

    const addedLine = container.querySelector('.bg-diff-addition-bg');
    const deletedLine = container.querySelector('.bg-diff-deletion-bg');
    expect(addedLine).not.toBeNull();
    expect(addedLine).toHaveTextContent('+ const x = 2;');
    expect(deletedLine).not.toBeNull();
    expect(deletedLine).toHaveTextContent('- const x = 1;');
    expect(container).toHaveTextContent('unchanged');
  });

  it('renders safe links as anchors', () => {
    const { container } = render(
      <CommentBodyRenderer body="See [docs](https://example.com/docs)" />,
    );

    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor).toHaveAttribute('href', 'https://example.com/docs');
    expect(anchor).toHaveAttribute('target', '_blank');
    expect(anchor).toHaveTextContent('docs');
  });

  it('does not render unsafe links as anchors', () => {
    const { container } = render(<CommentBodyRenderer body="Click [here](javascript:alert(1))" />);

    expect(container.querySelector('a')).toBeNull();
    expect(container).toHaveTextContent('here');
  });

  it('does not render raw HTML', () => {
    const { container } = render(<CommentBodyRenderer body='<img src="x" onerror="alert(1)">' />);

    expect(container.querySelector('img')).toBeNull();
  });

  it('renders suggestion blocks with the suggested code', () => {
    const { container } = render(
      <WordHighlightProvider>
        <CommentBodyRenderer
          body={'Try this:\n\n```suggestion\nconst y = 2;\n```'}
          originalCode="const y = 1;"
        />
      </WordHighlightProvider>,
    );

    expect(container).toHaveTextContent('Try this:');
    expect(container).toHaveTextContent('const y = 2;');
    expect(container).toHaveTextContent('const y = 1;');
    expect(container.querySelector('.bg-diff-addition-bg')).not.toBeNull();
    expect(container.querySelector('.bg-diff-deletion-bg')).not.toBeNull();
  });

  it('renders markdown around suggestion blocks', () => {
    const { container } = render(
      <WordHighlightProvider>
        <CommentBodyRenderer
          body={'**Before** the block\n\n```suggestion\nnew code\n```\n\n*After* the block'}
        />
      </WordHighlightProvider>,
    );

    expect(container.querySelector('strong')).toHaveTextContent('Before');
    expect(container.querySelector('em')).toHaveTextContent('After');
    expect(container).toHaveTextContent('new code');
  });
});
