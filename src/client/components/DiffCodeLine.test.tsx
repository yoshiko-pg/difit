import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WordHighlightProvider } from '../contexts/WordHighlightContext';

import { DiffCodeLine } from './DiffCodeLine';

describe('DiffCodeLine', () => {
  it.each([
    ['add', '+'],
    ['delete', '-'],
  ] as const)('keeps the %s prefix out of copied text', (type, prefix) => {
    render(
      <WordHighlightProvider>
        <DiffCodeLine
          line={{ type, content: 'const value = 1;', oldLineNumber: 1, newLineNumber: 1 }}
        />
      </WordHighlightProvider>,
    );

    expect(screen.getByText(prefix)).toHaveClass('select-none');
  });
});
