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

describe('FrontmatterTable diff mode', () => {
  it('renders nothing when entries is empty', () => {
    const { container } = render(<FrontmatterTable mode="diff" entries={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders unchanged entries without decoration', () => {
    const { container } = render(
      <FrontmatterTable
        mode="diff"
        entries={[{ key: 'title', status: 'unchanged', oldValue: 'X', newValue: 'X' }]}
      />,
    );

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getAllByText('X')).toHaveLength(2); // same value shown in both Before and After
    expect(container.querySelector('.bg-diff-addition-bg')).toBeNull();
    expect(container.querySelector('.bg-diff-deletion-bg')).toBeNull();
  });

  it('renders added entries with an empty before cell and a styled after cell', () => {
    render(
      <FrontmatterTable
        mode="diff"
        entries={[{ key: 'new_key', status: 'added', oldValue: undefined, newValue: 'V' }]}
      />,
    );

    expect(screen.getByText('new_key')).toBeInTheDocument();
    expect(screen.getAllByText('new_key')).toHaveLength(1);
    expect(screen.getByText('V')).toBeInTheDocument();

    const row = screen.getByText('new_key').closest('tr');
    expect(row).not.toBeNull();
    const cells = row!.querySelectorAll('td');
    expect(cells).toHaveLength(3);
    expect(cells[1]!).not.toHaveClass('bg-diff-addition-bg');
    expect(cells[1]!).not.toHaveClass('bg-diff-deletion-bg');
    expect(cells[1]!.textContent).toBe('');
    expect(cells[2]!).toHaveClass('bg-diff-addition-bg');
    expect(cells[2]!.textContent).toBe('V');
  });

  it('renders removed entries with a styled before cell and an empty after cell', () => {
    const { container } = render(
      <FrontmatterTable
        mode="diff"
        entries={[{ key: 'old_key', status: 'removed', oldValue: 'V', newValue: undefined }]}
      />,
    );

    expect(screen.getByText('old_key')).toBeInTheDocument();
    expect(screen.getByText('V')).toBeInTheDocument();

    const row = screen.getByText('old_key').closest('tr');
    expect(row).not.toBeNull();
    const cells = row!.querySelectorAll('td');
    expect(cells).toHaveLength(3);
    expect(cells[1]!).toHaveClass('bg-diff-deletion-bg');
    expect(cells[1]!.textContent).toBe('V');
    expect(cells[2]!).not.toHaveClass('bg-diff-addition-bg');
    expect(cells[2]!).not.toHaveClass('bg-diff-deletion-bg');
    expect(cells[2]!.textContent).toBe('');
    expect(container.querySelector('td.bg-diff-deletion-bg')).not.toBeNull();
  });

  it('renders modified entries as a single row with a Before cell and an After cell', () => {
    render(
      <FrontmatterTable
        mode="diff"
        entries={[{ key: 'title', status: 'modified', oldValue: 'A', newValue: 'B' }]}
      />,
    );

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getAllByText('title')).toHaveLength(1);

    const row = screen.getByText('title').closest('tr');
    expect(row).not.toBeNull();
    const cells = row!.querySelectorAll('td');
    expect(cells).toHaveLength(3);
    expect(cells[1]!).toHaveClass('bg-diff-deletion-bg');
    expect(cells[1]!.textContent).toBe('A');
    expect(cells[2]!).toHaveClass('bg-diff-addition-bg');
    expect(cells[2]!.textContent).toBe('B');
  });

  it('renders the label when provided', () => {
    render(
      <FrontmatterTable
        mode="diff"
        entries={[{ key: 'title', status: 'unchanged', oldValue: 'X', newValue: 'X' }]}
        label="Diff"
      />,
    );

    expect(screen.getByText('Diff')).toBeInTheDocument();
  });

  it('reuses the nested renderValue rendering for object values', () => {
    const { container } = render(
      <FrontmatterTable
        mode="diff"
        entries={[
          {
            key: 'seo',
            status: 'modified',
            oldValue: { title: 'A' },
            newValue: { title: 'B' },
          },
        ]}
      />,
    );

    const nestedTables = container.querySelectorAll('table table');
    expect(nestedTables.length).toBe(2);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});
