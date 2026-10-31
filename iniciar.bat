@echo off
rem ============================================================================
rem  COMBATE MORTAL FREESTYLE - arranque de todo con un doble clic
rem  Abre el servidor y todas las ventanas SIN pantalla completa: transmision (para OBS),
rem  pantallas LED (lateral A, reloj, lateral B) de 640x1024, las del torneo (torneo.html)
rem  y por ultimo el operador. Cada pagina se coloca sola con ?pos= y ?tam= de su direccion.
rem  OPERADOR=pantallas (lo normal ahora): el operador ya trae las 3 pantallas LED dentro
rem  (MC A / reloj / MC B, 640x1024 cada una, arriba a la izquierda). Esa ventana va al procesador LED:
rem  mide 1920x1024 (las 3 pantallas a tamano real); en la salida de 1920 al procesador, un clic = pantalla completa.
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

rem Comprobar que estan los archivos del bracket nuevo junto a este archivo (si no, el torneo sale con el bracket viejo).
set FALTA=
if not exist "%~dp0Combate_Mortal.html" set FALTA=Combate_Mortal.html
if not exist "%~dp0pantallas.html" set FALTA=pantallas.html
if not exist "%~dp0js\torneo-vistas.js" set FALTA=js\torneo-vistas.js
if not exist "%~dp0css\torneo-vistas.css" set FALTA=css\torneo-vistas.css
if not exist "%~dp0assets\torneo\fondo-bracket.jpg" set FALTA=assets\torneo
if not exist "%~dp0assets\participantes\r16.jpg" set FALTA=assets\participantes
if defined FALTA (
  echo.
  echo FALTA: %FALTA%
  echo Copia TODO el contenido del ZIP ^(Combate_Mortal.html, torneo.html, assets, css, js^) en esta carpeta:
  echo %~dp0
  pause
  exit /b 1
)

rem Liberar el puerto 8000: cierra cualquier servidor viejo (por ejemplo uno abierto a mano en PowerShell),
rem que si no seguiria sirviendo los archivos de otra carpeta.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":8000 .*LISTENING"') do taskkill /F /PID %%p >nul 2>nul
taskkill /FI "WINDOWTITLE eq Servidor CMF*" /T /F >nul 2>nul

set PY=py
where py >nul 2>nul || set PY=python

set FLAGS=--user-data-dir="%~dp0perfil-cmf" --no-first-run --no-default-browser-check --disable-features=CalculateNativeWinOcclusion --disable-renderer-backgrounding --disable-background-timer-throttling --disable-backgrounding-occluded-windows --autoplay-policy=no-user-gesture-required
set T=%RANDOM%%RANDOM%
set URL=http://localhost:8000/Combate_Mortal.html

start "Servidor CMF" cmd /k %PY% -m http.server 8000
timeout /t 3 >nul

rem Transmision (para OBS): contenido de 1920x1080 exactos. Si el monitor es de 1920x1080 no cabe con la barra de titulo:
rem haz clic dentro de esa ventana y pasa a pantalla completa (1920x1080).
start "" "%CHROME%" %FLAGS% --app="%URL%?salida=transmision&pos=0,0&tam=1920x1080&t=%T%" --window-position=0,0 --window-size=1920,1080
timeout /t 3 >nul
rem Operador:
rem   OPERADOR=pantallas  el contador del operador sale como 3 columnas de 640x1024 (MC A / reloj / MC B)
rem                       desde la esquina de arriba a la izquierda; en el torneo, el bracket vertical en la del centro
rem                       (V: bracket horizontal en las 3).
rem                       Esa misma ventana va al procesador LED (F11). Abajo (y 1024 a 1080) quedan los botones del operador.
rem   OPERADOR=normal     el operador de siempre (las pantallas LED van en ventanas aparte, ver LED).
set OPERADOR=pantallas
rem Pantallas LED en ventanas aparte (MC A, reloj, MC B), cada una de 640x1024:
rem   LED=auto       ninguna si OPERADOR=pantallas (ya van en el operador); si no, muro.
rem   LED=muro       una sola ventana de 1920x1024 con las tres en columnas (pantallas.html), para un procesador
rem                  que recibe UNA imagen y la reparte. En el evento: llevarla a esa salida y pulsar F11.
rem   LED=separadas  tres ventanas de 640x1024 (una por salida de video).
rem   LED=ninguna    no abrir pantallas LED aparte.
set LED=auto
if "%LED%"=="auto" if "%OPERADOR%"=="pantallas" set LED=ninguna
if "%LED%"=="auto" set LED=muro
if "%LED%"=="muro" start "" "%CHROME%" %FLAGS% --app="http://localhost:8000/pantallas.html?pos=0,0&tam=1920x1024&t=%T%" --window-position=0,0 --window-size=1920,1024
if "%LED%"=="separadas" start "" "%CHROME%" %FLAGS% --app="%URL%?salida=reloj&pos=640,0&tam=640x1024&t=%T%" --window-position=640,0 --window-size=640,1024
if "%LED%"=="separadas" start "" "%CHROME%" %FLAGS% --app="%URL%?salida=lateral&lado=a&pos=0,0&tam=640x1024&t=%T%" --window-position=0,0 --window-size=640,1024
if "%LED%"=="separadas" start "" "%CHROME%" %FLAGS% --app="%URL%?salida=lateral&lado=b&pos=1280,0&tam=640x1024&t=%T%" --window-position=1280,0 --window-size=640,1024
rem Pantallas del torneo (bracket, historias, llave): mismo Chrome y perfil, asi se sincronizan con el operador.
rem Para no abrirlas, cambia TORNEO=1 por TORNEO=0.
set TORNEO=1
set URLT=http://localhost:8000/torneo.html?t=%T%
if "%TORNEO%"=="1" start "" "%CHROME%" %FLAGS% --app="%URLT%&pos=320,0&tam=640x1024#bracket" --window-position=320,0 --window-size=640,1024
if "%TORNEO%"=="1" start "" "%CHROME%" %FLAGS% --app="%URLT%&pos=120,40&tam=540x960#historias" --window-position=120,40 --window-size=560,980
if "%TORNEO%"=="1" start "" "%CHROME%" %FLAGS% --app="%URLT%&pos=700,40&tam=720x900#llave" --window-position=700,40 --window-size=760,980
set "URLOP=%URL%?t=%T%"
if "%OPERADOR%"=="pantallas" set "URLOP=%URL%?pantallas=1&pos=0,0&tam=1920x1024&t=%T%"
timeout /t 4 >nul
rem Operador en 3 pantallas: ventana de aplicacion (sin pestanas ni barra de direccion) de 1920x1024 exactos en 0,0:
rem solo las tres pantallas de 640x1024, a tamano real. En una salida de 1920 de ancho (procesador LED) el primer clic
rem la pone en pantalla completa (mantener Esc para salir).
if "%OPERADOR%"=="pantallas" start "" "%CHROME%" %FLAGS% --app="%URLOP%" --window-position=0,0 --window-size=1920,1024
if not "%OPERADOR%"=="pantallas" start "" "%CHROME%" %FLAGS% --new-window --start-maximized "%URLOP%"
