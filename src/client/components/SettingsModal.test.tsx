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
  editor: {
    id: 'cursor' as const,
    command: 'cursor',
    argsTemplate: '-g %file:%line',
  },
  colorVision: 'normal' as const,
  autoViewedPatterns: [],
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
    expect(
      screen.queryByText('Theme, typography, and syntax highlighting.'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('Appearance')).toHaveLength(1);
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

  it('displays the preset command and args as read-only inputs when a preset editor is selected', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        settings={baseSettings}
        onSettingsChange={vi.fn()}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByRole('button', { name: /^System/ }));

    const commandInput = screen.getByLabelText('Command') as HTMLInputElement;
    const argsInput = screen.getByLabelText('Arguments') as HTMLInputElement;

    expect(commandInput).toBeDisabled();
    expect(argsInput).toBeDisabled();
    expect(commandInput.value).toBe('cursor');
    expect(argsInput.value).toBe('-g %file:%line');
  });

  it('populates command and args from the selected preset when the dropdown changes', () => {
    const onSettingsChange = vi.fn();

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        settings={baseSettings}
        onSettingsChange={onSettingsChange}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByRole('button', { name: /^System/ }));

    fireEvent.change(screen.getByDisplayValue('Cursor'), { target: { value: 'textmate' } });

    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...baseSettings,
      editor: {
        id: 'textmate',
        command: 'mate',
        argsTemplate: '-l %line %file',
      },
    });
  });

  it('clears command and args when switching to "Custom"', () => {
    const onSettingsChange = vi.fn();

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        settings={baseSettings}
        onSettingsChange={onSettingsChange}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByRole('button', { name: /^System/ }));

    fireEvent.change(screen.getByDisplayValue('Cursor'), { target: { value: 'custom' } });

    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...baseSettings,
      editor: { id: 'custom', command: '', argsTemplate: '' },
    });
  });

  it('hides the command and arguments inputs entirely when "none" is selected', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        settings={{
          ...baseSettings,
          editor: { id: 'none', command: '', argsTemplate: '' },
        }}
        onSettingsChange={vi.fn()}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByRole('button', { name: /^System/ }));

    expect(screen.queryByLabelText('Command')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Arguments')).not.toBeInTheDocument();
  });

  it('enables the custom editor inputs and shows a validation hint when they are empty', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        settings={{
          ...baseSettings,
          editor: { id: 'custom', command: '', argsTemplate: '' },
        }}
        onSettingsChange={vi.fn()}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByRole('button', { name: /^System/ }));

    const commandInput = screen.getByLabelText('Command') as HTMLInputElement;
    const argsInput = screen.getByLabelText('Arguments') as HTMLInputElement;

    expect(commandInput).toBeEnabled();
    expect(argsInput).toBeEnabled();
    expect(commandInput).toBeRequired();
    expect(argsInput).toBeRequired();
    expect(commandInput).toHaveAttribute('aria-invalid', 'true');
    expect(argsInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Command is required.')).toBeInTheDocument();
    expect(screen.getByText('Arguments are required.')).toBeInTheDocument();
  });

  it('does not flag the custom editor inputs as invalid once both fields have values', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        settings={{
          ...baseSettings,
          editor: { id: 'custom', command: 'mate', argsTemplate: '-l %line %file' },
        }}
        onSettingsChange={vi.fn()}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByRole('button', { name: /^System/ }));

    expect(screen.queryByText('Command is required.')).not.toBeInTheDocument();
    expect(screen.queryByText('Arguments are required.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Command')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Arguments')).not.toHaveAttribute('aria-invalid');
  });

  it('propagates custom editor command and argument edits through onSettingsChange', () => {
    const onSettingsChange = vi.fn();
    const customBase = {
      ...baseSettings,
      editor: { id: 'custom' as const, command: '', argsTemplate: '' },
    };

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        settings={customBase}
        onSettingsChange={onSettingsChange}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByRole('button', { name: /^System/ }));

    fireEvent.change(screen.getByLabelText('Command'), { target: { value: 'mate' } });
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...customBase,
      editor: { id: 'custom', command: 'mate', argsTemplate: '' },
    });

    fireEvent.change(screen.getByLabelText('Arguments'), {
      target: { value: '-l %line %file' },
    });
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...customBase,
      editor: { id: 'custom', command: '', argsTemplate: '-l %line %file' },
    });
  });

  it('edits auto-viewed patterns from the system section as newline-delimited values', () => {
    const onSettingsChange = vi.fn();

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        settings={baseSettings}
        onSettingsChange={onSettingsChange}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByRole('button', { name: /^System/ }));

    const textarea = screen.getByLabelText('Auto-Mark Viewed Patterns');
    fireEvent.change(textarea, { target: { value: '*.test.ts\nsrc/generated/**' } });

    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...baseSettings,
      autoViewedPatterns: ['*.test.ts', 'src/generated/**'],
    });
  });
});
