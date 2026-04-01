function fallbackCopyTextToClipboard(text: string): void {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
    throw new Error('Clipboard is unavailable in this environment');
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.setAttribute('aria-hidden', 'true');
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '-9999px';
  textArea.style.opacity = '0';

  const selection = document.getSelection();
  const originalRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const activeElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  document.body.append(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, text.length);

  const didCopy = document.execCommand('copy');

  textArea.remove();

  if (selection && originalRange) {
    selection.removeAllRanges();
    selection.addRange(originalRange);
  }

  activeElement?.focus();

  if (!didCopy) {
    throw new Error('Failed to copy text');
  }
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (
    globalThis.isSecureContext &&
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.writeText === 'function'
  ) {
    await navigator.clipboard.writeText(text);
    return;
  }

  fallbackCopyTextToClipboard(text);
}
