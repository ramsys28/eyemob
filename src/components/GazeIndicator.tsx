import React from 'react'
import { GazePoint } from '../types/eyeTracking'
import './GazeIndicator.css'

interface GazeIndicatorProps {
  gazePoint: GazePoint | null
  isVisible: boolean
}

const GazeIndicator: React.FC<GazeIndicatorProps> = ({ gazePoint, isVisible }) => {
  if (!gazePoint || !isVisible) return null

  return (
    <div
      className="gaze-indicator"
      style={{
        left: gazePoint.x,
        top: gazePoint.y,
        opacity: gazePoint.confidence
      }}
    >
      <div className="gaze-dot" />
      <div className="gaze-ring" />
    </div>
  )
}

export default GazeIndicator