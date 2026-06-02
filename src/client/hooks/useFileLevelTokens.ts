import { normalizeTokens, type Token } from 'prism-react-renderer';
import { useEffect, useMemo, useState } from 'react';

import { type DiffFile } from '../../types/diff';
import { getPrismLanguageFromFilename } from '../utils/languageDetection';
import { loadPrismLanguage } from '../utils/languageLoader';
import Prism from '../utils/prism';

type LineTokensGetter = (lineNumber: number) => Token[] | null;

export interface FileLevelTokens {
  getOldTokens: LineTokensGetter | null;
  getNewTokens: LineTokensGetter | null;
}

const EMPTY: FileLevelTokens = { getOldTokens: null, getNewTokens: null };

// Whole-file tokenization is skipped for larger files so we don't pay the cost
// of highlighting the entire blob; these fall back to per-line highlighting.
const MAX_WHOLE_FILE_LINES = 2000;

async function fetchBlobText(filePath: string, ref: string): Promise<string | null> {
  try {
    const response = await fetch(
      `/api/blob/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(ref)}`,
    );
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function tokenizeContent(content: string, language: string): Token[][] | null {
  if (content.split('\n').length > MAX_WHOLE_FILE_LINES) return null;
  const grammar = Prism.languages[language];
  if (!grammar) return null;
  try {
    const raw = Prism.tokenize(content, grammar);
    return normalizeTokens(raw);
  } catch {
    return null;
  }
}

interface UseFileLevelTokensParams {
  file: DiffFile;
  enabled: boolean;
  baseCommitish?: string;
  targetCommitish?: string;
  reloadKey?: string | number;
}

export function useFileLevelTokens({
  file,
  enabled,
  baseCommitish,
  targetCommitish,
  reloadKey,
}: UseFileLevelTokensParams): FileLevelTokens {
  const language = useMemo(() => getPrismLanguageFromFilename(file.path), [file.path]);

  const [oldContent, setOldContent] = useState<string | null>(null);
  const [newContent, setNewContent] = useState<string | null>(null);
  const [grammarReady, setGrammarReady] = useState<boolean>(
    () => !enabled || !!Prism.languages[language],
  );

  useEffect(() => {
    if (!enabled) return;
    if (Prism.languages[language]) {
      setGrammarReady(true);
      return;
    }
    let cancelled = false;
    loadPrismLanguage(language)
      .then(() => {
        if (!cancelled) setGrammarReady(true);
      })
      .catch(() => {
        if (!cancelled) setGrammarReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, language]);

  useEffect(() => {
    if (!enabled) {
      setOldContent(null);
      setNewContent(null);
      return;
    }
    let cancelled = false;
    const needOld = file.status !== 'added' && !!baseCommitish;
    const needNew = file.status !== 'deleted' && !!targetCommitish;
    setOldContent(null);
    setNewContent(null);

    if (needOld) {
      const oldPath = file.oldPath || file.path;
      void fetchBlobText(oldPath, baseCommitish as string).then((text) => {
        if (!cancelled) setOldContent(text);
      });
    }
    if (needNew) {
      void fetchBlobText(file.path, targetCommitish as string).then((text) => {
        if (!cancelled) setNewContent(text);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [enabled, file.path, file.oldPath, file.status, baseCommitish, targetCommitish, reloadKey]);

  const oldTokens = useMemo<Token[][] | null>(() => {
    if (!enabled || !grammarReady || oldContent == null) return null;
    return tokenizeContent(oldContent, language);
  }, [enabled, grammarReady, oldContent, language]);

  const newTokens = useMemo<Token[][] | null>(() => {
    if (!enabled || !grammarReady || newContent == null) return null;
    return tokenizeContent(newContent, language);
  }, [enabled, grammarReady, newContent, language]);

  return useMemo<FileLevelTokens>(() => {
    if (!enabled) return EMPTY;
    const getOldTokens: LineTokensGetter | null = oldTokens
      ? (lineNumber: number) => oldTokens[lineNumber - 1] ?? null
      : null;
    const getNewTokens: LineTokensGetter | null = newTokens
      ? (lineNumber: number) => newTokens[lineNumber - 1] ?? null
      : null;
    return { getOldTokens, getNewTokens };
  }, [enabled, oldTokens, newTokens]);
}
