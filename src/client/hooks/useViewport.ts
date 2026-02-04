import { useEffect, useState } from 'react';

import { MEDIA_QUERIES } from '../constants/breakpoints';

type ViewportState = {
  isMobile: boolean;
  isDesktop: boolean;
};

const getViewportState = (): ViewportState => {
  if (typeof window === 'undefined') {
    return { isMobile: false, isDesktop: true };
  }

  return {
    isMobile: window.matchMedia(MEDIA_QUERIES.mobile).matches,
    isDesktop: window.matchMedia(MEDIA_QUERIES.desktop).matches,
  };
};

export function useViewport(): ViewportState {
  const [state, setState] = useState<ViewportState>(() => getViewportState());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mobileQuery = window.matchMedia(MEDIA_QUERIES.mobile);
    const desktopQuery = window.matchMedia(MEDIA_QUERIES.desktop);

    const update = () => {
      setState({
        isMobile: mobileQuery.matches,
        isDesktop: desktopQuery.matches,
      });
    };

    update();
    mobileQuery.addEventListener('change', update);
    desktopQuery.addEventListener('change', update);

    return () => {
      mobileQuery.removeEventListener('change', update);
      desktopQuery.removeEventListener('change', update);
    };
  }, []);

  return state;
}
