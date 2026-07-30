import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';
import '@/i18n';
import '@/index.css';
import { captureLandingContext } from '@/lib/visitor';

// Snapshot UTM + referrer BEFORE React mounts and the SPA can navigate —
// they exist only on the landing URL (/INSIGHTS.md §7). Transmits nothing.
captureLandingContext();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </BrowserRouter>
  </StrictMode>,
);
