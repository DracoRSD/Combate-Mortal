@echo off
rem ============================================================================
rem  COMBATE MORTAL FREESTYLE - arranque de todo con un doble clic
rem  Abre el servidor, las ventanas de salida (transmision, reloj, lateral A, lateral B)
rem  en pantalla completa, las del torneo (torneo.html) y por ultimo la ventana del operador.
rem
rem  Usa un Chrome PROPIO de CMF (carpeta "perfil-cmf" al lado de este archivo).
rem  Asi los parametros que evitan que Chrome congele las ventanas tapadas SIEMPRE
rem  se aplican, aunque tengas otro Chrome abierto. La primera vez arranca limpio:
rem  las llaves guardadas en tu Chrome de siempre no aparecen (usa Importar llaves).
rem ============================================================================
setlocal
cd /d "%~dp0"

set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo No encuentro Google Chrome. Instalalo o edita la linea CHROME de este archivo.
  pause
  exit /b 1
)

set PY=py
where py >nul 2>nul || set PY=python

set FLAGS=--user-data-dir="%~dp0perfil-cmf" --no-first-run --no-default-browser-check --disable-features=CalculateNativeWinOcclusion --disable-renderer-backgrounding --disable-background-timer-throttling --disable-backgrounding-occluded-windows --autoplay-policy=no-user-gesture-required
set T=%RANDOM%%RANDOM%
set URL=http://localhost:8000/Combate_Mortal.html

start "Servidor CMF" cmd /k %PY% -m http.server 8000
timeout /t 3 >nul

start "" "%CHROME%" %FLAGS% --kiosk --app="%URL%?salida=transmision&t=%T%" --window-position=0,0
timeout /t 3 >nul
start "" "%CHROME%" %FLAGS% --kiosk --app="%URL%?salida=reloj&t=%T%" --window-position=0,0
start "" "%CHROME%" %FLAGS% --kiosk --app="%URL%?salida=lateral&lado=a&t=%T%" --window-position=0,0
start "" "%CHROME%" %FLAGS% --kiosk --app="%URL%?salida=lateral&lado=b&t=%T%" --window-position=0,0
rem Pantallas del torneo (bracket, historias, llave): mismo Chrome y perfil, asi se sincronizan con el operador.
rem Para no abrirlas, cambia TORNEO=1 por TORNEO=0.
set TORNEO=1
set URLT=http://localhost:8000/torneo.html?t=%T%
if "%TORNEO%"=="1" start "" "%CHROME%" %FLAGS% --app="%URLT%#bracket" --window-position=60,60 --window-size=1280,800
if "%TORNEO%"=="1" start "" "%CHROME%" %FLAGS% --app="%URLT%#historias" --window-position=120,40 --window-size=560,980
if "%TORNEO%"=="1" start "" "%CHROME%" %FLAGS% --app="%URLT%#llave" --window-position=700,40 --window-size=760,980
timeout /t 4 >nul
start "" "%CHROME%" %FLAGS% --new-window --start-maximized "%URL%?t=%T%"
