@echo off
echo ============================================
echo  LittleFounders - Cloudflare Tunnel Backend
echo ============================================
echo.
echo Este script expone tu backend API (puerto 8000)
echo a traves de Cloudflare Tunnel.
echo.
echo IMPORTANTE: Asegurate de tener el backend corriendo:
echo    cd backend
echo    python main.py
echo.
echo Presiona Ctrl+C para detener el tunnel
echo.
echo ============================================
echo.

.\cloudflared-windows-amd64.exe tunnel --url http://localhost:8000

