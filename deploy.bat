@echo off
setlocal enabledelayedexpansion

REM LinkedIn Banner Extraction System - Windows Production Deployment Script
REM This script automates the deployment process on Windows

echo.
echo 🚀 LinkedIn Banner Extraction System - Production Deployment
echo ============================================================
echo.

REM Configuration
set "APP_NAME=linkedin-scraper"
set "NODE_VERSION_REQUIRED=18"
set "LOG_DIR=%CD%\logs"

REM Handle script arguments
set "COMMAND=%1"
if "%COMMAND%"=="" set "COMMAND=deploy"

goto %COMMAND% 2>nul || goto unknown_command

:deploy
echo ℹ️  Starting deployment process...
echo.

call :check_node_version
if errorlevel 1 exit /b 1

call :check_npm
if errorlevel 1 exit /b 1

call :create_directories
if errorlevel 1 exit /b 1

call :install_dependencies
if errorlevel 1 exit /b 1

call :install_chrome
if errorlevel 1 exit /b 1

call :setup_environment
if errorlevel 1 exit /b 1

call :test_application
if errorlevel 1 exit /b 1

call :setup_pm2
if errorlevel 1 exit /b 1

echo.
echo ✅ 🎉 Deployment completed successfully!
echo.
echo ℹ️  Application is now running on port 3000
echo ℹ️  Health check: curl http://localhost:3000/health
echo ℹ️  Status check: curl http://localhost:3000/status
echo.
goto :eof

:test
echo ℹ️  Running deployment test...
call :check_node_version
if errorlevel 1 exit /b 1
call :check_npm
if errorlevel 1 exit /b 1
call :test_application
if errorlevel 1 exit /b 1
echo ✅ Test completed successfully
goto :eof

:stop
echo ℹ️  Stopping application...
where pm2 >nul 2>&1
if %errorlevel%==0 (
    pm2 stop %APP_NAME%
    echo ✅ Application stopped via PM2
) else (
    if exist "%LOG_DIR%\app.pid" (
        set /p PID=<"%LOG_DIR%\app.pid"
        taskkill /PID !PID! /F >nul 2>&1
        del "%LOG_DIR%\app.pid" >nul 2>&1
        echo ✅ Application stopped
    ) else (
        echo ⚠️  No PID file found
    )
)
goto :eof

:restart
echo ℹ️  Restarting application...
where pm2 >nul 2>&1
if %errorlevel%==0 (
    pm2 restart %APP_NAME%
    echo ✅ Application restarted via PM2
) else (
    call :stop
    timeout /t 2 >nul
    call :deploy
)
goto :eof

:status
echo ℹ️  Checking application status...
where pm2 >nul 2>&1
if %errorlevel%==0 (
    pm2 status %APP_NAME%
) else (
    if exist "%LOG_DIR%\app.pid" (
        set /p PID=<"%LOG_DIR%\app.pid"
        tasklist /FI "PID eq !PID!" | find "!PID!" >nul
        if !errorlevel!==0 (
            echo ✅ Application is running (PID: !PID!)
        ) else (
            echo ❌ Application is not running
        )
    ) else (
        echo ❌ No PID file found
    )
)
goto :eof

:logs
echo ℹ️  Showing application logs...
where pm2 >nul 2>&1
if %errorlevel%==0 (
    pm2 logs %APP_NAME%
) else (
    if exist "%LOG_DIR%\app.log" (
        type "%LOG_DIR%\app.log"
    ) else (
        echo ❌ No log file found
    )
)
goto :eof

:help
echo Usage: %0 [command]
echo.
echo Commands:
echo   deploy   - Deploy the application (default)
echo   test     - Test deployment without starting
echo   stop     - Stop the application
echo   restart  - Restart the application
echo   status   - Check application status
echo   logs     - Show application logs
echo   help     - Show this help message
echo.
goto :eof

:unknown_command
echo ❌ Unknown command: %1
echo Use '%0 help' for available commands
exit /b 1

