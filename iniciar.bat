@echo off
title Mercado PDV - Inicializador
cd /d "%~dp0"

echo ============================================
echo   MERCADO PDV - iniciando tudo...
echo ============================================
echo.

echo [1/3] Subindo o banco PostgreSQL (porta 5432)...
"%~dp0pgsql\bin\pg_ctl.exe" -D "%~dp0pgdata" -l "%~dp0pg.log" -o "-p 5432" start
echo.

echo [2/3] Subindo o backend (porta 3012)...
start "Mercado PDV - Backend" cmd /k "cd /d %~dp0backend && npm run start:dev"

echo [3/3] Subindo o frontend (porta 3013)...
start "Mercado PDV - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Aguardando os servidores subirem...
timeout /t 12 /nobreak >nul

start http://localhost:3013/login

echo.
echo ============================================
echo   Pronto! Acesse: http://localhost:3013/login
echo.
echo   Admin    : admin@mercado.com    / admin123
echo   Gerente  : gerente@mercado.com  / gerente123
echo   Caixa    : caixa@mercado.com    / caixa123
echo   Estoque  : estoque@mercado.com  / estoque123
echo ============================================
echo.
echo Esta janela pode ser fechada. Para PARAR tudo, rode parar.bat
pause
