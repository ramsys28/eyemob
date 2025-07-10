import { FaceMesh } from '@mediapipe/face_mesh'
import { Camera } from '@mediapipe/camera_utils'
import { GazePoint, FaceDetection } from '../types/eyeTracking'

export class EyeTracker {
  private faceMesh: FaceMesh | null = null
  private camera: Camera | null = null
  private videoElement: HTMLVideoElement
  private isInitialized = false
  private lastGazePoint: GazePoint | null = null
  
  // MediaPipe face mesh indices for eye landmarks
  private readonly LEFT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
  private readonly RIGHT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
  private readonly LEFT_IRIS_INDICES = [474, 475, 476, 477]
  private readonly RIGHT_IRIS_INDICES = [469, 470, 471, 472]

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement
  }

  async initialize(): Promise<void> {
    try {
      // Initialize MediaPipe FaceMesh
      this.faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      })

      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      })

      this.faceMesh.onResults(this.onResults.bind(this))

      // Initialize camera
      this.camera = new Camera(this.videoElement, {
        onFrame: async () => {
          if (this.faceMesh) {
            await this.faceMesh.send({ image: this.videoElement })
          }
        },
        width: 640,
        height: 480,
        facingMode: 'user'
      })

      await this.camera.start()
      this.isInitialized = true
    } catch (error) {
      console.error('Failed to initialize eye tracker:', error)
      throw new Error('Failed to initialize eye tracker. Please check camera permissions.')
    }
  }

  private onResults(results: any): void {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      return
    }

    const landmarks = results.multiFaceLandmarks[0]
    const faceDetection = this.extractFaceDetection(landmarks)
    
    if (faceDetection) {
      const gazePoint = this.calculateGazePoint(faceDetection)
      this.lastGazePoint = gazePoint
    }
  }

  private extractFaceDetection(landmarks: any[]): FaceDetection | null {
    try {
      const leftEye = this.LEFT_EYE_INDICES.map(i => ({
        x: landmarks[i].x * this.videoElement.videoWidth,
        y: landmarks[i].y * this.videoElement.videoHeight
      }))

      const rightEye = this.RIGHT_EYE_INDICES.map(i => ({
        x: landmarks[i].x * this.videoElement.videoWidth,
        y: landmarks[i].y * this.videoElement.videoHeight
      }))

      const leftIris = this.LEFT_IRIS_INDICES.map(i => ({
        x: landmarks[i].x * this.videoElement.videoWidth,
        y: landmarks[i].y * this.videoElement.videoHeight
      }))

      const rightIris = this.RIGHT_IRIS_INDICES.map(i => ({
        x: landmarks[i].x * this.videoElement.videoWidth,
        y: landmarks[i].y * this.videoElement.videoHeight
      }))

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
    
    // Calculate eye centers (corners)
    const leftEyeCenter = this.calculateCenter(landmarks.leftEye)
    const rightEyeCenter = this.calculateCenter(landmarks.rightEye)
    
    // Calculate gaze direction based on iris position relative to eye center
    const leftGazeX = (leftIrisCenter.x - leftEyeCenter.x) / (landmarks.leftEye[0].x - landmarks.leftEye[8].x)
    const leftGazeY = (leftIrisCenter.y - leftEyeCenter.y) / (landmarks.leftEye[0].y - landmarks.leftEye[8].y)
    
    const rightGazeX = (rightIrisCenter.x - rightEyeCenter.x) / (landmarks.rightEye[0].x - landmarks.rightEye[8].x)
    const rightGazeY = (rightIrisCenter.y - rightEyeCenter.y) / (landmarks.rightEye[0].y - landmarks.rightEye[8].y)
    
    // Average the gaze from both eyes
    const gazeX = (leftGazeX + rightGazeX) / 2
    const gazeY = (leftGazeY + rightGazeY) / 2
    
    // Map to screen coordinates
    const screenX = window.innerWidth * (0.5 + gazeX * 0.5)
    const screenY = window.innerHeight * (0.5 + gazeY * 0.5)
    
    // Calculate confidence based on iris detection quality
    const confidence = Math.min(1.0, Math.max(0.1, 
      1.0 - Math.abs(gazeX) * 0.5 - Math.abs(gazeY) * 0.5
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
    if (this.camera) {
      this.camera.stop()
    }
    if (this.faceMesh) {
      this.faceMesh.close()
    }
    this.isInitialized = false
  }

  isReady(): boolean {
    return this.isInitialized
  }
}