REM Helper functions
:check_node_version
echo ℹ️  Checking Node.js version...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed
    echo ℹ️  Please install Node.js %NODE_VERSION_REQUIRED% or higher
    exit /b 1
)

for /f "tokens=1 delims=v" %%i in ('node -v') do set "NODE_VERSION=%%i"
for /f "tokens=1 delims=." %%i in ("%NODE_VERSION:v=%") do set "NODE_MAJOR=%%i"

if %NODE_MAJOR% lss %NODE_VERSION_REQUIRED% (
    echo ❌ Node.js version %NODE_VERSION_REQUIRED% or higher is required
    echo ❌ Current version: %NODE_VERSION%
    exit /b 1
)

echo ✅ Node.js version: %NODE_VERSION%
goto :eof

:check_npm
echo ℹ️  Checking npm...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set "NPM_VERSION=%%i"
echo ✅ npm version: %NPM_VERSION%
goto :eof

:create_directories
echo ℹ️  Creating necessary directories...
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
echo ✅ Directories created
goto :eof

:install_dependencies
echo ℹ️  Installing dependencies...
if exist "package-lock.json" (
    npm ci --only=production
) else (
    npm install --only=production
)
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    exit /b 1
)
echo ✅ Dependencies installed
goto :eof

:install_chrome
echo ℹ️  Installing Chrome for Puppeteer...
npx puppeteer browsers install chrome
if %errorlevel% neq 0 (
    echo ❌ Failed to install Chrome
    exit /b 1
)
echo ✅ Chrome installed for Puppeteer
goto :eof

:setup_environment
echo ℹ️  Setting up environment...
set NODE_ENV=production
set ADAPTIVE_MODE=true
set VERBOSE_LOGGING=false

if not exist ".env" (
    echo NODE_ENV=production > .env
    echo ADAPTIVE_MODE=true >> .env
    echo VERBOSE_LOGGING=false >> .env
    echo PORT=3000 >> .env
    echo ✅ Created .env file
) else (
    echo ℹ️  .env file already exists
)
goto :eof

:test_application
echo ℹ️  Testing application startup...
start /b "" node index.js
timeout /t 10 >nul

REM Simple test - check if port 3000 is listening
netstat -an | find ":3000" | find "LISTENING" >nul
if %errorlevel%==0 (
    echo ✅ Application started successfully
    REM Kill the test instance
    for /f "tokens=5" %%i in ('netstat -ano ^| find ":3000" ^| find "LISTENING"') do taskkill /PID %%i /F >nul 2>&1
) else (
    echo ❌ Application failed to start
    exit /b 1
)
goto :eof

:setup_pm2
where pm2 >nul 2>&1
if %errorlevel%==0 (
    echo ℹ️  Setting up PM2...
    
    REM Stop existing instance if running
    pm2 stop %APP_NAME% >nul 2>&1
    pm2 delete %APP_NAME% >nul 2>&1
    
    REM Start with PM2
    pm2 start index.js --name %APP_NAME% --env production
    
    REM Save PM2 configuration
    pm2 save
    
    echo ✅ PM2 configured and application started
    echo ℹ️  Use 'pm2 status' to check application status
    echo ℹ️  Use 'pm2 logs %APP_NAME%' to view logs
) else (
    echo ⚠️  PM2 not found. Install with: npm install -g pm2
    echo ℹ️  Starting application directly...
    
    REM Start application directly
    start /b "" node index.js > "%LOG_DIR%\app.log" 2>&1
    
    REM Get the PID (this is tricky in batch, so we'll use a workaround)
    timeout /t 2 >nul
    for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV ^| find "node.exe"') do (
        echo %%~i > "%LOG_DIR%\app.pid"
        goto pid_saved
    )
    :pid_saved
    
    echo ✅ Application started in background
    echo ℹ️  PID saved to %LOG_DIR%\app.pid
    echo ℹ️  Logs available at %LOG_DIR%\app.log
)
goto :eof