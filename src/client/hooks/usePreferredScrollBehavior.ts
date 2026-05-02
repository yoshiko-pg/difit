import { useSyncExternalStore } from 'react';

export type ScrollAnimationSetting = 'auto' | 'enabled' | 'disabled';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(callback: () => void) {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

export function usePreferredScrollBehavior(setting: ScrollAnimationSetting): ScrollBehavior {
  const systemPrefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  if (setting === 'enabled') return 'smooth';
  if (setting === 'disabled') return 'instant';
  return systemPrefersReducedMotion ? 'instant' : 'smooth';
}
