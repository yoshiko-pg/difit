import { createContext, useContext, type ReactNode } from 'react';

import type { FileLevelTokens } from '../hooks/useFileLevelTokens';

const FileLevelTokensContext = createContext<FileLevelTokens>({
  getOldTokens: null,
  getNewTokens: null,
});

export function FileLevelTokensProvider({
  value,
  children,
}: {
  value: FileLevelTokens;
  children: ReactNode;
}) {
  return (
    <FileLevelTokensContext.Provider value={value}>{children}</FileLevelTokensContext.Provider>
  );
}

export function useFileLevelTokensLookup(): FileLevelTokens {
  return useContext(FileLevelTokensContext);
}
