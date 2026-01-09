// API Configuration
// Cambia esta URL según tu entorno

// Detect environment automatically
// In production (Vercel), use relative path '/api' to use the rewrites defined in vercel.json
// In development, use localhost:8000
export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000');

export default API_URL;

