# 👻 Horror Game - P2P Multiplayer

Ein einfaches Horror-Spiel mit P2P-Multiplayer-Funktionalität.

## Features
- 🎮 Singleplayer Modus
- 🌐 P2P Multiplayer (Host/Client)
- 👻 Gruselige Geister
- 😱 Jump Scares
- 💻 Cross-platform (Windows, Mac, Linux)

## Installation

### Voraussetzungen
- Python 3.8+
- pygame
- pyinstaller (für .exe Build)

### Schnellstart
```bash
pip install -r requirements.txt
python horror_game.py
```

## Spielmodi

1. **Singleplayer**: Solo gegen die Geister
2. **Host**: Erstelle einen P2P-Server für Freunde
3. **Join**: Verbinde dich mit einem Host

## Als .exe compilieren (Windows)

```bash
# Installiere Dependencies
pip install pygame pyinstaller

# Build
pyinstaller --onefile --windowed --name="HorrorGame" horror_game.py
```

Die `HorrorGame.exe` befindet sich im `dist/` Ordner.

## Für deine Jungs spielen

1. Host erstellt das Spiel (Modus 2)
2. Host teilt seine lokale IP (z.B. 192.168.0.XXX)
3. Freunde wählen Modus 3 und geben die IP ein
4. Together gegen die Geister kämpfen! 👻

## GitHub Release

1. Repository erstellen
2. Code hochladen
3. Releases Tab → New Release
4. `dist/HorrorGame.exe` als Asset hochladen

---

Viel Spaß beim Gruseln! 🎃
