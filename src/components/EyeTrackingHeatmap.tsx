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
  const [isInitializing, setIsInitializing] = useState(false)
  const [fps, setFps] = useState(0)
  const [isMounted, setIsMounted] = useState(true)

  const fpsCounterRef = useRef({ frames: 0, lastTime: Date.now() })

  // Initialize eye tracker and heatmap renderer
  const initializeTracking = useCallback(async () => {
    try {
      // Check if all required DOM elements are available
      if (!videoRef.current || !canvasRef.current || !heatmapCanvasRef.current) {
        console.warn('Required DOM elements not available yet')
        return false
      }

      // Additional check to ensure elements are actually rendered in DOM
      const heatmapCanvas = heatmapCanvasRef.current
      if (!heatmapCanvas || !heatmapCanvas.parentElement) {
        console.warn('Heatmap canvas not yet rendered in DOM')
        return false
      }

      // Check if component is still mounted
      if (!isMounted) {
        console.warn('Component unmounted during initialization')
        return false
      }

      setIsInitializing(true)
      setError(null)

      // Initialize eye tracker
      const eyeTracker = new EyeTracker(videoRef.current)
      await eyeTracker.initialize()
      eyeTrackerRef.current = eyeTracker

      // Ensure canvas is properly set up
      if (heatmapCanvas.width === 0 || heatmapCanvas.height === 0) {
        heatmapCanvas.width = window.innerWidth
        heatmapCanvas.height = window.innerHeight
      }

      // Final validation before creating HeatmapRenderer
      if (heatmapCanvas.width === 0 || heatmapCanvas.height === 0) {
        console.warn('Canvas dimensions are still 0, cannot initialize heatmap renderer')
        return false
      }

      const heatmapRenderer = new HeatmapRenderer(heatmapCanvas)
      heatmapRendererRef.current = heatmapRenderer

      setIsInitialized(true)
      setError(null)
      console.log('Eye tracking initialization successful')
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize eye tracking')
      console.error('Initialization error:', err)
      return false
    } finally {
      setIsInitializing(false)
    }
  }, [isMounted])

  useEffect(() => {
    let retryCount = 0
    const maxRetries = 10
    const retryDelay = 200

    const tryInitialize = async () => {
      const success = await initializeTracking()
      
      if (!success && retryCount < maxRetries) {
        retryCount++
        console.log(`Initialization attempt ${retryCount} failed, retrying in ${retryDelay}ms...`)
        setTimeout(tryInitialize, retryDelay)
      } else if (!success) {
        console.error('Failed to initialize after maximum retries')
        setError('Failed to initialize eye tracking. Please refresh the page.')
      }
    }

    // Small delay to ensure DOM elements are fully rendered
    const timer = setTimeout(() => {
      tryInitialize()
    }, 100)

    return () => {
      setIsMounted(false)
      clearTimeout(timer)
      if (eyeTrackerRef.current) {
        eyeTrackerRef.current.dispose()
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [initializeTracking])

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
          <h2>🔴 Eye Tracking Initialization Failed</h2>
          <p className="error-text">{error}</p>
          
          <div className="error-help">
            <h3>💡 Troubleshooting Steps:</h3>
            <ul>
              <li>
                <strong>Camera Permission:</strong> Make sure you clicked "Allow" when prompted for camera access
              </li>
              <li>
                <strong>Browser Support:</strong> Use Chrome, Firefox, Safari, or Edge (latest versions)
              </li>
              <li>
                <strong>Secure Connection:</strong> Ensure you're using HTTPS or localhost
              </li>
              <li>
                <strong>Camera Availability:</strong> Close other applications that might be using your camera
              </li>
              <li>
                <strong>Privacy Settings:</strong> Check your browser's camera permissions in settings
              </li>
            </ul>
          </div>
          
          <div className="error-actions">
            <button 
              onClick={() => window.location.reload()} 
              className="retry-button"
            >
              🔄 Reload Page
            </button>
            <button 
              onClick={initializeTracking} 
              className="retry-button"
              disabled={isInitializing}
            >
              {isInitializing ? '⏳ Initializing...' : '🔄 Retry'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isInitializing) {
    return (
      <div className="loading-container">
        <div className="loading-message">
          <div className="spinner"></div>
          <h2>🎥 Initializing Eye Tracking...</h2>
          <p>Please allow camera access when prompted</p>
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