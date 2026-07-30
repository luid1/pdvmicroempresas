@echo off
title Mercado PDV - Preparar banco (recria + popula catalogo)
cd /d "%~dp0"

echo ============================================
echo   MERCADO PDV - Preparando o banco
echo   (recria o schema e popula 157 produtos)
echo ============================================
echo.
echo IMPORTANTE: feche a janela do Backend se estiver aberta
echo (nao rode isto com o backend/nest --watch no ar).
echo.
pause

echo [1/4] Subindo o banco PostgreSQL (porta 5432)...
"%~dp0pgsql\bin\pg_ctl.exe" -D "%~dp0pgdata" -l "%~dp0pg.log" -o "-p 5432" start
timeout /t 4 /nobreak >nul
echo.

cd /d "%~dp0backend"

echo [2/4] Recriando o schema no banco (db push --force-reset)...
call npx prisma db push --force-reset --accept-data-loss
if errorlevel 1 goto :erro
echo.

echo [3/4] Gerando o Prisma Client...
call npx prisma generate
if errorlevel 1 goto :erro
echo.

echo [4/4] Populando catalogo de varejo (seed)...
call npx ts-node prisma/seed.ts
if errorlevel 1 goto :erro
echo.

echo ============================================
echo   Banco pronto! Agora rode  iniciar.bat
echo ============================================
echo.
pause
goto :eof

:erro
echo.
echo ============================================
echo   ERRO ao preparar o banco. Veja a mensagem acima.
echo ============================================
echo.
pause
