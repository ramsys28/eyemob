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

      // Try multiple loading strategies with more fallbacks
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
        },
        async () => {
          console.log('Strategy 4: Local fallback')
          return await FilesetResolver.forVisionTasks(
            "/node_modules/@mediapipe/tasks-vision/wasm"
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

      // Try CPU first (most compatible), then GPU with more lenient settings
      const configs = [
        {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU" as const
          },
          runningMode: "VIDEO" as const,
          numFaces: 1,
          minFaceDetectionConfidence: 0.3, // Lowered for better detection
          minFacePresenceConfidence: 0.3, // Lowered for better detection
          minTrackingConfidence: 0.3, // Lowered for better detection
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
          minFaceDetectionConfidence: 0.2, // Even lower for GPU
          minFacePresenceConfidence: 0.2,
          minTrackingConfidence: 0.2,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false
        }
      ]

      let lastError = null
      for (let i = 0; i < configs.length; i++) {
        try {
          console.log(`Trying FaceLandmarker config ${i + 1} (${configs[i].baseOptions.delegate})...`)
          this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, configs[i])
          console.log(`FaceLandmarker created successfully with config ${i + 1} (${configs[i].baseOptions.delegate})`)
          return
        } catch (error) {
          console.warn(`Config ${i + 1} (${configs[i].baseOptions.delegate}) failed:`, error)
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
          errorMessage = 'SharedArrayBuffer not available. This may happen in some browsers or when not using HTTPS. Please try using Chrome or Firefox with HTTPS.'
        } else if (msg.includes('wasm')) {
          errorMessage = 'Failed to load WASM files. Please check your internet connection and try refreshing the page. If the issue persists, try clearing your browser cache.'
        } else if (msg.includes('model')) {
          errorMessage = 'Failed to load face detection model. Please check your internet connection and try again.'
        } else if (msg.includes('gpu')) {
          errorMessage = 'GPU acceleration failed, trying CPU fallback.'
        } else if (msg.includes('cors')) {
          errorMessage = 'CORS error loading MediaPipe files. Please ensure you are using HTTPS or localhost.'
        } else {
          errorMessage = `MediaPipe error: ${error.message}`
        }
      }
      
      throw new Error(errorMessage)
    }
  }

  private async checkBrowserCompatibility(): Promise<void> {
    console.log('Checking browser compatibility...')
    
    // Check if required APIs are available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Your browser does not support camera access. Please use a modern browser like Chrome, Firefox, or Safari.')
    }

    // Check if running in secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      throw new Error('Camera access requires a secure connection (HTTPS). Please ensure you are using HTTPS.')
    }

    // Check SharedArrayBuffer availability (required for MediaPipe WASM)
    if (typeof SharedArrayBuffer === 'undefined') {
      console.warn('SharedArrayBuffer is not available. This may affect MediaPipe performance.')
      console.warn('To enable SharedArrayBuffer, ensure your site has Cross-Origin-Embedder-Policy: require-corp and Cross-Origin-Opener-Policy: same-origin headers.')
    } else {
      console.log('SharedArrayBuffer is available')
    }

    // Check WebAssembly support
    if (typeof WebAssembly === 'undefined') {
      throw new Error('Your browser does not support WebAssembly, which is required for face detection.')
    }

    // Check Canvas 2D context support
    const testCanvas = document.createElement('canvas')
    const testCtx = testCanvas.getContext('2d')
    if (!testCtx) {
      throw new Error('Your browser does not support Canvas 2D context.')
    }

    console.log('Browser compatibility check passed')
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
      console.log('Requesting camera access...')
      // Get camera stream using standard getUserMedia
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30, min: 15 }
        }
      })

      console.log('Camera stream obtained, setting up video element...')
      
      // Set video stream
      this.videoElement.srcObject = this.stream
      
      // Ensure video element has proper attributes
      this.videoElement.autoplay = true
      this.videoElement.playsInline = true
      this.videoElement.muted = true
      
      // Force video to start playing
      try {
        await this.videoElement.play()
        console.log('Video playback started')
      } catch (playError) {
        console.warn('Video play failed, but continuing:', playError)
      }
      
      // Wait for video to be ready with better timeout handling
      await this.waitForVideoReady()
      
      console.log('Camera initialized successfully - Video dimensions:', 
        this.videoElement.videoWidth, 'x', this.videoElement.videoHeight)
      
      // Verify video has valid dimensions
      if (this.videoElement.videoWidth === 0 || this.videoElement.videoHeight === 0) {
        throw new Error('Video stream has invalid dimensions. Camera may not be working properly.')
      }
      
    } catch (error) {
      console.error('Camera initialization failed:', error)
      
      // Cleanup on failure
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop())
        this.stream = null
      }
      
      if (error instanceof Error) {
        throw error
      } else {
        throw new Error('Failed to initialize camera. Please ensure your camera is not being used by another application.')
      }
    }
  }

  private async waitForVideoReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Camera initialization timed out. Please check your camera connection.'))
      }, 15000) // Increased timeout to 15 seconds

      let attempts = 0
      const maxAttempts = 150 // 15 seconds with 100ms intervals

      const checkVideo = () => {
        attempts++
        
        // Check multiple conditions for video readiness
        const hasValidDimensions = this.videoElement.videoWidth > 0 && this.videoElement.videoHeight > 0
        const isReadyState = this.videoElement.readyState >= 2 // HAVE_CURRENT_DATA
        const isPlaying = !this.videoElement.paused && !this.videoElement.ended
        
        console.log(`Video check attempt ${attempts}: readyState=${this.videoElement.readyState}, ` +
          `dimensions=${this.videoElement.videoWidth}x${this.videoElement.videoHeight}, ` +
          `playing=${isPlaying}`)
        
        if (hasValidDimensions && isReadyState) {
          clearTimeout(timeout)
          console.log('Video ready - dimensions:', this.videoElement.videoWidth, 'x', this.videoElement.videoHeight)
          resolve()
        } else if (attempts >= maxAttempts) {
          clearTimeout(timeout)
          reject(new Error(`Video failed to initialize after ${maxAttempts} attempts. ` +
            `Final state: readyState=${this.videoElement.readyState}, ` +
            `dimensions=${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`))
        } else {
          setTimeout(checkVideo, 100)
        }
      }

      // Start checking immediately, then every 100ms
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
      // Always schedule next frame first to ensure loop continues
      if (this.detectionActive) {
        this.animationFrameId = requestAnimationFrame(detect)
      }
      
      if (!this.faceLandmarker || !this.isInitialized || !this.detectionActive) {
        console.log('Detection loop conditions not met - landmarker:', !!this.faceLandmarker, 'initialized:', this.isInitialized, 'active:', this.detectionActive)
        return
      }

      try {
        // Check if video is still playing and has valid dimensions
        if (this.videoElement.readyState < 2) {
          // Video not ready, skip this frame but continue loop
          console.log('Video not ready, readyState:', this.videoElement.readyState)
          return
        }

        // Check for valid video dimensions
        if (this.videoElement.videoWidth === 0 || this.videoElement.videoHeight === 0) {
          console.warn('Video has invalid dimensions:', this.videoElement.videoWidth, 'x', this.videoElement.videoHeight)
          return
        }

        const timestamp = performance.now()
        const results = this.faceLandmarker.detectForVideo(this.videoElement, timestamp)
        
        // Process results
        this.onResults(results)
        
        // Debug logging every 3 seconds instead of 2 to reduce spam
        if (Math.floor(timestamp / 3000) !== Math.floor((timestamp - 16) / 3000)) {
          console.log('Detection running, faces detected:', results.faceLandmarks?.length || 0, 
            'video size:', this.videoElement.videoWidth, 'x', this.videoElement.videoHeight,
            'readyState:', this.videoElement.readyState)
        }
      } catch (error) {
        console.error('Detection error:', error)
        // Continue detection even if there's an error
      }
    }

    // Start the detection loop
    detect()
  }

  private onResults(results: any): void {
    if (!results) {
      console.warn('No results from MediaPipe detection')
      return
    }
    
    if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
      // No face detected, clear last gaze point after some time
      if (this.lastGazePoint && Date.now() - this.lastGazePoint.timestamp > 500) {
        this.lastGazePoint = null
        console.log('Cleared old gaze point due to no face detection')
      }
      return
    }

    try {
      const landmarks = results.faceLandmarks[0]
      const faceDetection = this.extractFaceDetection(landmarks)
      
      if (faceDetection) {
        const gazePoint = this.calculateGazePoint(faceDetection)
        this.lastGazePoint = gazePoint
        
        // Debug logging for successful gaze points
        if (gazePoint.confidence > 0.3) {
          console.log('Gaze point calculated:', gazePoint.x.toFixed(0), gazePoint.y.toFixed(0), 'confidence:', gazePoint.confidence.toFixed(2))
        }
      } else {
        console.log('Face detected but could not extract eye landmarks')
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