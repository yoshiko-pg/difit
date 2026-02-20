import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';

import { normalizeWord } from '../utils/wordDetection';

const HOVER_DELAY_MS = 200;

interface WordHighlightContextValue {
  highlightedWord: string | null;
  handleMouseOver: (e: React.MouseEvent) => void;
  handleMouseOut: () => void;
  isWordHighlighted: (word: string) => boolean;
}

const WordHighlightContext = createContext<WordHighlightContextValue | undefined>(undefined);

export function WordHighlightProvider({ children }: { children: ReactNode }) {
  const [highlightedWord, setHighlightedWord] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearHighlightTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleMouseOver = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if target is a word token element
      if (!target.classList.contains('word-token')) {
        return;
      }

      clearHighlightTimeout();

      const word = target.getAttribute('data-word');
      if (!word) {
        return;
      }

      timeoutRef.current = setTimeout(() => {
        setHighlightedWord(word);
      }, HOVER_DELAY_MS);
    },
    [clearHighlightTimeout],
  );

  const handleMouseOut = useCallback(() => {
    clearHighlightTimeout();
    setHighlightedWord(null);
  }, [clearHighlightTimeout]);

  const isWordHighlighted = useCallback(
    (word: string): boolean => {
      if (!highlightedWord) return false;
      return normalizeWord(word) === normalizeWord(highlightedWord);
    },
    [highlightedWord],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const value = useMemo<WordHighlightContextValue>(
    () => ({
      highlightedWord,
      handleMouseOver,
      handleMouseOut,
      isWordHighlighted,
    }),
    [highlightedWord, handleMouseOver, handleMouseOut, isWordHighlighted],
  );

  return <WordHighlightContext.Provider value={value}>{children}</WordHighlightContext.Provider>;
}

export function useWordHighlight() {
  const context = useContext(WordHighlightContext);
  if (!context) {
    throw new Error('useWordHighlight must be used within a WordHighlightProvider');
  }
  return context;
}
