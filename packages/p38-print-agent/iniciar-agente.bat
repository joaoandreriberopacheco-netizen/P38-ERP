@echo off
title P38 Print Agent
cd /d "%~dp0..\.."
echo Iniciando P38 Print Agent...
node packages/p38-print-agent/bin/start.mjs
pause
