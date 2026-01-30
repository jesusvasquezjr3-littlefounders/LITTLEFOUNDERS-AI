import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize i18n (must be imported before App renders)
import './i18n'

import { GoogleOAuthProvider } from '@react-oauth/google';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

if (!clientId) {
    console.warn("Missing VITE_GOOGLE_CLIENT_ID environment variable. Google Auth will not work.");
}

createRoot(document.getElementById("root")!).render(
    <GoogleOAuthProvider clientId={clientId}>
        <App />
    </GoogleOAuthProvider>
);
