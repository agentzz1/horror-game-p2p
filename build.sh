#!/bin/bash
# Build Horror Game to .exe

echo "🔨 Building Horror Game..."

# Install dependencies
pip install -r requirements.txt

# Build executable
pyinstaller --onefile --windowed --icon=NONE --name="HorrorGame" horror_game.py

echo "✅ Build complete! Executable in dist/HorrorGame.exe"
