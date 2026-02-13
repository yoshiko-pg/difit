import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SitePage from './SitePage';

describe('SitePage', () => {
  it('renders landing page with preview iframe', () => {
    render(<SitePage />);

    const frame = screen.getByTitle('difit live preview');
    expect(frame).toBeInTheDocument();
    expect(frame).toHaveAttribute('src', '/preview');
  });
});
