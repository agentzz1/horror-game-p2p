import { useState } from 'react'

function MainMenu({ onStart, onSettings, onQuit }) {
  const [hoveredButton, setHoveredButton] = useState(null)

  return (
    <div className="main-menu">
      <h1 className="title">👻 HORROR</h1>
      
      <div className="menu-buttons">
        <button 
          className="menu-btn"
          onClick={onStart}
          onMouseEnter={() => setHoveredButton('start')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          Start Game
        </button>
        
        <button 
          className="menu-btn"
          onClick={onSettings}
          onMouseEnter={() => setHoveredButton('settings')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          Options
        </button>
        
        <button 
          className="menu-btn"
          onClick={onQuit}
          onMouseEnter={() => setHoveredButton('quit')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          Quit
        </button>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '5%',
        color: '#666',
        fontSize: '0.8rem'
      }}>
        P2P Multiplayer Horror Experience
      </div>
    </div>
  )
}

export default MainMenu
