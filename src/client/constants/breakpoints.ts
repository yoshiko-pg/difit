export const BREAKPOINTS = {
  mobileMax: 767,
  desktopMin: 1024,
} as const;

export const MEDIA_QUERIES = {
  mobile: `(max-width: ${BREAKPOINTS.mobileMax}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktopMin}px)`,
} as const;
