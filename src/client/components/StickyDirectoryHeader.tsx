import { ChevronRight, FolderOpen } from 'lucide-react';

import { type DirInfo } from '../hooks/useStickyDirectories';

interface StickyDirectoryHeaderProps {
  dirs: DirInfo[];
  onNavigate: (path: string) => void;
}

export function StickyDirectoryHeader({ dirs, onNavigate }: StickyDirectoryHeaderProps) {
  if (dirs.length === 0) return null;

  return (
    <div className="sticky top-0 z-20 bg-github-bg-secondary/95 backdrop-blur-sm border-b border-github-border">
      {dirs.map((dir, idx) => (
        <div
          key={dir.path}
          className="flex items-center gap-2 px-4 py-1.5 hover:bg-github-bg-tertiary cursor-pointer text-sm"
          style={{ paddingLeft: `${idx * 16 + 16}px` }}
          onClick={() => onNavigate(dir.path)}
        >
          <ChevronRight size={14} className="text-github-text-muted flex-shrink-0" />
          <FolderOpen size={14} className="text-github-text-secondary flex-shrink-0" />
          <span className="text-github-text-primary font-medium truncate">{dir.name}</span>
        </div>
      ))}
    </div>
  );
}
