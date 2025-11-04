// API Configuration
// Cambia esta URL según tu entorno

// Para desarrollo local:
// export const API_URL = 'http://localhost:8000';

// Para producción en AWS/NGINX (usa variable de entorno si existe)
export const API_URL = import.meta.env.VITE_API_URL || 'https://api.littlefounders.ai';

// O usa variable de entorno si la tienes configurada:
// export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default API_URL;

