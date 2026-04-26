# 👻 Horror Game 3D - Triple-A Edition

## Phase 3: Environment Design ✅

### Features implementiert:

#### 🎨 3D Level Design
- **Verlassenes Haus**: Vollständiges Gebäude mit Dach, Türen (interaktiv), Fenstern
- **Alter Friedhof**: 30+ Grabsteine, großes Kreuz, unheimliche Atmosphäre
- **Dunkler Wald**: 50+ procedurale Bäume mit Stämmen und Kronen

#### 💡 Beleuchtung & Post-Processing
- **Ambient Occlusion (SSAO)**: Realistische Schatten in Ecken
- **Screen Space Reflections**: Reflexionen auf Oberflächen
- **Dynamische Point Lights**: Flackernde Laternen für Horror-Atmosphäre
- **Spotlights**: Dramatische Lichteffekte
- **ACES Filmic Tone Mapping**: Kino-Qualität Farbwiedergabe

#### 🌧️ Wetter-Effekte
- **Regen-Partikelsystem**: 15.000 Partikel mit realistischer Physik
- **Volumetrischer Nebel**: FogExp2 mit szenen-spezifischer Dichte
- **Dynamische Intensität**: Wetter reagiert auf Sanity-Level

#### 👻 Gegner
- **5 Geister**: Schwebende KI mit zufälligen Bewegungsmustern
- **Emissive Materialien**: Unheimliches Leuchten
- **Jumpscare-Mechanik**: Bei zu geringer Distanz zum Spieler

#### 🎮 Gameplay
- **FPS Controls**: WASD + Maus (Pointer Lock)
- **Sprint**: SHIFT für schnelleres Laufen
- **Interaktion**: E-Taste für Türen
- **Sanity System**: Psychische Gesundheit nimmt über Zeit ab
- **Health System**: 20 Schaden bei Jumpscare

### Tech Stack
- **Three.js r160**: Modernes WebGL Rendering
- **ES6 Modules**: Importmap für CDN Dependencies
- **EffectComposer**: Post-Processing Pipeline
- **Procedural Generation**: Terrain Noise, Baum-Positionierung

### Starten

```bash
# Option 1: Python HTTP Server
python3 -m http.server 8000

# Option 2: Node.js http-server
npx http-server -p 8000

# Dann im Browser: http://localhost:8000
```

### Steuerung
| Taste | Aktion |
|-------|--------|
| W/A/S/D | Bewegen |
| Maus | Umsehen |
| SHIFT | Rennen |
| E | Interagieren (Türen) |
| ESC | Pause / Maus freigeben |

### Szene wechseln
Oben rechts Buttons für:
- 🏚️ Haus
- ⚰️ Friedhof
- 🌲 Wald

### Nächste Schritte (Phase 4+)
- [ ] Multiplayer P2P (WebRTC)
- [ ] Sound Effects & Ambient Music
- [ ] Mehr Interactables (Schatzkisten, Noten)
- [ ] Story Elements (Texte, Hinweise)
- [ ] Inventory System
- [ ] Save/Load System

---

**Repo**: https://github.com/agentzz1/horror-game-p2p  
**Autor**: UXDesigner @ Paperclip  
**Status**: Phase 3 abgeschlossen ✅
