import React from 'react'
import './Controls.css'

interface ControlsProps {
  isTracking: boolean
  showHeatmap: boolean
  isInitialized: boolean
  fps: number
  debugMode?: boolean
  onToggleTracking: () => void
  onToggleHeatmap: () => void
  onClearHeatmap: () => void
  onToggleDebug?: () => void
}

const Controls: React.FC<ControlsProps> = ({
  isTracking,
  showHeatmap,
  isInitialized,
  fps,
  debugMode = false,
  onToggleTracking,
  onToggleHeatmap,
  onClearHeatmap,
  onToggleDebug
}) => {
  return (
    <div className="controls-container">
      <div className="controls-panel">
        <div className="status-section">
          <div className="status-indicator">
            <div className={`status-dot ${isInitialized ? 'ready' : 'initializing'}`} />
            <span className="status-text">
              {isInitialized ? (isTracking ? 'Tracking' : 'Ready') : 'Initializing...'}
            </span>
          </div>
          <div className="fps-counter">
            {fps} FPS
          </div>
        </div>

        <div className="controls-section">
          <button
            className={`control-button primary ${isTracking ? 'active' : ''}`}
            onClick={onToggleTracking}
            disabled={!isInitialized}
          >
            {isTracking ? 'Stop' : 'Start'} Tracking
          </button>

          <button
            className={`control-button ${showHeatmap ? 'active' : ''}`}
            onClick={onToggleHeatmap}
            disabled={!isInitialized}
          >
            {showHeatmap ? 'Hide' : 'Show'} Heatmap
          </button>

          <button
            className="control-button danger"
            onClick={onClearHeatmap}
            disabled={!isInitialized}
          >
            Clear Heatmap
          </button>

          {onToggleDebug && (
            <button
              className={`control-button ${debugMode ? 'active' : ''}`}
              onClick={onToggleDebug}
              title="Toggle debug console logging"
            >
              {debugMode ? 'Disable' : 'Enable'} Debug
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Controls