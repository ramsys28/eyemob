import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { GazePoint, FaceDetection } from '../types/eyeTracking'

export class EyeTracker {
  private faceLandmarker: FaceLandmarker | null = null
  private stream: MediaStream | null = null
  private videoElement: HTMLVideoElement
  private isInitialized = false
  private lastGazePoint: GazePoint | null = null
  private animationFrameId: number | null = null
  private detectionActive = false
  
  // Updated MediaPipe face mesh indices for eye landmarks (v0.10.x)
  private readonly LEFT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
  private readonly RIGHT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
  private readonly LEFT_IRIS_INDICES = [474, 475, 476, 477]
  private readonly RIGHT_IRIS_INDICES = [469, 470, 471, 472]

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement
  }

  async initialize(): Promise<void> {
    try {
      console.log('Starting eye tracker initialization...')
      
      // Check browser compatibility
      await this.checkBrowserCompatibility()
      
      // Check network connectivity
      await this.checkNetworkConnectivity()
      
      // Request camera permissions explicitly
      await this.requestCameraPermissions()
      
      // Initialize MediaPipe FaceLandmarker with local fallback
      console.log('Initializing MediaPipe...')
      await this.initializeMediaPipe()
      
      // Initialize camera with standard getUserMedia API
      console.log('Initializing camera...')
      await this.initializeCamera()
      
      // Start the detection loop
      console.log('Starting detection loop...')
      this.startDetectionLoop()
      
      this.isInitialized = true
      console.log('Eye tracker initialization completed successfully')
    } catch (error) {
      console.error('Failed to initialize eye tracker:', error)
      
      // Provide specific error messages
      if (error instanceof Error) {
        throw error
      } else {
        throw new Error('Failed to initialize eye tracker. Please check camera permissions.')
      }
    }
  }

  private async initializeMediaPipe(): Promise<void> {
    try {
      console.log('Attempting MediaPipe initialization...')

      let vision;
      let initError = null;

      // Try multiple loading strategies
      const loadingStrategies = [
        async () => {
          console.log('Strategy 1: Primary CDN with stable version')
          return await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/wasm"
          )
        },
        async () => {
          console.log('Strategy 2: Alternative CDN')
          return await FilesetResolver.forVisionTasks(
            "https://unpkg.com/@mediapipe/tasks-vision@0.10.11/wasm"
          )
        },
        async () => {
          console.log('Strategy 3: Google CDN')
          return await FilesetResolver.forVisionTasks(
            "https://storage.googleapis.com/mediapipe-assets/wasm"
          )
        }
      ]

      for (const strategy of loadingStrategies) {
        try {
          vision = await strategy()
          console.log('WASM loading successful')
          break
        } catch (error) {
          console.warn('Loading strategy failed:', error)
          initError = error
        }
      }

      if (!vision) {
        throw new Error(`All WASM loading strategies failed. Last error: ${initError instanceof Error ? initError.message : 'Unknown error'}`)
      }

      // Try CPU first (most compatible), then GPU
      const configs = [
        {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU" as const
          },
          runningMode: "VIDEO" as const,
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false
        },
        {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU" as const
          },
          runningMode: "VIDEO" as const,
          numFaces: 1,
          minFaceDetectionConfidence: 0.3,
          minFacePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false
        }
      ]

      let lastError = null
      for (let i = 0; i < configs.length; i++) {
        try {
          console.log(`Trying FaceLandmarker config ${i + 1}...`)
          this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, configs[i])
          console.log(`FaceLandmarker created successfully with config ${i + 1}`)
          return
        } catch (error) {
          console.warn(`Config ${i + 1} failed:`, error)
          lastError = error
        }
      }

      throw lastError || new Error('All configurations failed')

    } catch (error) {
      console.error('MediaPipe initialization failed:', error)
      
      // Provide specific error messages
      let errorMessage = 'MediaPipe initialization failed'
      
      if (error instanceof Error) {
        const msg = error.message.toLowerCase()
        
        if (msg.includes('sharedarraybuffer')) {
          errorMessage = 'SharedArrayBuffer not available. Please use Chrome/Edge with cross-origin isolation enabled.'
        } else if (msg.includes('wasm')) {
          errorMessage = 'Failed to load WASM files. Please check your internet connection and refresh the page.'
        } else if (msg.includes('model')) {
          errorMessage = 'Failed to load face detection model. Please check your internet connection.'
        } else if (msg.includes('gpu')) {
          errorMessage = 'GPU acceleration failed. Using CPU fallback.'
        } else {
          errorMessage = `MediaPipe error: ${error.message}`
        }
      }
      
      throw new Error(errorMessage)
    }
  }

  private async checkBrowserCompatibility(): Promise<void> {
    // Check if required APIs are available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Your browser does not support camera access. Please use a modern browser like Chrome, Firefox, or Safari.')
    }

    // Check if running in secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      throw new Error('Camera access requires a secure connection (HTTPS). Please ensure you are using HTTPS.')
    }
  }

  private async checkNetworkConnectivity(): Promise<void> {
    try {
      // Test basic connectivity
      const response = await fetch('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/package.json', {
        method: 'HEAD',
        mode: 'cors'
      })
      
      if (!response.ok) {
        throw new Error(`Network check failed: ${response.status}`)
      }
      
      console.log('Network connectivity check passed')
    } catch (error) {
      console.error('Network connectivity check failed:', error)
      throw new Error('Network connectivity issue. Please check your internet connection.')
    }
  }

  private async requestCameraPermissions(): Promise<void> {
    try {
      // Check current permission status
      if ('permissions' in navigator) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName })
          
          if (permissionStatus.state === 'denied') {
            throw new Error('Camera permission has been denied. Please enable camera access in your browser settings and reload the page.')
          }
        } catch (permError) {
          console.warn('Permission query failed:', permError)
          // Continue anyway as some browsers don't support this API
        }
      }

      // Test camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }
      })
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop())
      
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Camera access was denied. Please click "Allow" when prompted for camera permissions.')
        } else if (error.name === 'NotFoundError') {
          throw new Error('No camera found. Please ensure you have a camera connected to your device.')
        } else if (error.name === 'NotReadableError') {
          throw new Error('Camera is already in use by another application. Please close other applications using the camera.')
        } else if (error.name === 'OverconstrainedError') {
          throw new Error('Camera constraints could not be satisfied. Please try with a different camera.')
        } else {
          throw new Error(`Camera access failed: ${error.message}`)
        }
      } else {
        throw new Error('Failed to access camera. Please check your browser permissions.')
      }
    }
  }

  private async initializeCamera(): Promise<void> {
    try {
      // Get camera stream using standard getUserMedia
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        }
      })

      // Set video stream
      this.videoElement.srcObject = this.stream
      
      // Wait for video to be ready
      await this.waitForVideoReady()
      
      console.log('Camera initialized successfully')
    } catch (error) {
      console.error('Camera initialization failed:', error)
      throw new Error('Failed to initialize camera. Please ensure your camera is not being used by another application.')
    }
  }

  private async waitForVideoReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Camera initialization timed out. Please check your camera connection.'))
      }, 10000) // 10 second timeout

      const checkVideo = () => {
        if (this.videoElement.readyState >= 2) { // HAVE_CURRENT_DATA
          clearTimeout(timeout)
          console.log('Video ready - dimensions:', this.videoElement.videoWidth, 'x', this.videoElement.videoHeight)
          resolve()
        } else {
          setTimeout(checkVideo, 100)
        }
      }

      checkVideo()
    })
  }

  private startDetectionLoop(): void {
    if (this.detectionActive) {
      console.warn('Detection loop already active')
      return
    }

    this.detectionActive = true
    console.log('Starting detection loop...')

    const detect = async () => {
      if (!this.faceLandmarker || !this.isInitialized || !this.detectionActive) {
        return
      }

      try {
        // Check if video is still playing
        if (this.videoElement.readyState < 2) {
          // Video not ready, skip this frame
          this.animationFrameId = requestAnimationFrame(detect)
          return
        }

        const timestamp = performance.now()
        const results = this.faceLandmarker.detectForVideo(this.videoElement, timestamp)
        
        // Process results
        this.onResults(results)
        
        // Debug logging every 60 frames (~2 seconds at 30fps)
        if (Math.floor(timestamp / 1000) % 2 === 0 && timestamp % 1000 < 50) {
          console.log('Detection running, faces detected:', results.faceLandmarks?.length || 0)
        }
      } catch (error) {
        console.error('Detection error:', error)
        // Continue detection even if there's an error
      }

      // Schedule next detection
      if (this.detectionActive) {
        this.animationFrameId = requestAnimationFrame(detect)
      }
    }

    // Start the detection loop
    detect()
  }

  private onResults(results: any): void {
    if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
      // No face detected, clear last gaze point after some time
      if (this.lastGazePoint && Date.now() - this.lastGazePoint.timestamp > 500) {
        this.lastGazePoint = null
      }
      return
    }

    try {
      const landmarks = results.faceLandmarks[0]
      const faceDetection = this.extractFaceDetection(landmarks)
      
      if (faceDetection) {
        const gazePoint = this.calculateGazePoint(faceDetection)
        this.lastGazePoint = gazePoint
        
        // Debug logging
        if (gazePoint.confidence > 0.5) {
          console.log('High confidence gaze point:', gazePoint.x.toFixed(0), gazePoint.y.toFixed(0), 'confidence:', gazePoint.confidence.toFixed(2))
        }
      }
    } catch (error) {
      console.error('Error processing detection results:', error)
    }
  }

  private extractFaceDetection(landmarks: any[]): FaceDetection | null {
    try {
      // Validate landmarks array
      if (!landmarks || landmarks.length < 478) {
        console.warn('Invalid landmarks array, length:', landmarks?.length)
        return null
      }

      // Extract eye landmarks with bounds checking
      const leftEye = this.LEFT_EYE_INDICES
        .filter(i => i < landmarks.length)
        .map(i => ({
          x: landmarks[i].x * this.videoElement.videoWidth,
          y: landmarks[i].y * this.videoElement.videoHeight
        }))

      const rightEye = this.RIGHT_EYE_INDICES
        .filter(i => i < landmarks.length)
        .map(i => ({
          x: landmarks[i].x * this.videoElement.videoWidth,
          y: landmarks[i].y * this.videoElement.videoHeight
        }))

      const leftIris = this.LEFT_IRIS_INDICES
        .filter(i => i < landmarks.length)
        .map(i => ({
          x: landmarks[i].x * this.videoElement.videoWidth,
          y: landmarks[i].y * this.videoElement.videoHeight
        }))

      const rightIris = this.RIGHT_IRIS_INDICES
        .filter(i => i < landmarks.length)
        .map(i => ({
          x: landmarks[i].x * this.videoElement.videoWidth,
          y: landmarks[i].y * this.videoElement.videoHeight
        }))

      // Validate that we have enough landmarks
      if (leftEye.length < 8 || rightEye.length < 8 || leftIris.length < 4 || rightIris.length < 4) {
        console.warn('Insufficient landmarks for eye detection')
        return null
      }

      // Calculate bounding box
      const allPoints = [...leftEye, ...rightEye]
      const minX = Math.min(...allPoints.map(p => p.x))
      const maxX = Math.max(...allPoints.map(p => p.x))
      const minY = Math.min(...allPoints.map(p => p.y))
      const maxY = Math.max(...allPoints.map(p => p.y))

      return {
        landmarks: {
          leftEye,
          rightEye,
          leftIris,
          rightIris
        },
        boundingBox: {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        }
      }
    } catch (error) {
      console.error('Error extracting face detection:', error)
      return null
    }
  }

  private calculateGazePoint(faceDetection: FaceDetection): GazePoint {
    const { landmarks } = faceDetection
    
    // Calculate iris centers
    const leftIrisCenter = this.calculateCenter(landmarks.leftIris)
    const rightIrisCenter = this.calculateCenter(landmarks.rightIris)
    
    // Calculate eye centers
    const leftEyeCenter = this.calculateCenter(landmarks.leftEye)
    const rightEyeCenter = this.calculateCenter(landmarks.rightEye)
    
    // Calculate eye dimensions for normalization
    const leftEyeWidth = Math.abs(landmarks.leftEye[0].x - landmarks.leftEye[8].x)
    const leftEyeHeight = Math.abs(landmarks.leftEye[4].y - landmarks.leftEye[12].y)
    const rightEyeWidth = Math.abs(landmarks.rightEye[0].x - landmarks.rightEye[8].x)
    const rightEyeHeight = Math.abs(landmarks.rightEye[4].y - landmarks.rightEye[12].y)
    
    // Calculate gaze direction based on iris position relative to eye center
    const leftGazeX = leftEyeWidth > 0 ? (leftIrisCenter.x - leftEyeCenter.x) / leftEyeWidth : 0
    const leftGazeY = leftEyeHeight > 0 ? (leftIrisCenter.y - leftEyeCenter.y) / leftEyeHeight : 0
    
    const rightGazeX = rightEyeWidth > 0 ? (rightIrisCenter.x - rightEyeCenter.x) / rightEyeWidth : 0
    const rightGazeY = rightEyeHeight > 0 ? (rightIrisCenter.y - rightEyeCenter.y) / rightEyeHeight : 0
    
    // Average the gaze from both eyes
    const gazeX = (leftGazeX + rightGazeX) / 2
    const gazeY = (leftGazeY + rightGazeY) / 2
    
    // Map to screen coordinates with improved scaling
    const screenX = window.innerWidth * (0.5 + gazeX * 0.8)
    const screenY = window.innerHeight * (0.5 + gazeY * 0.8)
    
    // Calculate confidence based on iris detection quality and eye dimensions
    const eyeQuality = Math.min(leftEyeWidth, rightEyeWidth, leftEyeHeight, rightEyeHeight)
    const gazeDeviation = Math.abs(gazeX) + Math.abs(gazeY)
    const confidence = Math.min(1.0, Math.max(0.1, 
      (eyeQuality / 20) * (1.0 - gazeDeviation * 0.3)
    ))
    
    return {
      x: Math.max(0, Math.min(window.innerWidth, screenX)),
      y: Math.max(0, Math.min(window.innerHeight, screenY)),
      confidence,
      timestamp: Date.now()
    }
  }

  private calculateCenter(points: Array<{ x: number; y: number }>): { x: number; y: number } {
    const sum = points.reduce((acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y
    }), { x: 0, y: 0 })
    
    return {
      x: sum.x / points.length,
      y: sum.y / points.length
    }
  }

  getGazePoint(): GazePoint | null {
    return this.lastGazePoint
  }

  dispose(): void {
    console.log('Disposing eye tracker...')
    
    // Stop detection loop
    this.detectionActive = false
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    // Stop camera stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }

    // Close face landmarker
    if (this.faceLandmarker) {
      this.faceLandmarker.close()
      this.faceLandmarker = null
    }

    this.isInitialized = false
    this.lastGazePoint = null
    
    console.log('Eye tracker disposed')
  }

  isReady(): boolean {
    return this.isInitialized && this.detectionActive
  }
}