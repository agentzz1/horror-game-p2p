@echo off
echo Building Horror Game...
pip install -r requirements.txt
pyinstaller --onefile --windowed --name="HorrorGame" horror_game.py
echo Build complete! Check dist folder for HorrorGame.exe
pause
