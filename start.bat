@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "StudyPlanner.exe" (
  StudyPlanner.exe
  pause
  exit /b
)
py -3 -c "import sys;sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
if not errorlevel 1 (
  py -3 server.py
  pause
  exit /b
)
python -c "import sys;sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
if not errorlevel 1 (
  python server.py
  pause
  exit /b
)
echo 未找到 Python 3.10 或更高版本。
echo 普通用户请下载 Windows 使用版；运行源码请先安装 Python。
pause
