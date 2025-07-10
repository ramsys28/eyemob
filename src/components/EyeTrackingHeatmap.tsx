import React, { useRef, useEffect, useState, useCallback } from 'react'
import { EyeTracker } from '../utils/eyeTracker'
import { HeatmapRenderer } from '../utils/heatmapRenderer'
import { GazePoint } from '../types/eyeTracking'
import Controls from './Controls'
import GazeIndicator from './GazeIndicator'
import './EyeTrackingHeatmap.css'

const EyeTrackingHeatmap: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null)
  const eyeTrackerRef = useRef<EyeTracker | null>(null)
  const heatmapRendererRef = useRef<HeatmapRenderer | null>(null)
  const animationFrameRef = useRef<number>()

  const [isTracking, setIsTracking] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [currentGaze, setCurrentGaze] = useState<GazePoint | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fps, setFps] = useState(0)

  const fpsCounterRef = useRef({ frames: 0, lastTime: Date.now() })

  // Initialize eye tracker and heatmap renderer
  useEffect(() => {
    const initializeTracking = async () => {
      try {
        if (!videoRef.current || !canvasRef.current || !heatmapCanvasRef.current) return

        // Initialize eye tracker
        const eyeTracker = new EyeTracker(videoRef.current, canvasRef.current)
        await eyeTracker.initialize()
        eyeTrackerRef.current = eyeTracker

        // Initialize heatmap renderer
        const heatmapRenderer = new HeatmapRenderer(heatmapCanvasRef.current!)
        heatmapRendererRef.current = heatmapRenderer

        setIsInitialized(true)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize eye tracking')
        console.error('Initialization error:', err)
      }
    }

    initializeTracking()

    return () => {
      if (eyeTrackerRef.current) {
        eyeTrackerRef.current.dispose()
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Resize handlers
  useEffect(() => {
    const handleResize = () => {
      if (heatmapCanvasRef.current) {
        heatmapCanvasRef.current.width = window.innerWidth
        heatmapCanvasRef.current.height = window.innerHeight
      }
      if (heatmapRendererRef.current) {
        heatmapRendererRef.current.resize()
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const updateFPS = useCallback(() => {
    const now = Date.now()
    fpsCounterRef.current.frames++
    
    if (now - fpsCounterRef.current.lastTime >= 1000) {
      setFps(fpsCounterRef.current.frames)
      fpsCounterRef.current.frames = 0
      fpsCounterRef.current.lastTime = now
    }
  }, [])

  // Main tracking loop
  const trackingLoop = useCallback(() => {
    if (!isTracking || !eyeTrackerRef.current || !heatmapRendererRef.current) return

    const gazePoint = eyeTrackerRef.current.getGazePoint()
    if (gazePoint) {
      setCurrentGaze(gazePoint)
      heatmapRendererRef.current.addGazePoint(gazePoint)
      
      if (showHeatmap) {
        heatmapRendererRef.current.render()
      }
    }

    updateFPS()
    animationFrameRef.current = requestAnimationFrame(trackingLoop)
  }, [isTracking, showHeatmap, updateFPS])

  // Start/stop tracking
  const toggleTracking = useCallback(() => {
    if (!isInitialized) return

    if (isTracking) {
      setIsTracking(false)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    } else {
      setIsTracking(true)
      trackingLoop()
    }
  }, [isInitialized, isTracking, trackingLoop])

  // Clear heatmap
  const clearHeatmap = useCallback(() => {
    if (heatmapRendererRef.current) {
      heatmapRendererRef.current.clear()
    }
  }, [])

  // Toggle heatmap visibility
  const toggleHeatmap = useCallback(() => {
    setShowHeatmap(prev => {
      const newValue = !prev
      if (heatmapRendererRef.current) {
        heatmapRendererRef.current.setVisible(newValue)
      }
      return newValue
    })
  }, [])

  if (error) {
    return (
      <div className="error-container">
        <div className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
          <p>Please ensure you're using a modern browser with camera access enabled.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="eye-tracking-container">
      {/* Video stream (hidden) */}
      <video
        ref={videoRef}
        className="video-stream"
        playsInline
        muted
        autoPlay
      />

      {/* Canvas for eye tracking processing */}
      <canvas
        ref={canvasRef}
        className="processing-canvas"
      />

      {/* Heatmap overlay */}
      <canvas
        ref={heatmapCanvasRef}
        className="heatmap-canvas"
        style={{ 
          display: showHeatmap ? 'block' : 'none',
          opacity: showHeatmap ? 0.7 : 0
        }}
      />

      {/* Gaze indicator */}
      <GazeIndicator
        gazePoint={currentGaze}
        isVisible={isTracking && !showHeatmap}
      />

      {/* Controls */}
      <Controls
        isTracking={isTracking}
        showHeatmap={showHeatmap}
        isInitialized={isInitialized}
        fps={fps}
        onToggleTracking={toggleTracking}
        onToggleHeatmap={toggleHeatmap}
        onClearHeatmap={clearHeatmap}
      />
    </div>
  )
}

export default EyeTrackingHeatmap