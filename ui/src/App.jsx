import { useState, useEffect } from 'react'
import MainMenu from './components/MainMenu'
import SettingsPanel from './components/SettingsPanel'
import LoadingScreen from './components/LoadingScreen'
import Tutorial from './components/Tutorial'
import PauseMenu from './components/PauseMenu'
import GameBridge from './components/GameBridge'

function App() {
  const [currentScreen, setCurrentScreen] = useState('menu')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [settings, setSettings] = useState({
    graphics: { quality: 80, shadows: true, particles: true },
    audio: { master: 70, music: 60, sfx: 80 },
    controls: { sensitivity: 50, invertY: false }
  })
  const [isLoading, setIsLoading] = useState(false)

  // Listen for pause events from game
  useEffect(() => {
    const handlePauseToggle = () => {
      if (isPlaying) {
        setIsPaused(prev => !prev)
      }
    }

    window.addEventListener('togglePause', handlePauseToggle)
    return () => window.removeEventListener('togglePause', handlePauseToggle)
  }, [isPlaying])

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('horrorGameSettings')
    if (saved) {
      setSettings(JSON.parse(saved))
    }
  }, [])

  // Save settings
  const saveSettings = (newSettings) => {
    setSettings(newSettings)
    localStorage.setItem('horrorGameSettings', JSON.stringify(newSettings))
  }

  const startGame = () => {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setIsPlaying(true)
      setCurrentScreen('tutorial')
    }, 3000)
  }

  const completeTutorial = () => {
    setCurrentScreen('game')
    // Signal game engine to start
    window.dispatchEvent(new CustomEvent('startGame', { detail: settings }))
    console.log('Launching game...')
  }

  const resumeGame = () => {
    setIsPaused(false)
    window.dispatchEvent(new CustomEvent('resumeGame'))
  }

  const quitToMenu = () => {
    setIsPlaying(false)
    setIsPaused(false)
    setCurrentScreen('menu')
    window.dispatchEvent(new CustomEvent('quitGame'))
  }

  const goToMenu = () => {
    setCurrentScreen('menu')
  }

  return (
    <div className="app">
      {/* Game Bridge - handles UI/Game synchronization */}
      <GameBridge 
        settings={settings}
        isPlaying={isPlaying}
      />

      {/* Loading Screen */}
      {isLoading && <LoadingScreen />}
      
      {/* Pause Menu - shown when game is paused */}
      {isPaused && (
        <PauseMenu
          onResume={resumeGame}
          onSettings={() => {}}
          onQuitToMenu={quitToMenu}
        />
      )}

      {/* Main Menu */}
      {currentScreen === 'menu' && !isPlaying && (
        <MainMenu 
          onStart={startGame}
          onSettings={() => setCurrentScreen('settings')}
          onQuit={quitToMenu}
        />
      )}

      {/* Settings Panel */}
      {currentScreen === 'settings' && (
        <SettingsPanel 
          settings={settings}
          onSave={saveSettings}
          onClose={goToMenu}
        />
      )}

      {/* Tutorial */}
      {currentScreen === 'tutorial' && (
        <Tutorial onComplete={completeTutorial} onSkip={completeTutorial} />
      )}

      {/* Game Canvas Container */}
      {currentScreen === 'game' && isPlaying && (
        <div id="game-container" style={{ width: '100vw', height: '100vh' }}>
          {/* Three.js canvas will be rendered here by game engine */}
        </div>
      )}
    </div>
  )
}

export default App
