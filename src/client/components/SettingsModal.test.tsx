import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { HotkeysProvider } from 'react-hotkeys-hook';
import { describe, expect, it, vi } from 'vitest';

import { SettingsModal } from './SettingsModal';

vi.mock('react-hotkeys-hook', () => ({
  useHotkeysContext: vi.fn(() => ({
    enableScope: vi.fn(),
    disableScope: vi.fn(),
  })),
  HotkeysProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HotkeysProvider initiallyActiveScopes={['navigation']}>{children}</HotkeysProvider>
);

const baseSettings = {
  fontSize: 14,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
  theme: 'dark' as const,
  syntaxTheme: 'vsDark',
  editor: 'cursor' as const,
  colorVision: 'normal' as const,
};

describe('SettingsModal', () => {
  it('shows appearance settings by default and moves editor selection into the system section', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        settings={baseSettings}
        onSettingsChange={vi.fn()}
      />,
      { wrapper },
    );

    expect(screen.getByText('Font Size')).toBeInTheDocument();
    expect(screen.queryByText('Open In Editor')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Appearance/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: /^System/ }));

    expect(screen.getByText('Open In Editor')).toBeInTheDocument();
    expect(screen.queryByText('Font Size')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^System/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the deuteranopia explanation only while the button is hovered', async () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        settings={baseSettings}
        onSettingsChange={vi.fn()}
      />,
      { wrapper },
    );

    expect(
      screen.queryByText('Deuteranopia mode uses blue/orange instead of green/red for diffs.'),
    ).not.toBeInTheDocument();

    const deuteranopiaButton = screen.getByRole('button', { name: 'Deuteranopia' });
    fireEvent.mouseEnter(deuteranopiaButton);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(
      'Deuteranopia mode uses blue/orange instead of green/red for diffs.',
    );
    expect(deuteranopiaButton).toHaveAttribute('aria-describedby', tooltip.id);

    fireEvent.mouseLeave(deuteranopiaButton);

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      expect(deuteranopiaButton).not.toHaveAttribute('aria-describedby');
    });
  });
});
