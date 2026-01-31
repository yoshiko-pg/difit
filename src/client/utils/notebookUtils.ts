import { getFileExtension } from '../../utils/fileUtils';

const NOTEBOOK_EXTENSIONS = ['ipynb'];

export function isNotebookFile(filename: string): boolean {
  if (!filename) return false;

  const extension = getFileExtension(filename);
  return extension ? NOTEBOOK_EXTENSIONS.includes(extension) : false;
}
