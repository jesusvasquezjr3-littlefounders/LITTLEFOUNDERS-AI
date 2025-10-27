@echo off
echo ============================================
echo  LittleFounders - Inicio Completo
echo ============================================
echo.
echo Este script iniciara:
echo 1. Docker Compose (Base de datos, Backend, Frontend)
echo 2. Cloudflare Tunnel para exponer la aplicacion
echo.
echo ============================================
echo.

echo Iniciando Docker Compose...
docker-compose up -d

echo.
echo Esperando a que los servicios esten listos...
timeout /t 5 /nobreak

echo.
echo Iniciando Cloudflare Tunnel...
echo La URL de tu aplicacion aparecera a continuacion:
echo.

.\cloudflared-windows-amd64.exe tunnel --url http://localhost:80

