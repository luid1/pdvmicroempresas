@echo off
title Mercado PDV - Parar
cd /d "%~dp0"

echo Parando o banco PostgreSQL...
"%~dp0pgsql\bin\pg_ctl.exe" -D "%~dp0pgdata" stop

echo.
echo Feche tambem as janelas do Backend e do Frontend (Ctrl+C nelas).
echo Banco parado.
pause
