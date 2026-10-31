@echo off
rem ============================================================================
rem  COMBATE MORTAL FREESTYLE - arranque de todo con un doble clic
rem  Abre el servidor y todas las ventanas SIN pantalla completa: transmision (para OBS),
rem  pantallas LED (lateral A, reloj, lateral B) de 640x1024, las del torneo (torneo.html)
rem  y por ultimo el operador. Cada pagina se coloca sola con ?pos= y ?tam= de su direccion.
rem  No usar --kiosk: como todas comparten el mismo Chrome, pondria TODAS en pantalla completa.
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

start "" "%CHROME%" %FLAGS% --app="%URL%?salida=transmision&pos=0,0&tam=1600x900&t=%T%" --window-position=0,0 --window-size=1600,900
timeout /t 3 >nul
start "" "%CHROME%" %FLAGS% --app="%URL%?salida=reloj&pos=640,0&tam=640x1024&t=%T%" --window-position=640,0 --window-size=640,1024
start "" "%CHROME%" %FLAGS% --app="%URL%?salida=lateral&lado=a&pos=0,0&tam=640x1024&t=%T%" --window-position=0,0 --window-size=640,1024
start "" "%CHROME%" %FLAGS% --app="%URL%?salida=lateral&lado=b&pos=1280,0&tam=640x1024&t=%T%" --window-position=1280,0 --window-size=640,1024
rem Pantallas del torneo (bracket, historias, llave): mismo Chrome y perfil, asi se sincronizan con el operador.
rem Para no abrirlas, cambia TORNEO=1 por TORNEO=0.
set TORNEO=1
set URLT=http://localhost:8000/torneo.html?t=%T%
if "%TORNEO%"=="1" start "" "%CHROME%" %FLAGS% --app="%URLT%&pos=320,0&tam=640x1024#bracket" --window-position=320,0 --window-size=640,1024
if "%TORNEO%"=="1" start "" "%CHROME%" %FLAGS% --app="%URLT%&pos=120,40&tam=540x960#historias" --window-position=120,40 --window-size=560,980
if "%TORNEO%"=="1" start "" "%CHROME%" %FLAGS% --app="%URLT%&pos=700,40&tam=720x900#llave" --window-position=700,40 --window-size=760,980
timeout /t 4 >nul
start "" "%CHROME%" %FLAGS% --new-window --start-maximized "%URL%?t=%T%"
