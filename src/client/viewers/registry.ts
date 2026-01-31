import type { DiffFile } from '../../types/diff';
import { isImageFile } from '../utils/imageUtils';
import { isMarkdownFile } from '../utils/markdownUtils';

import { ImageDiffViewer } from './ImageDiffViewer';
import { MarkdownDiffViewer } from './MarkdownDiffViewer';
import { TextDiffViewer } from './TextDiffViewer';
import type { DiffViewerRegistration } from './types';

const viewers: DiffViewerRegistration[] = [
  {
    id: 'image',
    match: (file) => isImageFile(file.path),
    Component: ImageDiffViewer,
    canExpandHiddenLines: () => false,
  },
  {
    id: 'markdown',
    match: (file) => isMarkdownFile(file.path),
    Component: MarkdownDiffViewer,
    canExpandHiddenLines: (file) => file.status !== 'added' && file.status !== 'deleted',
  },
  {
    id: 'default',
    match: () => true,
    Component: TextDiffViewer,
    canExpandHiddenLines: (file) => file.status !== 'added' && file.status !== 'deleted',
  },
];

export const getViewerForFile = (file: DiffFile): DiffViewerRegistration => {
  const fallback = viewers[viewers.length - 1];
  if (!fallback) {
    throw new Error('No diff viewers registered');
  }
  return viewers.find((viewer) => viewer.match(file)) ?? fallback;
};
