// API Configuration
// Cambia esta URL según tu entorno

// Para desarrollo utilizamos localhost:8000 por defecto si no hay variable de entorno
// Esto previene que se conecte a producción por error en dev.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default API_URL;

