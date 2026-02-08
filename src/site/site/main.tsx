import React from 'react';
import ReactDOM from 'react-dom/client';

import SitePage from '../SitePage';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

document.title = 'difit - Interactive Site';

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <SitePage />
  </React.StrictMode>,
);
