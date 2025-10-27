@echo off
echo ============================================
echo  LittleFounders - Cloudflare Tunnel Dev
echo ============================================
echo.
echo Este script expone tu frontend en desarrollo (puerto 5173)
echo a traves de Cloudflare Tunnel.
echo.
echo IMPORTANTE: Asegurate de tener el frontend corriendo:
echo    npm run dev
echo.
echo Presiona Ctrl+C para detener el tunnel
echo.
echo ============================================
echo.

.\cloudflared-windows-amd64.exe tunnel --url http://localhost:5173

