import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReloadButton } from './ReloadButton';

vi.mock('lucide-react', () => ({
  RefreshCw: () => <div>RefreshCw</div>,
}));

describe('ReloadButton', () => {
  const defaultProps = {
    shouldReload: true,
    isReloading: false,
    onReload: vi.fn(),
    changeType: 'file' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('should not render when shouldReload is false', () => {
      render(<ReloadButton {...defaultProps} shouldReload={false} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should render when shouldReload is true', () => {
      render(<ReloadButton {...defaultProps} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('button states', () => {
    it('should render enabled button when not reloading', () => {
      render(<ReloadButton {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toBeEnabled();
      expect(button).toHaveTextContent('Refresh');
    });

    it('should render disabled button when reloading', () => {
      render(<ReloadButton {...defaultProps} isReloading={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Refresh');
    });
  });

  describe('change type messages', () => {
    it('should show correct message for file changes', () => {
      render(<ReloadButton {...defaultProps} changeType="file" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'File changes detected - Click to refresh');
    });

    it('should show correct message for commit changes', () => {
      render(<ReloadButton {...defaultProps} changeType="commit" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'New commits available - Click to refresh');
    });

    it('should show correct message for staging changes', () => {
      render(<ReloadButton {...defaultProps} changeType="staging" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Staging changes detected - Click to refresh');
    });

    it('should show default message for unknown change type', () => {
      render(<ReloadButton {...defaultProps} changeType={null} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Changes detected - Click to refresh');
    });
  });

  describe('click behavior', () => {
    it('should call onReload when clicked and not reloading', () => {
      const onReload = vi.fn();
      render(<ReloadButton {...defaultProps} onReload={onReload} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(onReload).toHaveBeenCalledTimes(1);
    });

    it('should not call onReload when clicked while reloading', () => {
      const onReload = vi.fn();
      render(<ReloadButton {...defaultProps} onReload={onReload} isReloading={true} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(onReload).not.toHaveBeenCalled();
    });
  });
});
