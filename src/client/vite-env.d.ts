/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DIFIT_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
