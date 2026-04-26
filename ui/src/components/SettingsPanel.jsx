import { useState } from 'react'

function SettingsPanel({ settings, onSave, onClose }) {
  const [activeTab, setActiveTab] = useState('graphics')
  const [localSettings, setLocalSettings] = useState(settings)

  const updateSetting = (category, key, value) => {
    const newSettings = {
      ...localSettings,
      [category]: {
        ...localSettings[category],
        [key]: value
      }
    }
    setLocalSettings(newSettings)
  }

  const handleSave = () => {
    onSave(localSettings)
    onClose()
  }

  return (
    <div className="settings-panel">
      <button className="close-btn" onClick={onClose}>×</button>
      
      <h2 className="settings-header">OPTIONS</h2>
      
      <div className="settings-tabs">
        <button 
          className={`tab-btn ${activeTab === 'graphics' ? 'active' : ''}`}
          onClick={() => setActiveTab('graphics')}
        >
          Graphics
        </button>
        <button 
          className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
          onClick={() => setActiveTab('audio')}
        >
          Audio
        </button>
        <button 
          className={`tab-btn ${activeTab === 'controls' ? 'active' : ''}`}
          onClick={() => setActiveTab('controls')}
        >
          Controls
        </button>
      </div>

      {activeTab === 'graphics' && (
        <div className="settings-content">
          <div className="setting-group">
            <label className="setting-label">Quality: {localSettings.graphics.quality}%</label>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={localSettings.graphics.quality}
              onChange={(e) => updateSetting('graphics', 'quality', parseInt(e.target.value))}
              className="setting-slider"
            />
          </div>
          
          <div className="setting-group">
            <label className="setting-label">Shadows</label>
            <button 
              className="menu-btn"
              style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}
              onClick={() => updateSetting('graphics', 'shadows', !localSettings.graphics.shadows)}
            >
              {localSettings.graphics.shadows ? 'ON' : 'OFF'}
            </button>
          </div>
          
          <div className="setting-group">
            <label className="setting-label">Particles</label>
            <button 
              className="menu-btn"
              style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}
              onClick={() => updateSetting('graphics', 'particles', !localSettings.graphics.particles)}
            >
              {localSettings.graphics.particles ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'audio' && (
        <div className="settings-content">
          <div className="setting-group">
            <label className="setting-label">Master Volume: {localSettings.audio.master}%</label>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={localSettings.audio.master}
              onChange={(e) => updateSetting('audio', 'master', parseInt(e.target.value))}
              className="setting-slider"
            />
          </div>
          
          <div className="setting-group">
            <label className="setting-label">Music: {localSettings.audio.music}%</label>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={localSettings.audio.music}
              onChange={(e) => updateSetting('audio', 'music', parseInt(e.target.value))}
              className="setting-slider"
            />
          </div>
          
          <div className="setting-group">
            <label className="setting-label">SFX: {localSettings.audio.sfx}%</label>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={localSettings.audio.sfx}
              onChange={(e) => updateSetting('audio', 'sfx', parseInt(e.target.value))}
              className="setting-slider"
            />
          </div>
        </div>
      )}

      {activeTab === 'controls' && (
        <div className="settings-content">
          <div className="setting-group">
            <label className="setting-label">Mouse Sensitivity: {localSettings.controls.sensitivity}%</label>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={localSettings.controls.sensitivity}
              onChange={(e) => updateSetting('controls', 'sensitivity', parseInt(e.target.value))}
              className="setting-slider"
            />
          </div>
          
          <div className="setting-group">
            <label className="setting-label">Invert Y-Axis</label>
            <button 
              className="menu-btn"
              style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}
              onClick={() => updateSetting('controls', 'invertY', !localSettings.controls.invertY)}
            >
              {localSettings.controls.invertY ? 'ON' : 'OFF'}
            </button>
          </div>
          
          <div style={{ marginTop: '2rem', color: '#888', fontSize: '0.9rem' }}>
            <p>Movement: WASD / Arrow Keys</p>
            <p>Interact: E / F</p>
            <p>Sprint: Shift</p>
            <p>Pause: ESC</p>
          </div>
        </div>
      )}

      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        justifyContent: 'center',
        marginTop: '2rem'
      }}>
        <button className="menu-btn" onClick={handleSave}>Save</button>
        <button 
          className="menu-btn" 
          style={{ borderColor: '#666', color: '#666' }}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default SettingsPanel
