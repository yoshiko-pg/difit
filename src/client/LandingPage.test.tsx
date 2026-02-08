import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  it('renders the interactive difit iframe at the top', () => {
    render(<LandingPage />);

    const frame = screen.getByTitle('difit live preview');
    expect(frame).toBeInTheDocument();
    expect(frame).toHaveAttribute('src', '/app');
  });

  it('shows a quick-start command', () => {
    render(<LandingPage />);

    expect(screen.getByText('pnpm dlx difit HEAD')).toBeInTheDocument();
  });
});
