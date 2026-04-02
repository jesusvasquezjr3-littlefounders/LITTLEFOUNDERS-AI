import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize i18n (must be imported before App renders)
import './i18n'

// Protect images globally from being right-clicked or dragged
document.addEventListener('contextmenu', (event) => {
  if (event.target instanceof HTMLImageElement) {
    event.preventDefault();
  }
});

document.addEventListener('dragstart', (event) => {
  if (event.target instanceof HTMLImageElement) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(
    <App />
);
