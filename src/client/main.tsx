import React from 'react';
import ReactDOM from 'react-dom/client';
import { HotkeysProvider } from 'react-hotkeys-hook';

import LandingPage from '../site/LandingPage';
import StaticDiffApp from '../site/StaticDiffApp';

import App from './App';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const pathname = window.location.pathname;
const isLandingRoute = pathname === '/site' || pathname.startsWith('/site/');
const isStaticDiffViewerRoute = pathname === '/app-static' || pathname.startsWith('/app-static/');
const RootComponent =
  isLandingRoute ? LandingPage
  : isStaticDiffViewerRoute ? StaticDiffApp
  : App;

document.title =
  isLandingRoute ? 'difit - Interactive Landing'
  : isStaticDiffViewerRoute ? 'difit - Static Diff Viewer'
  : 'difit - Git Diff Viewer';

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HotkeysProvider initiallyActiveScopes={['navigation']}>
      <RootComponent />
    </HotkeysProvider>
  </React.StrictMode>,
);
