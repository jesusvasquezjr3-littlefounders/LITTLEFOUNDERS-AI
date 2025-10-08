# Multi-stage build para optimizar el tamaño de la imagen

# Stage 1: Build del frontend
FROM node:18-alpine AS frontend-build

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
RUN npm ci

# Copiar el resto de los archivos del frontend
COPY . .

# Build de producción
RUN npm run build

# Stage 2: Setup del backend y servidor
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Copiar y instalar dependencias de Python
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copiar el código del backend
COPY backend ./backend

# Copiar el frontend construido desde el stage anterior
COPY --from=frontend-build /app/dist /app/frontend

# Configurar Nginx
COPY docker/nginx.conf /etc/nginx/sites-available/default

# Configurar Supervisor para manejar múltiples procesos
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Exponer puertos
EXPOSE 80 8000

# Comando de inicio usando Supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

