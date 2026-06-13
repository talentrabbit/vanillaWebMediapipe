@ECHO OFF
SETLOCAL
PUSHD "%~dp0"

REM Launch the PowerShell start script with execution policy bypass.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %*
SET EXIT_CODE=%ERRORLEVEL%

IF %EXIT_CODE% EQU 0 (
  ECHO.
  ECHO Server start command completed.
) ELSE (
  ECHO.
  ECHO Server start command failed with exit code %EXIT_CODE%.
)
ECHO.
PAUSE
POPd
ENDLOCAL
