@echo off
rem Cierra SOLO lo de Combate Mortal: las ventanas del Chrome propio (perfil-cmf) y el servidor.
rem Tu otro Chrome, si lo tienes abierto, no se toca.
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -like '*perfil-cmf*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
taskkill /FI "WINDOWTITLE eq Servidor CMF*" /T /F >nul 2>nul
rem Y cualquier otro servidor en el puerto 8000 (por ejemplo, uno abierto a mano en PowerShell).
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":8000 .*LISTENING"') do taskkill /F /PID %%p >nul 2>nul
