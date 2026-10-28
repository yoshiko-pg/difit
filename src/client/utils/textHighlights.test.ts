import { describe, expect, it } from 'vitest';

import { createTextRanges, layoutText } from './textHighlights';

const mount = (html: string) => {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
};

describe('layoutText', () => {
  it('separates text from different cells but keeps inline elements joined', () => {
    const root = mount(
      '<table><tr><td>status</td><td>draft</td></tr></table><p>Hello <strong>bold</strong> world</p>',
    );

    expect(layoutText(root).text).toBe('status\ndraft\nHello bold world');
  });

  it('skips style and script text such as the ids inside a Mermaid SVG', () => {
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const root = document.createElement('div');
    const svg = root.appendChild(document.createElementNS(svgNamespace, 'svg'));
    svg.appendChild(document.createElementNS(svgNamespace, 'style')).textContent = '#_r_0_ {}';
    svg.appendChild(document.createElementNS(svgNamespace, 'text')).textContent = 'Node';

    expect(layoutText(root).text).toBe('Node');
  });
});

describe('createTextRanges', () => {
  it('maps offsets in the rendered text back to the right text nodes', () => {
    const root = mount('<table><tr><td>status</td><td>draft</td></tr></table>');
    const layout = layoutText(root);
    const start = layout.text.indexOf('draft');

    const [range] = createTextRanges(layout, [[start, start + 'draft'.length]]);

    expect(range?.toString()).toBe('draft');
  });

  it('spans several text nodes for one range', () => {
    const root = mount('<p>Hello <strong>bold</strong> world</p>');

    const [range] = createTextRanges(layoutText(root), [[6, 16]]);

    expect(range?.toString()).toBe('bold world');
  });
});
