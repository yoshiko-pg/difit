import { ChevronDown, FolderOpen } from 'lucide-react';

import { type DirInfo } from '../hooks/useStickyDirectories';

interface StickyDirectoryHeaderProps {
  dirs: DirInfo[];
  onNavigate: (path: string) => void;
}

export function StickyDirectoryHeader({ dirs, onNavigate }: StickyDirectoryHeaderProps) {
  if (dirs.length === 0) return null;

  return (
    <div className="sticky top-0 z-20 bg-github-bg-secondary">
      {dirs.map((dir) => (
        <div
          key={dir.path}
          className="flex items-center gap-2 px-4 py-2 hover:bg-github-bg-tertiary cursor-pointer"
          style={{ paddingLeft: `${dir.depth * 16 + 16}px` }}
          onClick={() => onNavigate(dir.path)}
        >
          <ChevronDown size={16} />
          <FolderOpen size={16} className="text-github-text-secondary" />
          <span
            className="text-sm text-github-text-primary font-medium flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
            title={dir.name}
          >
            {dir.name}
          </span>
        </div>
      ))}
    </div>
  );
}
