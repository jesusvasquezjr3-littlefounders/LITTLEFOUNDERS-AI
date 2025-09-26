import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Import PostHog test in development
if (import.meta.env.DEV) {
  import('./utils/posthog-test')
  import('./utils/posthog-dashboard-test')
}

createRoot(document.getElementById("root")!).render(<App />);
