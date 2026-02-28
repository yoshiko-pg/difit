import { useCallback, useEffect, useRef, useState } from 'react';

import { type DiffResponse } from '../../types/diff';
import { getFileElementId } from '../utils/domUtils';

const INITIAL_RENDERED_FILE_COUNT = 8;
const LAZY_RENDER_ROOT_MARGIN = '1200px 0px';
const SIDEBAR_SCROLL_MAX_ATTEMPTS = 60;
const SIDEBAR_SCROLL_CORRECTION_DELAY_MS = 180;

interface UseLazyDiffRenderingOptions {
  diffData: DiffResponse | null;
  diffScrollContainerRef: React.RefObject<HTMLElement | null>;
  setDiffData: React.Dispatch<React.SetStateAction<DiffResponse | null>>;
}

interface UseLazyDiffRenderingReturn {
  renderedFilePaths: Set<string>;
  ensureFileRendered: (filePath: string) => void;
  ensureFilesRenderedUpTo: (filePath: string) => void;
  registerLazyFileContainer: (filePath: string, node: HTMLDivElement | null) => void;
  scrollFileIntoDiffContainer: (filePath: string) => void;
}

export function useLazyDiffRendering({
  diffData,
  diffScrollContainerRef,
  setDiffData,
}: UseLazyDiffRenderingOptions): UseLazyDiffRenderingReturn {
  const [renderedFilePaths, setRenderedFilePaths] = useState<Set<string>>(new Set());
  const renderedFilePathsRef = useRef<Set<string>>(new Set());
  const lazyFileObserverRef = useRef<IntersectionObserver | null>(null);
  const lazyFileNodesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const generatedStatusCheckedRef = useRef<Set<string>>(new Set());
  const renderedRevisionKeyRef = useRef<string | null>(null);
  const scrollRequestIdRef = useRef(0);

  useEffect(() => {
    if (!diffData) {
      const nextPaths = new Set<string>();
      renderedFilePathsRef.current = nextPaths;
      setRenderedFilePaths(nextPaths);
      generatedStatusCheckedRef.current.clear();
      renderedRevisionKeyRef.current = null;
      return;
    }

    const revisionKey = `${diffData.requestedBaseCommitish ?? ''}:${diffData.requestedTargetCommitish ?? ''}`;
    if (renderedRevisionKeyRef.current === revisionKey) {
      return;
    }
    renderedRevisionKeyRef.current = revisionKey;

    const initialPaths = diffData.files
      .slice(0, INITIAL_RENDERED_FILE_COUNT)
      .map((file) => file.path);
    const nextPaths = new Set(initialPaths);
    renderedFilePathsRef.current = nextPaths;
    setRenderedFilePaths(nextPaths);
    generatedStatusCheckedRef.current.clear();
  }, [diffData]);

  const ensureFileRendered = useCallback((filePath: string) => {
    const node = lazyFileNodesRef.current.get(filePath);
    if (node && lazyFileObserverRef.current) {
      lazyFileObserverRef.current.unobserve(node);
    }

    setRenderedFilePaths((prev) => {
      if (prev.has(filePath)) return prev;
      const next = new Set(prev);
      next.add(filePath);
      renderedFilePathsRef.current = next;
      return next;
    });
  }, []);

  const registerLazyFileContainer = useCallback((filePath: string, node: HTMLDivElement | null) => {
    const observer = lazyFileObserverRef.current;
    const previousNode = lazyFileNodesRef.current.get(filePath);
    if (previousNode && observer) {
      observer.unobserve(previousNode);
    }

    if (!node) {
      lazyFileNodesRef.current.delete(filePath);
      return;
    }

    lazyFileNodesRef.current.set(filePath, node);
    if (renderedFilePathsRef.current.has(filePath) || !observer) {
      return;
    }
    observer.observe(node);
  }, []);

  useEffect(() => {
    if (lazyFileObserverRef.current) {
      lazyFileObserverRef.current.disconnect();
    }

    if (!diffData) {
      lazyFileObserverRef.current = null;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setRenderedFilePaths((prev) => {
          let changed = false;
          const next = new Set(prev);

          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const path = (entry.target as HTMLElement).dataset.filePath;
            if (!path || next.has(path)) return;
            next.add(path);
            observer.unobserve(entry.target);
            changed = true;
          });

          if (changed) {
            renderedFilePathsRef.current = next;
          }
          return changed ? next : prev;
        });
      },
      {
        root: diffScrollContainerRef.current,
        rootMargin: LAZY_RENDER_ROOT_MARGIN,
      },
    );

    lazyFileObserverRef.current = observer;
    lazyFileNodesRef.current.forEach((node, filePath) => {
      if (!renderedFilePathsRef.current.has(filePath)) {
        observer.observe(node);
      }
    });

    return () => {
      observer.disconnect();
      lazyFileObserverRef.current = null;
    };
  }, [diffData, diffScrollContainerRef]);

  const ensureFilesRenderedUpTo = useCallback(
    (filePath: string) => {
      if (!diffData) return;
      const targetIndex = diffData.files.findIndex((file) => file.path === filePath);
      if (targetIndex < 0) return;

      const observer = lazyFileObserverRef.current;

      setRenderedFilePaths((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (let i = 0; i <= targetIndex; i++) {
          const path = diffData.files[i]?.path;
          if (path && !next.has(path)) {
            next.add(path);
            changed = true;
            const node = lazyFileNodesRef.current.get(path);
            if (node && observer) {
              observer.unobserve(node);
            }
          }
        }
        if (changed) {
          renderedFilePathsRef.current = next;
        }
        return changed ? next : prev;
      });
    },
    [diffData],
  );

  const scrollFileIntoDiffContainer = useCallback(
    (filePath: string) => {
      ensureFilesRenderedUpTo(filePath);

      const targetIndex = diffData?.files.findIndex((file) => file.path === filePath) ?? -1;
      const requiredSectionIds =
        diffData && targetIndex >= 0
          ? diffData.files.slice(0, targetIndex + 1).map((file) => getFileElementId(file.path))
          : [getFileElementId(filePath)];
      const requestId = scrollRequestIdRef.current + 1;
      scrollRequestIdRef.current = requestId;

      const areRequiredSectionsReady = () => {
        for (const sectionId of requiredSectionIds) {
          const sectionNode = document.getElementById(sectionId);
          if (!sectionNode || sectionNode.dataset.rendered !== 'true') {
            return false;
          }
        }
        return true;
      };

      const tryScroll = (behavior: ScrollBehavior) => {
        const scrollContainer = diffScrollContainerRef.current;
        const target = document.getElementById(getFileElementId(filePath));
        if (!scrollContainer || !target) {
          return false;
        }

        const containerRect = scrollContainer.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const targetScrollTop = scrollContainer.scrollTop + (targetRect.top - containerRect.top);

        scrollContainer.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior,
        });
        return true;
      };

      let attempts = 0;
      const attemptScroll = () => {
        requestAnimationFrame(() => {
          if (scrollRequestIdRef.current !== requestId) {
            return;
          }

          if (!areRequiredSectionsReady()) {
            if (attempts < SIDEBAR_SCROLL_MAX_ATTEMPTS) {
              attempts++;
              attemptScroll();
            }
            return;
          }

          if (!tryScroll('smooth')) {
            if (attempts < SIDEBAR_SCROLL_MAX_ATTEMPTS) {
              attempts++;
              attemptScroll();
            }
            return;
          }

          window.setTimeout(() => {
            if (scrollRequestIdRef.current !== requestId) {
              return;
            }
            // Re-run smooth scroll after layout settles to absorb lazy-render shifts.
            tryScroll('smooth');
          }, SIDEBAR_SCROLL_CORRECTION_DELAY_MS);
        });
      };
      attemptScroll();
    },
    [diffData, diffScrollContainerRef, ensureFilesRenderedUpTo],
  );

  useEffect(() => {
    if (!diffData || diffData.targetCommitish === 'stdin') return;

    const ref = diffData.targetCommitish || 'HEAD';
    const generatedStatusRevisionKey = `${diffData.requestedBaseCommitish ?? ''}...${diffData.requestedTargetCommitish ?? ''}`;

    diffData.files.forEach((file) => {
      if (
        !renderedFilePaths.has(file.path) ||
        file.isGenerated !== false ||
        file.status === 'deleted'
      ) {
        return;
      }

      const cacheKey = `${generatedStatusRevisionKey}:${ref}:${file.path}`;
      if (generatedStatusCheckedRef.current.has(cacheKey)) {
        return;
      }
      generatedStatusCheckedRef.current.add(cacheKey);

      const encodedPath = encodeURIComponent(file.path);
      fetch(`/api/generated-status/${encodedPath}?ref=${encodeURIComponent(ref)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((payload: { isGenerated?: unknown } | null) => {
          if (!payload || payload.isGenerated !== true) return;

          setDiffData((prev) => {
            if (!prev) return prev;
            if (
              prev.requestedBaseCommitish !== diffData.requestedBaseCommitish ||
              prev.requestedTargetCommitish !== diffData.requestedTargetCommitish
            ) {
              return prev;
            }

            let changed = false;
            const nextFiles = prev.files.map((candidate) => {
              if (candidate.path !== file.path || candidate.isGenerated) {
                return candidate;
              }
              changed = true;
              return { ...candidate, isGenerated: true };
            });

            return changed ? { ...prev, files: nextFiles } : prev;
          });
        })
        .catch(() => {
          // Ignore generated status fetch failures and keep fast path.
        });
    });
  }, [diffData, renderedFilePaths, setDiffData]);

  return {
    renderedFilePaths,
    ensureFileRendered,
    ensureFilesRenderedUpTo,
    registerLazyFileContainer,
    scrollFileIntoDiffContainer,
  };
}
