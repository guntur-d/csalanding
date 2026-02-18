@echo off
echo Adding all files to staging...
git add .

echo.
set /p commit_msg="Enter commit message: "
if "%commit_msg%"=="" (
    echo No commit message provided. Aborting.
    pause
    exit /b 1
)

echo.
echo Committing with message: "%commit_msg%"
git commit -m "%commit_msg%"

echo.
echo Pushing to origin main...
git push origin main

echo.
echo Push completed successfully!
pause