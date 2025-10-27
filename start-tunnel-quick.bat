@echo off
echo ============================================
echo  LittleFounders - Cloudflare Tunnel Rapido
echo ============================================
echo.
echo Este script expone tu aplicacion en Docker (puerto 80)
echo a traves de Cloudflare Tunnel.
echo.
echo IMPORTANTE: Asegurate de tener Docker Compose corriendo:
echo    docker-compose up -d
echo.
echo Presiona Ctrl+C para detener el tunnel
echo.
echo ============================================
echo.

.\cloudflared-windows-amd64.exe tunnel --url http://localhost:80

