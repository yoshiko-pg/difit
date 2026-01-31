import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReloadButton } from './ReloadButton';

// Mock lucide-react
vi.mock('lucide-react', () => ({
  RefreshCw: ({ size, className }: { size: number; className: string }) => (
    <div data-testid="rotate-icon" data-size={size} className={className}>
      RefreshCw
    </div>
  ),
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

    it('should apply correct CSS classes when reloading', () => {
      render(<ReloadButton {...defaultProps} isReloading={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('cursor-not-allowed');
    });

    it('should apply correct CSS classes when not reloading', () => {
      render(<ReloadButton {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-github-text-primary');
    });
  });

  describe('icon states', () => {
    it('should show spinning icon when reloading', () => {
      render(<ReloadButton {...defaultProps} isReloading={true} />);

      const icon = screen.getByTestId('rotate-icon');
      expect(icon).toHaveClass('animate-spin');
    });

    it('should show static icon when not reloading', () => {
      render(<ReloadButton {...defaultProps} />);

      const icon = screen.getByTestId('rotate-icon');
      expect(icon).not.toHaveClass('animate-spin');
    });

    it('should render icon with correct size', () => {
      render(<ReloadButton {...defaultProps} />);

      const icon = screen.getByTestId('rotate-icon');
      expect(icon).toHaveAttribute('data-size', '12');
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

    it('should show default message when change type is undefined', () => {
      render(<ReloadButton {...defaultProps} changeType={undefined} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Changes detected - Click to refresh');
    });

    it('should show reloading message when reloading', () => {
      render(<ReloadButton {...defaultProps} isReloading={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'File changes detected - Click to refresh');
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

    it('should handle multiple clicks properly', () => {
      const onReload = vi.fn();
      render(<ReloadButton {...defaultProps} onReload={onReload} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(onReload).toHaveBeenCalledTimes(3);
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      render(<ReloadButton {...defaultProps} className="custom-class" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('should combine custom className with base classes', () => {
      render(<ReloadButton {...defaultProps} className="custom-class" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
      expect(button).toHaveClass('flex');
      expect(button).toHaveClass('items-center');
    });

    it('should handle empty className', () => {
      render(<ReloadButton {...defaultProps} className="" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('flex');
    });

    it('should handle undefined className', () => {
      render(<ReloadButton {...defaultProps} className={undefined} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('flex');
    });
  });

  describe('accessibility', () => {
    it('should have proper button role', () => {
      render(<ReloadButton {...defaultProps} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should have descriptive title attribute', () => {
      render(<ReloadButton {...defaultProps} changeType="file" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title');
      expect(button.getAttribute('title')).toBeTruthy();
    });

    it('should be properly disabled when reloading', () => {
      render(<ReloadButton {...defaultProps} isReloading={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('disabled');
    });

    it('should not be disabled when not reloading', () => {
      render(<ReloadButton {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).not.toHaveAttribute('disabled');
    });
  });

  describe('layout and styling', () => {
    it('should have correct base CSS classes', () => {
      render(<ReloadButton {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass(
        'flex',
        'items-center',
        'gap-1.5',
        'px-3',
        'py-1.5',
        'text-xs',
        'rounded-md',
        'border',
      );
    });

    it('should have orange color scheme', () => {
      render(<ReloadButton {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass(
        'bg-github-text-primary',
        'text-github-bg-primary',
        'border-github-text-primary',
      );
    });

    it('should have proper hover states when not reloading', () => {
      render(<ReloadButton {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-github-text-primary', 'border-github-text-primary');
    });
  });
});
