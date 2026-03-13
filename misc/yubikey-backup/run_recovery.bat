@echo off
setlocal EnableDelayedExpansion

REM YubiKey PKCS11 Decryption Wrapper (Windows)
REM
REM This script wraps pkcs11-tool to decrypt data using a YubiKey hardware token.
REM It's designed to be called by the Fordefi recovery-tool as a decrypt command.

REM Validate PIN argument
if "%~1"=="" (
    echo Error: PIN required as first argument >&2
    exit /b 1
)

set "PIN=%~1"

REM Validate PIN format (6-8 characters)
set "PIN_LEN=0"
for /L %%A in (0,1,256) do (
    if "!PIN:~%%A,1!" NEQ "" set /A PIN_LEN+=1
)
if !PIN_LEN! LSS 6 (
    echo Error: PIN must be 6-8 characters >&2
    exit /b 1
)
if !PIN_LEN! GTR 8 (
    echo Error: PIN must be 6-8 characters >&2
    exit /b 1
)

goto :valid_pin

echo Error: PIN must be 6-8 characters >&2
exit /b 1

:valid_pin
REM Create temporary files for stdin/stdout
set "TEMP_IN=%TEMP%\yubikey_input_%RANDOM%.bin"
set "TEMP_OUT=%TEMP%\yubikey_output_%RANDOM%.bin"
set "TEMP_STDERR=%TEMP%\yubikey_stderr_%RANDOM%.txt"
set "TEMP_STDOUT=%TEMP%\yubikey_stdout_%RANDOM%.txt"

REM Read binary stdin to temp file using PowerShell
powershell -NoProfile -Command "$stream = [System.Console]::OpenStandardInput(); $ms = New-Object System.IO.MemoryStream; $stream.CopyTo($ms); [System.IO.File]::WriteAllBytes('%TEMP_IN%', $ms.ToArray())"

REM Run pkcs11-tool
set "PKCS11_MODULE=C:\Program Files\Yubico\Yubico PIV Tool\bin\libykcs11.dll"
set "PKCS11_TOOL=C:\Program Files\OpenSC Project\OpenSC\tools\pkcs11-tool.exe"

"%PKCS11_TOOL%" --module "%PKCS11_MODULE%" --decrypt --id 03 --mechanism RSA-PKCS-OAEP --pin %PIN% --input-file "%TEMP_IN%" --output-file "%TEMP_OUT%" --hash-algorithm SHA256 --mgf MGF1-SHA256 2>"%TEMP_STDERR%" >"%TEMP_STDOUT%"

REM Capture exit code
set EXIT_CODE=%ERRORLEVEL%

REM Output the decrypted result to stdout
powershell -NoProfile -Command "$bytes = [System.IO.File]::ReadAllBytes('%TEMP_OUT%'); [System.Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length)"

REM Cleanup
del /f /q "%TEMP_IN%" "%TEMP_OUT%" "%TEMP_STDERR%" "%TEMP_STDOUT%" 2>nul

endlocal
exit /b %EXIT_CODE%
