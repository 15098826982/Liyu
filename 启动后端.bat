@echo off
chcp 65001 >nul
echo ================================================
echo  Starting CoupleNest backend (local profile)
echo  Press Ctrl+C to stop
echo ================================================
cd /d "%~dp0server"
call mvn spring-boot:run -Dspring-boot.run.profiles=local
pause
