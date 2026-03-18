/**
 * @param {number | null} code
 * @param {boolean} isShuttingDown
 * @returns {number | null}
 */
export function getCompileCloseExitCode(code, isShuttingDown) {
  if (isShuttingDown) {
    return 0;
  }

  if (code !== 0) {
    return code ?? 1;
  }

  return null;
}
