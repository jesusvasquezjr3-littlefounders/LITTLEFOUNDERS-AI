import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize i18n (must be imported before App renders)
import './i18n'

createRoot(document.getElementById("root")!).render(
    <App />
);
