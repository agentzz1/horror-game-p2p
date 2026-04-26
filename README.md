# 👻 Horror Game - P2P Multiplayer (Phase 5)

Ein Triple-A Horror-Spiel mit WebRTC P2P-Multiplayer-Funktionalität.

## Features
- 🎮 Singleplayer Modus
- 🌐 **WebRTC P2P Multiplayer** (Low-Latency Data Channels)
- 👑 **Host-Migration** bei Disconnect (kein Game-Break)
- 🎯 **State Interpolation/Extrapolation** für smooth movement
- 🛡️ **Anti-Cheat Basics** (Speed Detection, Bounds Check)
- 👻 Gruselige Geister mit KI
- 😱 Jump Scares
- 💻 Cross-platform (Windows, Mac, Linux)
- 🌧️ Wetter-Effekte (Regen, Nebel, Staubpartikel)
- ✨ Post-Processing (SSAO, Bloom, Color Grading)

## Installation

### Voraussetzungen
- Node.js 16+ (für Signaling Server)
- Moderner Browser mit WebRTC Support (Chrome, Firefox, Edge)

### Schnellstart

**1. Signaling Server starten:**
```bash
npm install express socket.io
node server.js
```

Der Server läuft auf `http://localhost:3000`

**2. Spiel im Browser öffnen:**
```bash
# Option A: Direkt öffnen
open index.html

# Option B: Local Server (empfohlen)
npx serve .
# Dann: http://localhost:3000 oder http://DEINE-IP:3000
```

## Multiplayer Nutzung

### Host sein:
1. Spiel im Browser öffnen
2. Auf "Create Room" klicken
3. Room ID notieren (z.B. `a3f8b2c1`)
4. Freunden die Room ID + deine IP geben

### Joinen:
1. Spiel im Browser öffnen
2. Auf "Join Room" klicken
3. Room ID eingeben
4. Verbinden!

### Netzwerk-Architektur:
- **Signaling**: Socket.IO über Port 3000
- **P2P Daten**: WebRTC Data Channels (direkt zwischen Clients)
- **State Updates**: 50ms Interval (20x pro Sekunde)
- **Interpolation**: 100ms Delay für smooth rendering
- **Host Migration**: Automatisch bei Host-Disconnect

## Anti-Cheat Features

- **Speed Hack Detection**: Max 15 Einheiten/Sekunde
- **Bounds Check**: Spieler bleibt im definierten Bereich
- **Rate Limiting**: Max 30 Messages/Sekunde pro Client
- **Server-Side Validation**: Ungültige States werden verworfen

## Tech Stack

- **Rendering**: Three.js mit Post-Processing
- **P2P**: Simple-Peer (WebRTC Wrapper)
- **Signaling**: Socket.IO
- **Physics**: Custom (einfache Kollisionen)
- **UI**: Vanilla JS + Canvas für Labels

## Performance

- **Target**: 60 FPS bei 2-4 Players
- **Network**: <100ms Latenz (P2P direkt)
- **Interpolation**: Smooth auch bei 200ms Packet Loss

## Troubleshooting

**"Peer connection failed"**: 
- Firewall prüfen (WebRTC Ports)
- STUN Server erreichbar? (stun.l.google.com:19302)

**"Room not found"**: 
- Host muss zuerst Room erstellen
- Room ID korrekt kopiert?

**"Laggy movement"**: 
- INTERPOLATION_DELAY_MS in network.js anpassen (default: 100ms)
- Bei schlechtem Netz: auf 150-200ms erhöhen

---

Viel Spaß beim Gruseln! 🎃
