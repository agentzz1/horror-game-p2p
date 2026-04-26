import { useState, useEffect } from 'react'
import MainMenu from './components/MainMenu'
import SettingsPanel from './components/SettingsPanel'
import LoadingScreen from './components/LoadingScreen'
import Tutorial from './components/Tutorial'

function App() {
  const [currentScreen, setCurrentScreen] = useState('menu')
  const [settings, setSettings] = useState({
    graphics: { quality: 80, shadows: true, particles: true },
    audio: { master: 70, music: 60, sfx: 80 },
    controls: { sensitivity: 50, invertY: false }
  })
  const [isLoading, setIsLoading] = useState(false)

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
      setCurrentScreen('tutorial')
    }, 3000)
  }

  const completeTutorial = () => {
    setCurrentScreen('game')
    // Here you would launch the actual Pygame window
    console.log('Launching game...')
  }

  const goToMenu = () => {
    setCurrentScreen('menu')
  }

  return (
    <div className="app">
      {isLoading && <LoadingScreen />}
      
      {currentScreen === 'menu' && (
        <MainMenu 
          onStart={startGame}
          onSettings={() => setCurrentScreen('settings')}
          onQuit={() => console.log('Quit game')}
        />
      )}

      {currentScreen === 'settings' && (
        <SettingsPanel 
          settings={settings}
          onSave={saveSettings}
          onClose={goToMenu}
        />
      )}

      {currentScreen === 'tutorial' && (
        <Tutorial onComplete={completeTutorial} onSkip={completeTutorial} />
      )}

      {currentScreen === 'game' && (
        <div style={{ display: 'none' }}>
          {/* Game canvas would be rendered here */}
          <p>Game running...</p>
        </div>
      )}
    </div>
  )
}

export default App
