import { useEffect } from 'react'

/**
 * GameBridge - Verbindet React UI mit dem Three.js/Canvas Spiel
 * 
 * Diese Komponente:
 * - Versteckt die UI wenn das Spiel startet
 * - Zeigt die UI im Pause-Modus
 * - Synchronisiert Settings mit dem Game-Engine
 */
function GameBridge({ settings, isPlaying, onGameReady }) {
  useEffect(() => {
    // Apply settings to game engine
    if (window.gameEngine) {
      window.gameEngine.applySettings(settings)
    }
    
    // Dispatch custom event for game to listen
    const event = new CustomEvent('gameSettingsChanged', {
      detail: settings
    })
    window.dispatchEvent(event)
  }, [settings])

  useEffect(() => {
    // Show/hide UI based on game state
    const rootEl = document.getElementById('root')
    const canvasEl = document.querySelector('canvas')
    
    if (isPlaying) {
      if (rootEl) rootEl.style.display = 'none'
      if (canvasEl) canvasEl.style.display = 'block'
    } else {
      if (rootEl) rootEl.style.display = 'block'
      if (canvasEl) canvasEl.style.display = 'none'
    }
  }, [isPlaying])

  useEffect(() => {
    // Listen for game events
    const handleGameReady = () => {
      console.log('[GameBridge] Game engine ready')
      if (onGameReady) onGameReady()
    }

    const handleGamePause = () => {
      console.log('[GameBridge] Game paused')
      // Could show pause menu here
    }

    const handleGameOver = (result) => {
      console.log('[GameBridge] Game over:', result)
      // Return to main menu with results
    }

    window.addEventListener('gameReady', handleGameReady)
    window.addEventListener('gamePause', handleGamePause)
    window.addEventListener('gameOver', handleGameOver)

    return () => {
      window.removeEventListener('gameReady', handleGameReady)
      window.removeEventListener('gamePause', handleGamePause)
      window.removeEventListener('gameOver', handleGameOver)
    }
  }, [onGameReady])

  return null // This is a logic-only component
}

export default GameBridge
