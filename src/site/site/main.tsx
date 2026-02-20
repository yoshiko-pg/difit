import React from 'react';
import ReactDOM from 'react-dom/client';

import '../../client/styles/global.css';
import '../styles/global.css';
import SitePage from '../SitePage';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <SitePage />
  </React.StrictMode>,
);
