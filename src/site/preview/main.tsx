import React from 'react';
import ReactDOM from 'react-dom/client';
import { HotkeysProvider } from 'react-hotkeys-hook';

import '../../client/styles/global.css';
import StaticDiffApp from '../StaticDiffApp';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

document.title = 'difit - Preview';

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HotkeysProvider initiallyActiveScopes={['navigation']}>
      <StaticDiffApp />
    </HotkeysProvider>
  </React.StrictMode>,
);
