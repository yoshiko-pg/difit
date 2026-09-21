import React from 'react';
import ReactDOM from 'react-dom/client';
import { HotkeysProvider } from 'react-hotkeys-hook';

import App from './App';
import { installRepoScopedApi } from './services/repoScopedApi';
import './styles/global.css';

// Scope all /api/* requests to the active repository before anything fetches.
installRepoScopedApi();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HotkeysProvider initiallyActiveScopes={['navigation']}>
      <App />
    </HotkeysProvider>
  </React.StrictMode>,
);
