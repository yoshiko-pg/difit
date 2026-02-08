import React from 'react';
import ReactDOM from 'react-dom/client';
import { HotkeysProvider } from 'react-hotkeys-hook';

import App from './App';
import LandingPage from './LandingPage';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const pathname = window.location.pathname;
const isDiffViewerRoute = pathname === '/app' || pathname.startsWith('/app/');
const RootComponent = isDiffViewerRoute ? App : LandingPage;

document.title = isDiffViewerRoute ? 'difit - Git Diff Viewer' : 'difit - Interactive Landing';

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HotkeysProvider initiallyActiveScopes={['navigation']}>
      <RootComponent />
    </HotkeysProvider>
  </React.StrictMode>,
);
