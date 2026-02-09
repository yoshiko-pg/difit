import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SitePage } from './SitePage';

describe('SitePage', () => {
  it('renders preview iframe only', () => {
    render(<SitePage />);

    const frame = screen.getByTitle('difit live preview');
    expect(frame).toBeInTheDocument();
    expect(frame).toHaveAttribute('src', '/preview');
  });
});
