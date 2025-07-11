import { GazePoint, HeatmapData } from '../types/eyeTracking'

export class HeatmapRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private heatmapData: Array<Array<number>> = []
  private width: number
  private height: number
  private isVisible = true
  private readonly radius = 30
  private readonly maxIntensity = 100
  private readonly colorStops = [
    { value: 0, color: [0, 0, 0, 0] },
    { value: 0.2, color: [0, 0, 255, 0.3] },
    { value: 0.4, color: [0, 255, 0, 0.5] },
    { value: 0.6, color: [255, 255, 0, 0.7] },
    { value: 0.8, color: [255, 165, 0, 0.8] },
    { value: 1.0, color: [255, 0, 0, 0.9] }
  ]

  constructor(canvas: HTMLCanvasElement) {
    if (!canvas) {
      throw new Error('Canvas element is required for HeatmapRenderer')
    }
    
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas. Canvas may not be properly initialized.')
    }
    
    this.ctx = ctx
    this.width = canvas.width
    this.height = canvas.height
    this.initializeHeatmapData()
  }

  private initializeHeatmapData(): void {
    this.width = this.canvas.width
    this.height = this.canvas.height
    this.heatmapData = Array(this.height).fill(null).map(() => Array(this.width).fill(0))
  }

  addGazePoint(gazePoint: GazePoint): void {
    if (!gazePoint || gazePoint.confidence < 0.3) return

    const x = Math.floor(gazePoint.x)
    const y = Math.floor(gazePoint.y)
    
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return

    // Add intensity with Gaussian-like distribution
    const intensity = gazePoint.confidence * 2
    
    for (let dy = -this.radius; dy <= this.radius; dy++) {
      for (let dx = -this.radius; dx <= this.radius; dx++) {
        const px = x + dx
        const py = y + dy
        
        if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance <= this.radius) {
            // Gaussian falloff
            const falloff = Math.exp(-(distance * distance) / (2 * (this.radius / 3) * (this.radius / 3)))
            const addedIntensity = intensity * falloff
            
            this.heatmapData[py][px] = Math.min(
              this.maxIntensity,
              this.heatmapData[py][px] + addedIntensity
            )
          }
        }
      }
    }
  }

  render(): void {
    if (!this.isVisible) return

    this.ctx.clearRect(0, 0, this.width, this.height)

    // Create image data
    const imageData = this.ctx.createImageData(this.width, this.height)
    const data = imageData.data

    // Find max intensity for normalization
    let maxValue = 0
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        maxValue = Math.max(maxValue, this.heatmapData[y][x])
      }
    }

    if (maxValue === 0) return

    // Render heatmap
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const value = this.heatmapData[y][x] / maxValue
        const color = this.getHeatmapColor(value)
        
        const index = (y * this.width + x) * 4
        data[index] = color[0]     // R
        data[index + 1] = color[1] // G
        data[index + 2] = color[2] // B
        data[index + 3] = color[3] // A
      }
    }

    this.ctx.putImageData(imageData, 0, 0)
    this.applyBlur()
  }

  private getHeatmapColor(value: number): [number, number, number, number] {
    if (value === 0) return [0, 0, 0, 0]

    // Find the appropriate color stops
    for (let i = 0; i < this.colorStops.length - 1; i++) {
      const current = this.colorStops[i]
      const next = this.colorStops[i + 1]
      
      if (value >= current.value && value <= next.value) {
        // Interpolate between colors
        const t = (value - current.value) / (next.value - current.value)
        return [
          Math.round(current.color[0] + (next.color[0] - current.color[0]) * t),
          Math.round(current.color[1] + (next.color[1] - current.color[1]) * t),
          Math.round(current.color[2] + (next.color[2] - current.color[2]) * t),
          Math.round((current.color[3] + (next.color[3] - current.color[3]) * t) * 255)
        ]
      }
    }

    // Return the highest color stop
    const lastColor = this.colorStops[this.colorStops.length - 1].color
    return [
      Math.round(lastColor[0]),
      Math.round(lastColor[1]),
      Math.round(lastColor[2]),
      Math.round(lastColor[3] * 255)
    ]
  }

  private applyBlur(): void {
    this.ctx.filter = 'blur(2px)'
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.drawImage(this.canvas, 0, 0)
    this.ctx.filter = 'none'
  }

  clear(): void {
    this.initializeHeatmapData()
    this.ctx.clearRect(0, 0, this.width, this.height)
  }

  setVisible(visible: boolean): void {
    this.isVisible = visible
    if (!visible) {
      this.ctx.clearRect(0, 0, this.width, this.height)
    }
  }

  resize(): void {
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = this.width
    this.canvas.height = this.height
    this.initializeHeatmapData()
  }

  getHeatmapData(): HeatmapData[] {
    const data: HeatmapData[] = []
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.heatmapData[y][x] > 0) {
          data.push({
            x,
            y,
            value: this.heatmapData[y][x]
          })
        }
      }
    }
    
    return data
  }

  exportImage(): string {
    return this.canvas.toDataURL('image/png')
  }
}