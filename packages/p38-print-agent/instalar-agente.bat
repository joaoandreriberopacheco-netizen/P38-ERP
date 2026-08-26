@echo off
chcp 65001 >nul
title P38 — Instalar Agente de Impressão
cd /d "%~dp0..\.."

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Node.js nao encontrado.
  echo.
  echo Opcao A — Use os ficheiros .exe na pasta packages\p38-print-agent\release\
  echo         ^(nao precisa de Node^)
  echo.
  echo Opcao B — Instale Node.js 22 em https://nodejs.org
  echo         Depois volte a correr este ficheiro.
  echo.
  pause
  exit /b 1
)

echo.
echo A iniciar instalador P38...
node packages/p38-print-agent/entries/install-windows.mjs
exit /b %ERRORLEVEL%
