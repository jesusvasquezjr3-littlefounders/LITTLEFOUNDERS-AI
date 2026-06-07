// API Configuration
// VITE_API_URL should be set in Vercel's Environment Variables to the Railway backend URL.
// e.g. https://littlefounders-backend-production.up.railway.app
// In local development it falls back to localhost:8000
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default API_URL;

