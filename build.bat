@echo off
pip install pywebview pyinstaller
pyinstaller --onefile --noconsole --name USBMultitool --add-data "src/web;web" src/main.py
echo Built: dist\USBMultitool.exe
