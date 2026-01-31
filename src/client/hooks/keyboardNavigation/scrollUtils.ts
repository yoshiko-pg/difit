import { NAVIGATION_SELECTORS } from '../../constants/navigation';

import { SCROLL_CONSTANTS } from './types';

/**
 * Smart scroll implementation inspired by Gerrit
 * Only scrolls when necessary to improve user experience
 */
export function createScrollToElement() {
  return (elementId: string): void => {
    const element = document.getElementById(elementId);
    if (!element) return;

    // The main scrollable container is always the same in this app
    const scrollContainer = document.querySelector(
      NAVIGATION_SELECTORS.SCROLL_CONTAINER,
    ) as HTMLElement | null;
    if (!scrollContainer) {
      throw new Error(`Scrollable container (${NAVIGATION_SELECTORS.SCROLL_CONTAINER}) not found`);
    }

    const rect = element.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const viewportHeight = scrollContainer.clientHeight;
    const scrollTop = scrollContainer.scrollTop;

    // Check if element is visible within the container's viewport
    const visibleTop = Math.max(containerRect.top, 0);
    const visibleBottom = Math.min(containerRect.bottom, window.innerHeight);
    const isVisible = rect.top >= visibleTop && rect.bottom <= visibleBottom;

    // If element is not visible, always scroll
    if (!isVisible) {
      const offsetTop = calculateOffsetTop(element, scrollContainer);
      const targetScrollTop = offsetTop - viewportHeight * SCROLL_CONSTANTS.VIEWPORT_OFFSET_RATIO;
      scrollContainer.scrollTop = Math.max(0, targetScrollTop);
      return;
    }

    // Element is visible - only scroll if bottom edge is hidden AND we would scroll down
    const isBottomHidden = rect.bottom > Math.min(containerRect.bottom, window.innerHeight);
    const elementPosInContainer = element.offsetTop - scrollContainer.offsetTop;
    const targetScrollTop =
      elementPosInContainer - viewportHeight * SCROLL_CONSTANTS.VIEWPORT_OFFSET_RATIO;
    const wouldScrollDown = targetScrollTop > scrollTop;

    if (isBottomHidden && wouldScrollDown) {
      scrollContainer.scrollTop = Math.max(0, targetScrollTop);
    }
  };
}

/**
 * Calculates the offset of an element relative to its scroll container
 */
function calculateOffsetTop(element: HTMLElement, container: HTMLElement): number {
  let currentElement: HTMLElement | null = element;
  let offsetTop = 0;

  // Walk up the DOM tree accumulating offsets until we reach the container
  while (currentElement && currentElement !== container && currentElement.offsetParent) {
    offsetTop += currentElement.offsetTop;
    currentElement = currentElement.offsetParent as HTMLElement;
  }

  // Add final offset if we haven't reached the container
  if (currentElement && currentElement !== container) {
    offsetTop += currentElement.offsetTop;
  }

  return offsetTop;
}
