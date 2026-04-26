/**
 * Game Engine Bridge
 * Verbindet React UI mit der Three.js/JavaScript Game Engine
 */

class GameEngine {
  constructor() {
    this.settings = {
      graphics: { quality: 80, shadows: true, particles: true },
      audio: { master: 70, music: 60, sfx: 80 },
      controls: { sensitivity: 50, invertY: false }
    }
    this.isPaused = false
    this.isPlaying = false
    
    this.initEventListeners()
  }

  initEventListeners() {
    // Listen for UI events
    window.addEventListener('startGame', (e) => {
      console.log('[GameEngine] Starting game with settings:', e.detail)
      this.settings = e.detail
      this.start()
    })

    window.addEventListener('resumeGame', () => {
      console.log('[GameEngine] Resuming game')
      this.resume()
    })

    window.addEventListener('quitGame', () => {
      console.log('[GameEngine] Quitting game')
      this.stop()
    })

    window.addEventListener('gameSettingsChanged', (e) => {
      console.log('[GameEngine] Settings updated:', e.detail)
      this.applySettings(e.detail)
    })

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isPlaying) {
        this.togglePause()
      }
    })
  }

  applySettings(newSettings) {
    this.settings = newSettings
    
    // Apply graphics settings
    if (newSettings.graphics) {
      this.updateGraphicsSettings(newSettings.graphics)
    }
    
    // Apply audio settings
    if (newSettings.audio) {
      this.updateAudioSettings(newSettings.audio)
    }
    
    // Apply control settings
    if (newSettings.controls) {
      this.updateControlSettings(newSettings.controls)
    }
  }

  updateGraphicsSettings(graphics) {
    console.log('[GameEngine] Graphics settings:', graphics)
    // TODO: Apply to Three.js renderer
    // - quality -> render scale
    // - shadows -> shadowMap.enabled
    // - particles -> particle system toggle
  }

  updateAudioSettings(audio) {
    console.log('[GameEngine] Audio settings:', audio)
    // TODO: Apply to Web Audio API
    // - master -> master gain
    // - music -> music track volume
    // - sfx -> sfx volume
  }

  updateControlSettings(controls) {
    console.log('[GameEngine] Control settings:', controls)
    // TODO: Apply to input handler
    // - sensitivity -> mouse look speed
    // - invertY -> invert vertical look
  }

  start() {
    this.isPlaying = true
    this.isPaused = false
    console.log('[GameEngine] Game started')
    // TODO: Initialize Three.js scene, camera, renderer
  }

  stop() {
    this.isPlaying = false
    this.isPaused = false
    console.log('[GameEngine] Game stopped')
    // TODO: Clean up Three.js resources
  }

  togglePause() {
    this.isPaused = !this.isPaused
    console.log('[GameEngine] Pause toggled:', this.isPaused)
    
    // Notify UI
    window.dispatchEvent(new CustomEvent('togglePause'))
    
    if (this.isPaused) {
      // Pause game logic
    } else {
      // Resume game logic
    }
  }

  resume() {
    this.isPaused = false
    console.log('[GameEngine] Game resumed')
  }

  pause() {
    this.isPaused = true
    console.log('[GameEngine] Game paused')
    window.dispatchEvent(new CustomEvent('togglePause'))
  }
}

// Initialize global game engine
window.gameEngine = new GameEngine()

console.log('[GameEngine] Initialized')
