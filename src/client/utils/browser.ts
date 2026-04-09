export function isSafariBrowser(userAgent: string): boolean {
  if (!userAgent) {
    return false;
  }

  const normalizedUserAgent = userAgent.toLowerCase();

  return (
    normalizedUserAgent.includes('safari') &&
    !normalizedUserAgent.includes('chrome') &&
    !normalizedUserAgent.includes('chromium') &&
    !normalizedUserAgent.includes('crios') &&
    !normalizedUserAgent.includes('fxios') &&
    !normalizedUserAgent.includes('edg/') &&
    !normalizedUserAgent.includes('android')
  );
}
