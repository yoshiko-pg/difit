import {
  ChevronRight,
  ChevronDown,
  FileDiff,
  FolderOpen,
  Folder,
  FilePlus,
  FileX,
  FilePen,
  Search,
  MessageSquare,
  ChevronsDownUp,
  ChevronsUpDown,
} from 'lucide-react';
import { useState, useRef, useMemo, useCallback } from 'react';

import { type DiffFile, type Comment } from '../../types/diff';
import { useStickyDirectories } from '../hooks/useStickyDirectories';

import { Checkbox } from './Checkbox';
import { StickyDirectoryHeader } from './StickyDirectoryHeader';

interface FileListProps {
  files: DiffFile[];
  onScrollToFile: (path: string) => void;
  comments: Comment[];
  reviewedFiles: Set<string>;
  onToggleReviewed: (path: string) => void;
  selectedFileIndex: number | null;
}

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
  file?: DiffFile;
}

function buildFileTree(files: DiffFile[]): TreeNode {
  const root: TreeNode = {
    name: '',
    path: '',
    isDirectory: true,
    children: [],
  };

  files.forEach((file) => {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      const isLast = i === parts.length - 1;
      const pathSoFar = parts.slice(0, i + 1).join('/');

      if (!current.children) {
        current.children = [];
      }

      let child = current.children.find((c) => c.name === part);

      if (!child) {
        child = {
          name: part,
          path: pathSoFar,
          isDirectory: !isLast,
          children: isLast ? undefined : [],
          file: isLast ? file : undefined,
        };
        current.children.push(child);
      }

      current = child;
    }
  });

  // Collapse single child directories
  const collapseDirectories = (node: TreeNode): TreeNode => {
    if (!node.isDirectory || !node.children) {
      return node;
    }

    // First, recursively collapse children
    node.children = node.children.map(collapseDirectories);

    // If this directory has only one child directory (no files), collapse them
    if (node.children.length === 1 && node.children[0]?.isDirectory && node.children[0]?.children) {
      const child = node.children[0];
      if (child) {
        // Don't collapse the root node - keep the full path structure
        if (!node.name) {
          return node;
        }
        return {
          ...node,
          name: `${node.name}/${child.name}`,
          path: child.path,
          children: child.children,
        };
      }
    }

    return node;
  };

  return collapseDirectories(root);
}

