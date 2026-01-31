import { useState } from 'react';

import type { DiffViewerBodyProps } from './types';

interface ImageInfo {
  width?: number;
  height?: number;
  size?: number;
}

export function ImageDiffViewer({
  file,
  diffMode,
  baseCommitish,
  targetCommitish,
}: DiffViewerBodyProps) {
  const mode = diffMode ?? 'inline';
  const isDeleted = file.status === 'deleted';
  const isAdded = file.status === 'added';
  const isModified = file.status === 'modified' || file.status === 'renamed';

  // Determine the actual refs to use
  const baseRef = baseCommitish || 'HEAD~1';
  const targetRef = targetCommitish || 'HEAD';

  // State for image information
  const [oldImageInfo, setOldImageInfo] = useState<ImageInfo>({});
  const [newImageInfo, setNewImageInfo] = useState<ImageInfo>({});

  // Function to handle image load and get dimensions/file size
  const handleImageLoad = async (
    img: HTMLImageElement,
    setImageInfo: (info: ImageInfo) => void,
  ) => {
    try {
      // Get image dimensions
      const width = img.naturalWidth;
      const height = img.naturalHeight;

      // Fetch the image to get file size
      const response = await fetch(img.src);
      const blob = await response.blob();
      const size = blob.size;

      setImageInfo({ width, height, size });
    } catch (error) {
      console.error('Failed to get image info:', error);
    }
  };

  // Function to format file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Function to format image dimensions
  const formatDimensions = (info: ImageInfo): string => {
    if (!info.width || !info.height) return '';
    return `W: ${info.width}px | H: ${info.height}px`;
  };

  // Checkerboard background style for transparent images
  const checkerboardStyle = {
    backgroundImage: `
      linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%),
      linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)
    `,
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 10px 10px',
    backgroundColor: 'white',
  };

  // For deleted files, show only the old version
  if (isDeleted) {
    return (
      <div className="bg-github-bg-primary p-4">
        <div className="text-center">
          <div className="mb-2">
            <span className="text-github-danger font-medium">Deleted Image</span>
          </div>
          <div className="inline-block border border-github-border rounded-md p-4 bg-github-bg-secondary">
            <div className="text-github-text-muted mb-2" style={{ fontSize: '14px' }}>
              Previous version:
            </div>
            <img
              src={`/api/blob/${file.oldPath || file.path}?ref=${baseRef}`}
              alt={`Previous version of ${file.oldPath || file.path}`}
              className="max-w-full max-h-96 border border-github-border rounded mx-auto"
              style={checkerboardStyle}
              onLoad={(e) => handleImageLoad(e.currentTarget, setOldImageInfo)}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden text-github-text-muted text-sm mt-2">
              Image could not be loaded
            </div>
            {(oldImageInfo.width || oldImageInfo.size) && (
              <div className="text-github-text-muted mt-2" style={{ fontSize: '14px' }}>
                {formatDimensions(oldImageInfo)}
                {formatDimensions(oldImageInfo) && formatFileSize(oldImageInfo.size) && ' | '}
                {formatFileSize(oldImageInfo.size)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // For added files, show only the new version
  if (isAdded) {
    return (
      <div className="bg-github-bg-primary p-4">
        <div className="text-center">
          <div className="mb-2">
            <span className="text-github-accent font-medium">Added Image</span>
          </div>
          <div className="inline-block border border-github-border rounded-md p-4 bg-github-bg-secondary">
            <div className="text-github-text-muted mb-2" style={{ fontSize: '14px' }}>
              New file:
            </div>
            <img
              src={`/api/blob/${file.path}?ref=${targetRef}`}
              alt={`New image ${file.path}`}
              className="max-w-full max-h-96 border border-github-border rounded mx-auto"
              style={checkerboardStyle}
              onLoad={(e) => handleImageLoad(e.currentTarget, setNewImageInfo)}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden text-github-text-muted text-sm mt-2">
              Image could not be loaded
            </div>
            {(newImageInfo.width || newImageInfo.size) && (
              <div className="text-github-text-muted mt-2" style={{ fontSize: '14px' }}>
                {formatDimensions(newImageInfo)}
                {formatDimensions(newImageInfo) && formatFileSize(newImageInfo.size) && ' | '}
                {formatFileSize(newImageInfo.size)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // For modified/renamed files, show both versions
  if (isModified) {
    if (mode === 'side-by-side') {
      return (
        <div className="bg-github-bg-primary p-4">
          <div className="text-center mb-4">
            <span className="text-github-text-primary font-medium">Modified Image</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Old version */}
            <div className="text-center">
              <div className="border border-github-border rounded-md p-4 bg-github-bg-secondary">
                <div className="text-github-text-muted mb-2" style={{ fontSize: '14px' }}>
                  Previous version:
                </div>
                <img
                  src={`/api/blob/${file.oldPath || file.path}?ref=${baseRef}`}
                  alt={`Previous version of ${file.oldPath || file.path}`}
                  className="max-w-full max-h-96 border border-github-border rounded mx-auto"
                  style={checkerboardStyle}
                  onLoad={(e) => handleImageLoad(e.currentTarget, setOldImageInfo)}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden text-github-text-muted text-sm mt-2">
                  Image could not be loaded
                </div>
                {(oldImageInfo.width || oldImageInfo.size) && (
                  <div className="text-github-text-muted mt-2" style={{ fontSize: '14px' }}>
                    {formatDimensions(oldImageInfo)}
                    {formatDimensions(oldImageInfo) && formatFileSize(oldImageInfo.size) && ' | '}
                    {formatFileSize(oldImageInfo.size)}
                  </div>
                )}
              </div>
            </div>

            {/* New version */}
            <div className="text-center">
              <div className="border border-github-border rounded-md p-4 bg-github-bg-secondary">
                <div className="text-github-text-muted mb-2" style={{ fontSize: '14px' }}>
                  Current version:
                </div>
                <img
                  src={`/api/blob/${file.path}?ref=${targetRef}`}
                  alt={`Current version of ${file.path}`}
                  className="max-w-full max-h-96 border border-github-border rounded mx-auto"
                  style={checkerboardStyle}
                  onLoad={(e) => handleImageLoad(e.currentTarget, setNewImageInfo)}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden text-github-text-muted text-sm mt-2">
                  Image could not be loaded
                </div>
                {(newImageInfo.width || newImageInfo.size) && (
                  <div className="text-github-text-muted mt-2" style={{ fontSize: '14px' }}>
                    {formatDimensions(newImageInfo)}
                    {formatDimensions(newImageInfo) && formatFileSize(newImageInfo.size) && ' | '}
                    {formatFileSize(newImageInfo.size)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      // Inline mode: stack vertically
      return (
        <div className="bg-github-bg-primary p-4">
          <div className="text-center mb-4">
            <span className="text-github-text-primary font-medium">Modified Image</span>
          </div>
          <div className="space-y-6">
            {/* Old version */}
            <div className="text-center">
              <div className="border border-github-border rounded-md p-4 bg-github-bg-secondary inline-block">
                <div className="text-github-text-muted mb-2" style={{ fontSize: '14px' }}>
                  Previous version:
                </div>
                <img
                  src={`/api/blob/${file.oldPath || file.path}?ref=${baseRef}`}
                  alt={`Previous version of ${file.oldPath || file.path}`}
                  className="max-w-full max-h-96 border border-github-border rounded mx-auto"
                  style={checkerboardStyle}
                  onLoad={(e) => handleImageLoad(e.currentTarget, setOldImageInfo)}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden text-github-text-muted text-sm mt-2">
                  Image could not be loaded
                </div>
                {(oldImageInfo.width || oldImageInfo.size) && (
                  <div className="text-github-text-muted mt-2" style={{ fontSize: '14px' }}>
                    {formatDimensions(oldImageInfo)}
                    {formatDimensions(oldImageInfo) && formatFileSize(oldImageInfo.size) && ' | '}
                    {formatFileSize(oldImageInfo.size)}
                  </div>
                )}
              </div>
            </div>

            {/* New version */}
            <div className="text-center">
              <div className="border border-github-border rounded-md p-4 bg-github-bg-secondary inline-block">
                <div className="text-github-text-muted mb-2" style={{ fontSize: '14px' }}>
                  Current version:
                </div>
                <img
                  src={`/api/blob/${file.path}?ref=${targetRef}`}
                  alt={`Current version of ${file.path}`}
                  className="max-w-full max-h-96 border border-github-border rounded mx-auto"
                  style={checkerboardStyle}
                  onLoad={(e) => handleImageLoad(e.currentTarget, setNewImageInfo)}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden text-github-text-muted text-sm mt-2">
                  Image could not be loaded
                </div>
                {(newImageInfo.width || newImageInfo.size) && (
                  <div className="text-github-text-muted mt-2" style={{ fontSize: '14px' }}>
                    {formatDimensions(newImageInfo)}
                    {formatDimensions(newImageInfo) && formatFileSize(newImageInfo.size) && ' | '}
                    {formatFileSize(newImageInfo.size)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  return null;
}
