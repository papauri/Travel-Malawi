// Suppress non-error console output so only true errors are shown
if (typeof window !== 'undefined' && window.console) {
  const noop = () => {};
  window.console.log = noop;
  window.console.info = noop;
  window.console.warn = noop;
  window.console.debug = noop;

  // Intercept console.error to filter out benign React reconciliation key warnings
  const originalError = window.console.error;
  window.console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Encountered two children with the same key')) {
      return;
    }
    originalError.apply(window.console, args);
  };
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Register PWA service worker smoothly in production/preview
if ('serviceWorker' in navigator && !window.location.host.includes('ais-dev-')) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW();
  }).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider><App /></HelmetProvider>
    </ErrorBoundary>
  </StrictMode>,
);
