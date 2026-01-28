import { useCallback, useRef } from 'react';

interface UseDragToExpandOptions {
  direction: 'up' | 'down' | 'both';
  hiddenLines: number;
  isLoading: boolean;
  onDragExpand?: (direction: 'up' | 'down', lineCount: number) => void;
}

const LINE_HEIGHT_PX = 20;
const DRAG_THRESHOLD_PX = 5;

export function useDragToExpand({
  direction,
  hiddenLines,
  isLoading,
  onDragExpand,
}: UseDragToExpandOptions) {
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const expandedCountRef = useRef(0);
  const dragDirectionRef = useRef<'up' | 'down' | null>(null);

  const cleanup = useCallback(() => {
    isDraggingRef.current = false;
    dragDirectionRef.current = null;
    expandedCountRef.current = 0;
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!onDragExpand || isLoading) return;
      // Don't interfere with button clicks
      if ((e.target as HTMLElement).closest('button')) return;

      e.preventDefault();
      startYRef.current = e.clientY;
      expandedCountRef.current = 0;
      dragDirectionRef.current = null;

      let activated = false;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = moveEvent.clientY - startYRef.current;

        if (!activated) {
          if (Math.abs(deltaY) < DRAG_THRESHOLD_PX) return;
          activated = true;
          isDraggingRef.current = true;
          document.body.style.cursor = 'ns-resize';
          document.body.style.userSelect = 'none';
        }

        // Determine drag direction based on mouse movement
        // Dragging down (deltaY > 0) → expand 'up' chunk (pull lines from above)
        // Dragging up (deltaY < 0) → expand 'down' chunk (pull lines from below)
        const dragDir: 'up' | 'down' = deltaY > 0 ? 'up' : 'down';

        // Check if direction is allowed
        if (direction === 'up' && dragDir !== 'up') return;
        if (direction === 'down' && dragDir !== 'down') return;

        // For 'both', lock direction once started
        if (dragDirectionRef.current === null) {
          dragDirectionRef.current = dragDir;
        }
        // Only expand in the locked direction
        if (dragDir !== dragDirectionRef.current) return;

        const absDelta = Math.abs(deltaY);
        const totalLines = Math.floor(absDelta / LINE_HEIGHT_PX);
        const clampedLines = Math.min(totalLines, hiddenLines);

        if (clampedLines > expandedCountRef.current) {
          const newLines = clampedLines - expandedCountRef.current;
          expandedCountRef.current = clampedLines;
          onDragExpand(dragDir, newLines);
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        cleanup();
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [onDragExpand, isLoading, direction, hiddenLines, cleanup]
  );

  return { handleMouseDown };
}
