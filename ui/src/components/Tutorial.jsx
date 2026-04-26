import { useState } from 'react'

const tutorialSteps = [
  {
    title: "WELCOME TO HORROR",
    content: "You and your friends are trapped in a haunted facility. Escape... if you can.",
    showControls: false
  },
  {
    title: "MOVEMENT",
    content: "Navigate through the darkness using WASD or Arrow Keys. Stay alert - something is watching.",
    showControls: true,
    controls: [
      { keys: ['W', 'A', 'S', 'D'], desc: 'Move' },
      { keys: ['↑', '↓', '←', '→'], desc: 'Alternative' }
    ]
  },
  {
    title: "SURVIVAL",
    content: "The ghosts hunt by sound and movement. Crouch to move quietly. Sprint to escape - but it makes noise.",
    showControls: true,
    controls: [
      { keys: ['SHIFT'], desc: 'Sprint (Loud)' },
      { keys: ['CTRL'], desc: 'Crouch (Quiet)' },
      { keys: ['SPACE'], desc: 'Interact' }
    ]
  },
  {
    title: "MULTIPLAYER",
    content: "You're not alone. Work together to survive. But remember... sometimes the greatest threat is each other.",
    showControls: false
  },
  {
    title: "OBJECTIVES",
    content: "Find keys, solve puzzles, and escape before the ghosts catch you. There are multiple endings... choose wisely.",
    showControls: true,
    controls: [
      { keys: ['E', 'F'], desc: 'Interact' },
      { keys: ['TAB'], desc: 'Objectives' },
      { keys: ['M'], desc: 'Map' }
    ]
  }
]

function Tutorial({ onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0)
  const step = tutorialSteps[currentStep]

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete()
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-content">
        <h2 className="tutorial-title">{step.title}</h2>
        
        <p className="tutorial-step">{step.content}</p>

        {step.showControls && step.controls && (
          <div className="tutorial-controls">
            {step.controls.map((control, idx) => (
              <div key={idx} className="control-item">
                <div>
                  {control.keys.map((key, kIdx) => (
                    <span key={kIdx} className="control-key">{key}</span>
                  ))}
                </div>
                <span className="control-desc">{control.desc}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '0.5rem',
          marginBottom: '2rem'
        }}>
          {tutorialSteps.map((_, idx) => (
            <div 
              key={idx}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: idx === currentStep ? '#8b0000' : '#333',
                transition: 'all 0.3s ease'
              }}
            />
          ))}
        </div>

        <div className="tutorial-nav">
          {currentStep > 0 ? (
            <button className="nav-btn" onClick={prevStep}>← Back</button>
          ) : (
            <div />
          )}
          
          <button className="nav-btn skip" onClick={onSkip}>
            {currentStep === tutorialSteps.length - 1 ? 'START GAME' : 'SKIP'}
          </button>
          
          {currentStep < tutorialSteps.length - 1 && (
            <button className="nav-btn" onClick={nextStep}>Next →</button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Tutorial
