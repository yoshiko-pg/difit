import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FrontmatterTable } from './FrontmatterTable';

describe('FrontmatterTable', () => {
  it('renders nothing when data is null', () => {
    const { container } = render(<FrontmatterTable mode="snapshot" data={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when data is an empty object', () => {
    const { container } = render(<FrontmatterTable mode="snapshot" data={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders scalar values in the key/value table', () => {
    render(
      <FrontmatterTable
        mode="snapshot"
        data={{ title: 'Hello', published: true, weight: 3, description: null }}
      />,
    );

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('published')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('weight')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getByText('null')).toBeInTheDocument();
  });

  it('renders a nested sub-table for a one-level nested object', () => {
    render(
      <FrontmatterTable
        mode="snapshot"
        data={{ seo: { title: 'SEO title', description: 'SEO desc' } }}
      />,
    );

    expect(screen.getByText('seo')).toBeInTheDocument();
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('SEO title')).toBeInTheDocument();
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getByText('SEO desc')).toBeInTheDocument();
  });

  it('falls back to JSON formatting for objects nested two or more levels deep', () => {
    render(<FrontmatterTable mode="snapshot" data={{ site: { seo: { meta: { title: 'X' } } } }} />);

    const pre = document.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain(JSON.stringify({ meta: { title: 'X' } }, null, 2));
  });

  it('renders arrays as JSON on a single line', () => {
    render(<FrontmatterTable mode="snapshot" data={{ tags: ['a', 'b', 'c'] }} />);

    const pre = document.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain('["a","b","c"]');
  });

  it('renders the label when provided', () => {
    render(<FrontmatterTable mode="snapshot" data={{ title: 'Hello' }} label="Before" />);

    expect(screen.getByText('Before')).toBeInTheDocument();
  });
});
