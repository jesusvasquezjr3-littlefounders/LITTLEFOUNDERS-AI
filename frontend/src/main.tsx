import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize i18n (must be imported before App renders)
import './i18n'

// Block right-click globally for security measures
document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(
    <App />
);
