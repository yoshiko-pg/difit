import React from 'react';
import ReactDOM from 'react-dom/client';
import { HotkeysProvider } from 'react-hotkeys-hook';

import App from './App';
import LandingPage from './LandingPage';
import StaticDiffApp from './StaticDiffApp';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const pathname = window.location.pathname;
const isDynamicDiffViewerRoute = pathname === '/app' || pathname.startsWith('/app/');
const isStaticDiffViewerRoute = pathname === '/app-static' || pathname.startsWith('/app-static/');
const RootComponent =
  isDynamicDiffViewerRoute ? App
  : isStaticDiffViewerRoute ? StaticDiffApp
  : LandingPage;

document.title =
  isDynamicDiffViewerRoute ? 'difit - Git Diff Viewer'
  : isStaticDiffViewerRoute ? 'difit - Static Diff Viewer'
  : 'difit - Interactive Landing';

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HotkeysProvider initiallyActiveScopes={['navigation']}>
      <RootComponent />
    </HotkeysProvider>
  </React.StrictMode>,
);
