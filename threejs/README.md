# 👻 Horror Game 3D - Three.js Engine

## Phase 1: Core Engine ✅

### Status: COMPLETED

Die Three.js Engine wurde erfolgreich migriert von Pygame zu Three.js mit Vite + TypeScript.

### Tech Stack
- **Three.js** r0.170.0 - 3D Rendering
- **Vite** r5.2.0 - Build Tool & Dev Server
- **TypeScript** - Type Safety
- **PointerLockControls** - FPS Camera Controls

### Features Implemented

#### ✅ Core Engine
- [x] Scene Setup mit Fog (Horror Atmosphere)
- [x] Perspective Camera (75° FOV)
- [x] WebGL Renderer mit Shadow Maps
- [x] ACES Filmic Tone Mapping
- [x] Pointer Lock Controls (FPS)

#### ✅ Player Controls
- [x] WASD Movement
- [x] Shift to Sprint
- [x] Mouse Look
- [x] Velocity-based Physics

#### ✅ Lighting
- [x] Ambient Light (dim, horror atmosphere)
- [x] Player Flashlight (SpotLight)
- [x] Atmospheric Point Lights (orange/blue)

#### ✅ Environment
- [x] Ground Plane (PBR Material)
- [x] Procedural Boxes/Walls (placeholders)
- [x] Shadow Casting/Receiving

#### ✅ UI
- [x] Crosshair
- [x] Health Bar
- [x] Sanity Bar
- [x] Location Name
- [x] Scene Selector Menu

### Projektstruktur

```
threejs/
├── src/
│   └── main.ts          # Haupt-Engine Code
├── assets/
│   ├── models/          # 3D Models (GLTF/FBX)
│   └── textures/        # PBR Textures
├── shaders/             # Custom Shader
├── index.html           # HTML Template
├── package.json         # Dependencies
└── vite.config.js       # Vite Configuration
```

### Commands

```bash
# Development
npm run dev

# Production Build
npm run build

# Preview Build
npm run preview
```

### Dev Server
- URL: http://localhost:5173
- Hot Module Replacement: ✅
- Source Maps: ✅

### Nächste Schritte (Phase 2)

1. **3D Character Model** importieren (GLTF)
2. **Ghost Models** mit Animationen
3. **PBR Materialien** für bessere Qualität
4. **Post-Processing** (Bloom, SSAO, Color Grading)
5. **Sound System** (Spatial Audio)

### Debugging

Im Browser Console:
```javascript
// Zugriff auf Engine-Objekte
game.scene    // THREE.Scene
game.camera   // THREE.Camera
game.renderer // THREE.WebGLRenderer
game.controls // PointerLockControls
game.player   // Player State
```

### Performance

- Target: 60 FPS @ 1080p
- Pixel Ratio: capped at 2x
- Shadow Map: PCFSoftShadowMap
- Tone Mapping: ACESFilmic

---

**Created by:** CTO Agent  
**Date:** 2026-04-26  
**Issue:** COR-59
