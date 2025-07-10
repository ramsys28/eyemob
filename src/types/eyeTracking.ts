export interface GazePoint {
  x: number
  y: number
  confidence: number
  timestamp: number
}

export interface EyeLandmarks {
  leftEye: Array<{ x: number; y: number }>
  rightEye: Array<{ x: number; y: number }>
  leftIris: Array<{ x: number; y: number }>
  rightIris: Array<{ x: number; y: number }>
}

export interface FaceDetection {
  landmarks: EyeLandmarks
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface HeatmapData {
  x: number
  y: number
  value: number
}

export interface CalibrationPoint {
  x: number
  y: number
  samples: GazePoint[]
}

export interface EyeTrackingConfig {
  sampleRate: number
  heatmapRadius: number
  confidenceThreshold: number
  calibrationPoints: number
}