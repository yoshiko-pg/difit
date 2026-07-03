import { renderHook } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';

import { getFileElementId } from '../utils/domUtils';

import { useLazyDiffRendering } from './useLazyDiffRendering';

function renderLazyDiffRendering(container: HTMLElement | null) {
  return renderHook(() =>
    useLazyDiffRendering({
      diffData: null,
      diffScrollContainerRef: { current: container },
      setDiffData: () => {},
    }),
  );
}

function stubRect(element: HTMLElement, top: number) {
  element.getBoundingClientRect = () =>
    ({
      top,
      bottom: top + 100,
      left: 0,
      right: 0,
      width: 0,
      height: 100,
    }) as DOMRect;
}

describe('useLazyDiffRendering', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('isFileScrolledPastContainerTop', () => {
    const filePath = 'src/example.ts';

    function setup(containerTop: number, targetTop: number) {
      const container = document.createElement('div');
      stubRect(container, containerTop);
      const target = document.createElement('div');
      target.id = getFileElementId(filePath);
      stubRect(target, targetTop);
      document.body.appendChild(target);

      return renderLazyDiffRendering(container);
    }

    it('returns true when the file header is scrolled above the container top', () => {
      const { result } = setup(50, 20);
      expect(result.current.isFileScrolledPastContainerTop(filePath)).toBe(true);
    });

    it('returns false when the file header is visible below the container top', () => {
      const { result } = setup(50, 120);
      expect(result.current.isFileScrolledPastContainerTop(filePath)).toBe(false);
    });

    it('returns false when the file header is aligned with the container top', () => {
      const { result } = setup(50, 50);
      expect(result.current.isFileScrolledPastContainerTop(filePath)).toBe(false);
    });

    it('returns false when the scroll container is not available', () => {
      const target = document.createElement('div');
      target.id = getFileElementId(filePath);
      stubRect(target, 0);
      document.body.appendChild(target);

      const { result } = renderLazyDiffRendering(null);
      expect(result.current.isFileScrolledPastContainerTop(filePath)).toBe(false);
    });

    it('returns false when the file element does not exist', () => {
      const container = document.createElement('div');
      stubRect(container, 0);

      const { result } = renderLazyDiffRendering(container);
      expect(result.current.isFileScrolledPastContainerTop('missing/file.ts')).toBe(false);
    });
  });
});
