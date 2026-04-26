import { useState, useEffect } from 'react'

const loadingTips = [
  "Pro tip: Stay in the light. The ghosts hate it.",
  "Did you hear that? Probably nothing...",
  "Your friends are counting on you. Don't let them down.",
  "The ghosts can hear you breathe. Try to stay quiet.",
  "Remember: Run faster than your friend, and you'll survive.",
  "Some doors are better left unopened...",
  "Trust no one. Not even yourself.",
  "The darkness is not empty. It never was."
]

function LoadingScreen() {
  const [progress, setProgress] = useState(0)
  const [currentTip, setCurrentTip] = useState(loadingTips[0])

  useEffect(() => {
    // Random tip
    setCurrentTip(loadingTips[Math.floor(Math.random() * loadingTips.length)])
    
    // Simulate loading
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + Math.random() * 15
      })
    }, 200)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="loading-screen">
      <div className="loading-text">LOADING...</div>
      
      <div className="loading-bar">
        <div 
          className="loading-progress" 
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      <div className="loading-tip">
        💀 {currentTip}
      </div>

      <div style={{
        position: 'absolute',
        top: '10%',
        color: '#333',
        fontSize: '0.8rem'
      }}>
        Initializing P2P connection...
      </div>
    </div>
  )
}

export default LoadingScreen
