import type { TextRange } from './markdownBlocks';

export type TextHighlightName = 'difit-md-added' | 'difit-md-removed';

const getHighlightRegistry = (): HighlightRegistry | undefined =>
  typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'
    ? CSS.highlights
    : undefined;

const BLOCK_SELECTOR = 'p, li, td, th, h1, h2, h3, h4, h5, h6, pre, blockquote, tr, div';

export type TextLayout = { text: string; nodes: Text[]; nodeStarts: number[] };

/**
 * Concatenates the text nodes under `root`, with a newline between nodes that sit in
 * different block elements, so neighbouring table cells or list items do not merge
 * into one "word" for the word diff.
 */
export const layoutText = (root: Node): TextLayout => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const nodeStarts: number[] = [];
  let text = '';
  let previousBlock: Element | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node as Text;
    // Mermaid SVGs embed <style> text with generated ids that differ on every render.
    if (textNode.parentElement?.closest('style, script')) continue;
    const block = textNode.parentElement?.closest(BLOCK_SELECTOR) ?? null;
    if (text && block !== previousBlock) text += '\n';
    previousBlock = block;
    nodes.push(textNode);
    nodeStarts.push(text.length);
    text += textNode.data;
  }
  return { text, nodes, nodeStarts };
};

/** Converts character offsets into `layout.text` to DOM ranges. */
export function createTextRanges({ nodes, nodeStarts }: TextLayout, offsets: TextRange[]): Range[] {
  const locate = (offset: number, preferNext: boolean): [Text, number] | null => {
    for (const [index, node] of nodes.entries()) {
      const start = nodeStarts[index] ?? 0;
      const end = start + node.data.length;
      if (offset < start) return [node, 0];
      if (offset < end || (!preferNext && offset === end)) return [node, offset - start];
    }
    return null;
  };

  const ranges: Range[] = [];
  for (const [startOffset, endOffset] of offsets) {
    const start = locate(startOffset, true);
    const end = locate(endOffset, false);
    if (!start || !end) continue;
    const range = document.createRange();
    range.setStart(start[0], start[1]);
    range.setEnd(end[0], end[1]);
    ranges.push(range);
  }
  return ranges;
}

/** Paints ranges with `::highlight(name)` without touching the DOM. Returns a cleanup. */
export function addTextHighlights(name: TextHighlightName, ranges: Range[]): () => void {
  const registry = getHighlightRegistry();
  if (!registry || ranges.length === 0) return () => {};

  let highlight = registry.get(name);
  if (!highlight) {
    highlight = new Highlight();
    registry.set(name, highlight);
  }
  const target = highlight;
  ranges.forEach((range) => target.add(range));
  return () => ranges.forEach((range) => target.delete(range));
}
