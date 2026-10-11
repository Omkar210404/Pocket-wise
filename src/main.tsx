import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-ext-400.css';
import '@fontsource/ibm-plex-sans/latin-ext-500.css';
import '@fontsource/ibm-plex-sans/latin-ext-600.css';
import './styles/tokens.css';
import './styles/base.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

async function start() {
  // Written out here, not imported, so the bundler can see that it is false in
  // a normal build and leave the whole demo layer out of it.
  if (import.meta.env.VITE_DEMO === 'true') {
    // Demo mode: the mock service worker must be answering before the first request.
    const { startDemo } = await import('./demo/browser');
    await startDemo();
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