export function FileList({
  files,
  onScrollToFile,
  comments,
  reviewedFiles,
  onToggleReviewed,
  selectedFileIndex,
}: FileListProps) {
  const fileTree = buildFileTree(files);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dirElementsRef = useRef<Map<string, HTMLElement>>(new Map());

  // Initialize with all directories expanded
  const getAllDirectoryPaths = (node: TreeNode): string[] => {
    if (!node.isDirectory || !node.children) return [];
    const paths: string[] = [];
    if (node.path) paths.push(node.path);
    node.children.forEach((child) => {
      paths.push(...getAllDirectoryPaths(child));
    });
    return paths;
  };

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    () => new Set(getAllDirectoryPaths(fileTree))
  );
  const [filterText, setFilterText] = useState('');

  const getCommentCount = (filePath: string) => {
    return comments.filter((c) => c.file === filePath).length;
  };

  // Filter the file tree based on search text
  const filteredFileTree = useMemo(() => {
    const filterTreeNode = (node: TreeNode): TreeNode | null => {
      if (!filterText.trim()) return node;

      if (node.isDirectory && node.children) {
        const filteredChildren = node.children
          .map((child) => filterTreeNode(child))
          .filter((child) => child !== null);

        if (filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
        return null;
      } else if (node.file) {
        // Check if file name matches filter
        if (node.file.path.toLowerCase().includes(filterText.toLowerCase())) {
          return node;
        }
        return null;
      }

      return null;
    };

    return (
      filterTreeNode(fileTree) || {
        ...fileTree,
        children: [],
      }
    );
  }, [fileTree, filterText]);

  // Use sticky directories hook
  const { stickyDirs, registerDir } = useStickyDirectories({
    containerRef: scrollContainerRef,
    enabled: !filterText.trim(),
  });

  // Navigate to directory
  const handleNavigate = useCallback((path: string) => {
    const el = dirElementsRef.current.get(path);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const getFileIcon = (status: DiffFile['status']) => {
    switch (status) {
      case 'added':
        return <FilePlus size={16} className="text-github-accent" />;
      case 'deleted':
        return <FileX size={16} className="text-github-danger" />;
      case 'renamed':
        return <FilePen size={16} className="text-github-warning" />;
      default:
        return <FileDiff size={16} className="text-github-text-secondary" />;
    }
  };

  const toggleDirectory = (path: string) => {
    setExpandedDirs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const allPaths = getAllDirectoryPaths(fileTree);
  const isAllExpanded = expandedDirs.size === allPaths.length && allPaths.length > 0;

  const toggleAllDirectories = () => {
    // If all directories are expanded, collapse all. Otherwise, expand all.
    if (isAllExpanded) {
      setExpandedDirs(new Set());
    } else {
      setExpandedDirs(new Set(allPaths));
    }
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    if (node.isDirectory && node.children) {
      const isExpanded = expandedDirs.has(node.path);

      return (
        <div
          key={node.path}
          ref={(el) => {
            if (!node.path) return;

            if (el) {
              dirElementsRef.current.set(node.path, el);
              if (isExpanded) {
                registerDir(node.path, el, depth, node.name);
              } else {
                registerDir(node.path, null, depth, node.name);
              }
              return;
            }

            dirElementsRef.current.delete(node.path);
            registerDir(node.path, null, depth, node.name);
          }}
        >
          {node.name && (
            <div
              className="flex items-center gap-2 px-4 py-2 hover:bg-github-bg-tertiary cursor-pointer"
              style={{ paddingLeft: `${depth * 16 + 16}px` }}
              onClick={() => toggleDirectory(node.path)}
            >
              {isExpanded ?
                <ChevronDown size={16} />
              : <ChevronRight size={16} />}
              {isExpanded ?
                <FolderOpen size={16} className="text-github-text-secondary" />
              : <Folder size={16} className="text-github-text-secondary" />}
              <span
                className="text-sm text-github-text-primary font-medium flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                title={node.name}
              >
                {node.name}
              </span>
            </div>
          )}
          {(isExpanded || !node.name) &&
            node.children.map((child) => renderTreeNode(child, node.name ? depth + 1 : depth))}
        </div>
      );
    } else if (node.file) {
      const file = node.file;
      const commentCount = getCommentCount(file.path);
      const isReviewed = reviewedFiles.has(file.path);
      const fileIndex = files.findIndex((f) => f.path === file.path);
      const isSelected = selectedFileIndex !== null && selectedFileIndex === fileIndex;

      return (
        <div
          key={file.path}
          className={`flex items-center gap-2 px-4 py-2 hover:bg-github-bg-tertiary cursor-pointer transition-colors ${
            isReviewed ? 'opacity-70' : ''
          } ${isSelected ? 'bg-github-bg-tertiary' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 16}px` }}
          onClick={() => onScrollToFile(file.path)}
        >
          <Checkbox
            checked={isReviewed}
            onChange={() => {
              onToggleReviewed(file.path);
            }}
            title={isReviewed ? 'Mark as not reviewed' : 'Mark as reviewed'}
            className="z-10"
          />
          {getFileIcon(node.file.status)}
          <span
            className={`text-sm text-github-text-primary flex-1 overflow-hidden text-ellipsis whitespace-nowrap ${
              isReviewed ? 'line-through text-github-text-muted' : ''
            }`}
            title={node.file.path}
          >
            {node.name}
          </span>
          {commentCount > 0 && (
            <span className="text-github-warning text-sm font-medium ml-auto flex items-center gap-1">
              <MessageSquare size={14} />
              {commentCount}
            </span>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-github-border bg-github-bg-tertiary">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-github-text-primary m-0">
            Files changed ({files.length})
          </h3>
          <button
            onClick={toggleAllDirectories}
            className="p-1 hover:bg-github-bg-primary rounded transition-colors"
            title={isAllExpanded ? 'Collapse all' : 'Expand all'}
          >
            {isAllExpanded ?
              <ChevronsDownUp size={16} className="text-github-text-secondary" />
            : <ChevronsUpDown size={16} className="text-github-text-secondary" />}
          </button>
        </div>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-github-text-muted"
          />
          <input
            type="text"
            placeholder="Filter files..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-github-bg-primary border border-github-border rounded-md focus:outline-none focus:border-github-accent text-github-text-primary placeholder-github-text-muted"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative" ref={scrollContainerRef}>
        <StickyDirectoryHeader dirs={stickyDirs} onNavigate={handleNavigate} />
        {filteredFileTree.children?.map((child) => renderTreeNode(child))}
      </div>
    </div>
  );
}
