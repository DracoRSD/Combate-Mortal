@echo off
rem Cierra SOLO lo de Combate Mortal: las ventanas del Chrome propio (perfil-cmf) y el servidor.
rem Tu otro Chrome, si lo tienes abierto, no se toca.
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -like '*perfil-cmf*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
taskkill /FI "WINDOWTITLE eq Servidor CMF*" /T /F >nul 2>nul
