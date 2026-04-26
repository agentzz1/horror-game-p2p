# Horror Game - UX/UI Dokumentation

## Übersicht

Die UI ist mit **React + Vite** implementiert und bietet eine professionelle, horror-thematische Benutzeroberfläche.

## Komponenten

### 1. Main Menu (`MainMenu.jsx`)
- **Start Game**: Beginnt das Spiel mit Loading Screen → Tutorial
- **Options**: Öffnet das Settings Panel
- **Quit**: Beendet das Spiel (zurück zum Browser)
- **Design**: Roter Glow-Effekt, flicker animation, monospace font

### 2. Settings Panel (`SettingsPanel.jsx`)
Drei Tabs:
- **Graphics**: Quality Slider (0-100%), Shadows ON/OFF, Particles ON/OFF
- **Audio**: Master Volume, Music, SFX (jeweils 0-100%)
- **Controls**: Mouse Sensitivity, Invert Y-Axis, Key Bindings Anzeige

**Features**:
- Einstellungen werden in `localStorage` gespeichert
- Live-Vorschau der Werte
- Save/Cancel Buttons

### 3. Loading Screen (`LoadingScreen.jsx`)
- Progress Bar mit Animation
- Zufällige Horror-Tips (8 verschiedene)
- "Initializing P2P connection..." Hinweis
- Blinkendes "LOADING..." Text

### 4. Tutorial (`Tutorial.jsx`)
5 Schritte:
1. Welcome Intro
2. Movement (WASD/Arrows)
3. Survival (Sprint/Crouch/Interact)
4. Multiplayer Hint
5. Objectives (Keys, Puzzles, Escape)

**Navigation**: Back/Next/Skip Buttons, Step-Indikatoren

### 5. Pause Menu (`PauseMenu.jsx`) ⭐ NEU
- Aktiviert mit ESC-Taste während des Spiels
- Resume, Options, Quit to Menu
- Fade-In Animation
- Blur-Backdrop

### 6. Game Bridge (`GameBridge.jsx`) ⭐ NEU
- Verbindet React UI mit Three.js Game Engine
- Synchronisiert Settings
- Hide/Show UI basierend auf Game-State
- Event-Listener für Game-Events

## Event System

### UI → Game Engine
```javascript
// Start game mit Settings
window.dispatchEvent(new CustomEvent('startGame', { detail: settings }))

// Resume game
window.dispatchEvent(new CustomEvent('resumeGame'))

// Quit game
window.dispatchEvent(new CustomEvent('quitGame'))

// Settings geändert
window.dispatchEvent(new CustomEvent('gameSettingsChanged', { detail: settings }))
```

### Game Engine → UI
```javascript
// Pause toggle (ESC gedrückt)
window.dispatchEvent(new CustomEvent('togglePause'))

// Game ready
window.dispatchEvent(new CustomEvent('gameReady'))

// Game over
window.dispatchEvent(new CustomEvent('gameOver', { detail: result }))
```

## Integration

### Build Process
```bash
cd ui
npm run build
# Kopiere assets nach ../assets/
```

### HTML Integration
```html
<!-- React UI -->
<script type="module" src="assets/index-CMMAqamk.js"></script>

<!-- Game Engine Bridge -->
<script src="game-engine-bridge.js"></script>
```

## Styling

### Farbpalette
- Primary Red: `#8b0000`
- Dark Background: `#0a0a0a`
- Text Gray: `#888`
- Glow Red: `rgba(139, 0, 0, 0.7)`

### Fonts
- `'Courier New', monospace` für konsistenten Retro-Horror-Look

### Animationen
- `flicker`: Hintergrund flackern (4s loop)
- `pulse`: Title pulsieren (2s loop)
- `blink`: Loading text blinken (1s loop)
- `fadeIn`: Pause menu fade-in (0.3s)

## Settings Storage

Einstellungen werden im `localStorage` unter `horrorGameSettings` gespeichert:

```json
{
  "graphics": { "quality": 80, "shadows": true, "particles": true },
  "audio": { "master": 70, "music": 60, "sfx": 80 },
  "controls": { "sensitivity": 50, "invertY": false }
}
```

## Nächste Schritte

1. **Three.js Integration**: Canvas-Rendering an Game-Engine anschließen
2. **Audio System**: Web Audio API für Master/Music/SFX Volume
3. **P2P Multiplayer**: Socket.io Verbindung im Loading Screen anzeigen
4. **Accessibility**: Keyboard-Navigation verbessern, Screen Reader Support

## Dateien

```
ui/
├── src/
│   ├── App.jsx              # Hauptkomponente mit State-Management
│   ├── main.jsx             # React Entry Point
│   ├── index.css            # Globale Styles
│   └── components/
│       ├── MainMenu.jsx     # Hauptmenü
│       ├── SettingsPanel.jsx # Einstellungen
│       ├── LoadingScreen.jsx # Ladebildschirm
│       ├── Tutorial.jsx     # Tutorial
│       ├── PauseMenu.jsx    # Pause-Menü (NEU)
│       └── GameBridge.jsx   # UI/Game Bridge (NEU)
├── dist/                    # Build output
└── package.json
```
