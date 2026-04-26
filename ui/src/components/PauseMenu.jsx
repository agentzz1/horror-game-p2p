import { useState } from 'react'

/**
 * PauseMenu - Wird angezeigt wenn das Spiel pausiert ist (ESC-Taste)
 */
function PauseMenu({ onResume, onSettings, onQuitToMenu }) {
  const [showSettings, setShowSettings] = useState(false)

  const handleSettingsClose = () => {
    setShowSettings(false)
  }

  return (
    <div className="pause-overlay">
      {!showSettings ? (
        <div className="pause-menu">
          <h2 className="pause-title">PAUSED</h2>
          
          <div className="pause-buttons">
            <button 
              className="menu-btn"
              onClick={onResume}
            >
              Resume
            </button>
            
            <button 
              className="menu-btn"
              onClick={() => setShowSettings(true)}
            >
              Options
            </button>
            
            <button 
              className="menu-btn"
              style={{ borderColor: '#666', color: '#888' }}
              onClick={onQuitToMenu}
            >
              Quit to Menu
            </button>
          </div>

          <div style={{
            marginTop: '2rem',
            color: '#444',
            fontSize: '0.8rem'
          }}>
            Press ESC to resume
          </div>
        </div>
      ) : (
        <div className="pause-settings">
          {/* Minimal settings overlay - could reuse SettingsPanel with different props */}
          <h3 style={{ color: '#8b0000', marginBottom: '1rem' }}>Quick Settings</h3>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            Full settings available from main menu
          </p>
          <button 
            className="menu-btn" 
            style={{ marginTop: '1rem' }}
            onClick={handleSettingsClose}
          >
            Back
          </button>
        </div>
      )}
    </div>
  )
}

export default PauseMenu
