@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion  REM 启用延迟环境变量扩展
echo === 在线考试系统启动脚本 ===
echo 正在启动考试系统...

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo 未找到Python环境，准备安装...
    
    set EXPECTED_VERSION=3.10
    set PYTHON_INSTALLER=python-3.13.5-amd64.exe
    set PYTHON_DIR=Python310
    
    REM 检查目录中是否存在安装程序 - 使用延迟扩展
    if exist "!PYTHON_INSTALLER!" (
        echo 找到安装程序: !PYTHON_INSTALLER!
        echo 开始安装Python 3.13.5...
        set EXPECTED_VERSION=3.13.5
        set PYTHON_DIR=Python313
        start /wait !PYTHON_INSTALLER! /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
    ) else (
        echo 未找到本地安装程序，准备在线下载Python !EXPECTED_VERSION!...
        
        REM 创建临时目录
        if not exist "temp" mkdir temp
        
        REM 使用PowerShell下载文件
        powershell -Command "$webclient = New-Object System.Net.WebClient; $url='https://www.python.org/ftp/python/3.10.0/python-3.10.0-amd64.exe'; $file='temp\python-3.10.0-amd64.exe'; $webclient.DownloadFile($url, $file)"
        
        REM 检查下载是否成功
        if exist "temp\python-3.10.0-amd64.exe" (
            echo 下载完成，开始安装...
            start /wait temp\python-3.10.0-amd64.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
            REM 删除临时文件
            rmdir /S /Q temp
        ) else (
            echo 错误: Python安装程序下载失败，请检查网络连接
            pause
            exit /b 1
        )
    )
    
    REM 刷新环境变量
    echo 刷新环境变量...
    powershell -Command "$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')"
    
    REM 再次检查Python是否安装成功，并验证版本
    echo 验证Python安装...
    for /f "tokens=2" %%v in ('python --version 2^>^&1') do set INSTALLED_VERSION=%%v
    
    echo 已安装版本: !INSTALLED_VERSION!
    echo 预期版本: !EXPECTED_VERSION!
    
    REM 检查版本是否包含预期的主版本号
    echo !INSTALLED_VERSION! | findstr /C:"!EXPECTED_VERSION:~0,3!" > nul
    if errorlevel 1 (
        echo 错误: 安装的Python版本不正确。
        echo 预期: !EXPECTED_VERSION!，实际安装: !INSTALLED_VERSION!
        echo 请检查PATH环境变量是否正确配置。
        pause
        exit /b 1
    ) else (
        echo Python !INSTALLED_VERSION! 安装成功！
    )
) else (
    echo 已检测到Python环境
    for /f "tokens=2" %%v in ('python --version 2^>^&1') do set INSTALLED_VERSION=%%v
    echo 当前Python版本: !INSTALLED_VERSION!
)

REM 进入项目目录
cd /d "%~dp0"

REM 检查虚拟环境是否存在
if not exist "venv" (
    echo 正在创建Python虚拟环境...
    python -m venv venv
)

REM 激活虚拟环境

echo 激活虚拟环境...
call venv\Scripts\activate.bat

REM 安装依赖
echo 安装依赖...
pip install -r requirements.txt || (
    echo 错误: 安装依赖失败。请检查 requirements.txt 或网络连接。
    pause
    exit /b 1
)

REM 设置 Flask 环境变量
set FLASK_APP=src/main.py
set FLASK_ENV=development

REM 启动 Flask 应用
echo 启动 Flask 应用...
flask run --host=0.0.0.0 --port=5000 || (
    echo 错误: Flask 应用启动失败。请检查日志。
    pause
    exit /b 1
)

pause