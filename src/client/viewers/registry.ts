import type { DiffFile } from '../../types/diff';
import { isImageFile } from '../utils/imageUtils';

import { ImageDiffViewer } from './ImageDiffViewer';
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
