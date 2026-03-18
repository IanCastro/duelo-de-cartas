@echo off
setlocal

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-tests.ps1"

set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% neq 0 (
  echo.
  echo Testes finalizaram com falhas.
) else (
  echo.
  echo Testes executados com sucesso.
)

exit /b %EXIT_CODE%
