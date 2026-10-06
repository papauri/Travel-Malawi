import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { auth } from './lib/firebase';
import './index.css';

// Attach the signed-in user's Firebase ID token to every same-origin /api
// request, so the server can check who is calling. Requests that already carry
// an Authorization header, and cross-origin requests, are left untouched.
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  try {
    const originalFetch = window.fetch.bind(window);
    const authenticatedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const urlStr = input instanceof Request ? input.url : String(input);
        const url = new URL(urlStr, window.location.origin);
        const user = auth.currentUser;
        if (user && url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
          const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
          if (!headers.has('Authorization')) {
            const token = await user.getIdToken();
            if (token) {
              headers.set('Authorization', `Bearer ${token}`);
            }
            return originalFetch(input, { ...init, headers });
          }
        }
      } catch {
        // Fall through to an unauthenticated request.
      }
      return originalFetch(input, init);
    };

    // Use Object.defineProperty because direct assignment `window.fetch = ...`
    // throws "Cannot set property fetch of #<Window> which has only a getter"
    // in strict mode when fetch is an accessor on Window.prototype.
    try {
      Object.defineProperty(window, 'fetch', {
        value: authenticatedFetch,
        writable: true,
        configurable: true,
      });
    } catch {
      (window as any).fetch = authenticatedFetch;
    }
  } catch (err) {
    console.warn('[Fetch] Could not install authenticated fetch interceptor:', err);
  }
}

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
