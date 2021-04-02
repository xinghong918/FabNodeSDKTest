<!-- : Begin batch script
@echo off
setlocal

set argC=0
for %%x in (%*) do Set /A argC+=1

if "%argC%" GEQ "2" (
  goto :usage
  exit /B %errorlevel%
)

set NPM_GLOBAL=0
set NPM_PACKAGE=fabric-client
set NPM_CA_PACKAGE=fabric-ca-client
set NPM_PACKAGE_VER=@1.4.10

if "%argC%" == "1" (
  set ARG=%1
  call :check_arg
  if errorlevel 1 (
    exit /B %errorlevel%
  )
)
echo "IMPORTANT: Due to https://github.com/nodejs/node/issues/4932, to build grpc-node on Windows, you must first remove (node_root_dir)/include/node/openssl/. Please do that before you continue."
pause

for /f %%i in ('npm root -g') do set NPM_GLOBAL_ROOT=%%i
if "%NPM_GLOBAL%" == "1" (
  call npm install -g --ignore-scripts log4js@5.1.0
  call npm install -g --ignore-scripts %NPM_PACKAGE%%NPM_PACKAGE_VER%
  call npm install -g --ignore-scripts %NPM_CA_PACKAGE%%NPM_PACKAGE_VER%
  if "%NPM_PACKAGE%" == "fabric-client" (
    set ARG=.\node_modules\grpc\binding.gyp
    call :do_replace_code 
  )
  cd %NPM_GLOBAL_ROOT%\%NPM_PACKAGE%
  call npm rebuild --unsafe-perm --build-from-source --grpc_alpn=false
) else (
  call npm install --ignore-scripts log4js@5.1.0
  call npm install --ignore-scripts %NPM_PACKAGE%%NPM_PACKAGE_VER%
  call npm install --ignore-scripts %NPM_CA_PACKAGE%%NPM_PACKAGE_VER%
  if "%NPM_PACKAGE%" == "fabric-client" (
    set ARG=.\node_modules\grpc\binding.gyp
    call :do_replace_code 
  )
  call npm rebuild --unsafe-perm --build-from-source --grpc_alpn=false
)
call npm install
cmd
rem exit /B 0

:usage
  echo "Usage: %~nx0 [-g]"
  exit /B 1

:check_arg
  if  "%ARG%" == "-g" (
    set NPM_GLOBAL=1
  ) else (
    goto :usage
  )
  exit /B 0

:do_replace_code
  set filename="%ARG%"
  call copy %filename% %filename%.ori
  set toReplace="'_WIN32_WINNT=0x0600'"
  set replaceWith="'_WIN32_WINNT=0x0600','TSI_OPENSSL_ALPN_SUPPORT=0'"
  call :replace_in_file
  exit /B 0

:replace_in_file
cscript //nologo "%~f0?.wsf" %filename% %toReplace% %replaceWith%
exit /b

----- Begin wsf script --->
<job><script language="VBScript">
  Const ForReading = 1
  Const ForWriting = 2

  strFileName = Wscript.Arguments(0)
  strOldText = Wscript.Arguments(1)
  strNewText = Wscript.Arguments(2)

  Set objFSO = CreateObject("Scripting.FileSystemObject")
  Set objFile = objFSO.OpenTextFile(strFileName, ForReading)

  strText = objFile.ReadAll
  objFile.Close
  strNewText = Replace(strText, strOldText, strNewText)

  Set objFile = objFSO.OpenTextFile(strFileName, ForWriting)
  objFile.Write strNewText
  objFile.Close
</script></job>

