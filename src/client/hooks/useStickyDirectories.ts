import { useRef, useCallback, useSyncExternalStore } from 'react';

export interface DirInfo {
  path: string;
  depth: number;
  name: string;
}

interface DirElement {
  element: HTMLElement;
  depth: number;
  name: string;
}

interface UseStickyDirectoriesOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
}

interface UseStickyDirectoriesReturn {
  stickyDirs: DirInfo[];
  registerDir: (path: string, element: HTMLElement | null, depth: number, name: string) => void;
}

export function useStickyDirectories({
  containerRef,
  enabled = true,
}: UseStickyDirectoriesOptions): UseStickyDirectoriesReturn {
  const stickyDirsRef = useRef<DirInfo[]>([]);
  const dirElementsRef = useRef<Map<string, DirElement>>(new Map());
  const onStoreChangeRef = useRef<(() => void) | null>(null);

  // Register/unregister directory elements
  const registerDir = useCallback(
    (path: string, element: HTMLElement | null, depth: number, name: string) => {
      if (element) {
        dirElementsRef.current.set(path, { element, depth, name });
      } else {
        dirElementsRef.current.delete(path);
      }
    },
    []
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      onStoreChangeRef.current = onStoreChange;
      const container = containerRef.current;
      if (!container || !enabled) {
        if (stickyDirsRef.current.length > 0) {
          stickyDirsRef.current = [];
          onStoreChange();
        }
        return () => {
          onStoreChangeRef.current = null;
        };
      }

      const handleScroll = () => {
        const containerRect = container.getBoundingClientRect();
        const containerTop = containerRect.top;
        const newStickyDirs: DirInfo[] = [];

        dirElementsRef.current.forEach(({ element, depth, name }, path) => {
          const rect = element.getBoundingClientRect();
          const relativeTop = rect.top - containerTop;
          const relativeBottom = rect.bottom - containerTop;

          if (relativeTop < 0 && relativeBottom > 0) {
            newStickyDirs.push({ path, depth, name });
          }
        });

        newStickyDirs.sort((a, b) => a.depth - b.depth);

        // Only trigger update if changed
        const hasChanged =
          newStickyDirs.length !== stickyDirsRef.current.length ||
          newStickyDirs.some((d, i) => d.path !== stickyDirsRef.current[i]?.path);

        if (hasChanged) {
          stickyDirsRef.current = newStickyDirs;
          onStoreChange();
        }
      };

      container.addEventListener('scroll', handleScroll, { passive: true });
      // Initial check
      handleScroll();

      return () => {
        container.removeEventListener('scroll', handleScroll);
        onStoreChangeRef.current = null;
      };
    },
    [containerRef, enabled]
  );

  const getSnapshot = useCallback(() => stickyDirsRef.current, []);

  const stickyDirs = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return { stickyDirs, registerDir };
}
