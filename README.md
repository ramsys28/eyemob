# Eye-Tracking Heatmap Web App

A mobile-first web application that uses real-time eye tracking to create dynamic heatmaps showing where users look on the screen. Built with React, TypeScript, and MediaPipe.

## Features

- **Real-time Eye Tracking**: Uses MediaPipe FaceMesh to detect and track eye movements
- **Dynamic Heatmaps**: Visualizes gaze data with customizable color gradients
- **Mobile-First Design**: Optimized for mobile browsers with responsive UI
- **Privacy-Focused**: All processing happens locally in the browser
- **High Performance**: Maintains 15+ FPS for smooth visualization
- **Interactive Controls**: Start/stop tracking, toggle heatmap visibility, and clear data

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- A modern web browser with camera access
- HTTPS connection (required for camera access)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd eye-tracking-heatmap
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `https://localhost:3000`

### Building for Production

```bash
npm run build
npm run preview
```

## Usage

1. **Grant Camera Permission**: Allow the app to access your device's camera
2. **Wait for Initialization**: The status indicator will show "Ready" when the system is initialized
3. **Start Tracking**: Click "Start Tracking" to begin eye tracking
4. **View Heatmap**: The heatmap overlay shows gaze density with color-coded intensity
5. **Toggle Visibility**: Use "Show/Hide Heatmap" to toggle between heatmap and gaze indicator
6. **Clear Data**: Click "Clear Heatmap" to reset the accumulated gaze data

## Technical Architecture

### Core Components

- **EyeTrackingHeatmap**: Main component orchestrating the entire system
- **Controls**: UI controls for user interaction
- **GazeIndicator**: Real-time gaze position indicator
- **EyeTracker**: MediaPipe-based eye tracking engine
- **HeatmapRenderer**: Custom heatmap rendering with Canvas API

### Eye Tracking Pipeline

1. **Face Detection**: MediaPipe FaceMesh detects facial landmarks
2. **Eye Landmark Extraction**: Extracts eye and iris coordinates
3. **Gaze Estimation**: Calculates gaze direction from iris position
4. **Screen Mapping**: Maps gaze vector to screen coordinates
5. **Confidence Scoring**: Assigns confidence based on detection quality

### Heatmap Generation

1. **Data Accumulation**: Gaze points are accumulated in a 2D array
2. **Gaussian Distribution**: Each point creates a Gaussian falloff pattern
3. **Color Mapping**: Values are mapped to colors using interpolation
4. **Real-time Rendering**: Updates at 15-30 FPS for smooth visualization

## Browser Compatibility

- **Chrome**: Full support (recommended)
- **Safari**: iOS Safari 14+
- **Firefox**: Limited MediaPipe support
- **Edge**: Full support

## Privacy & Security

- All processing happens locally in the browser
- No gaze data is transmitted to external servers
- Camera access is only used for eye tracking
- Data is cleared when the page is refreshed

## Performance Optimizations

- Efficient 2D array operations for heatmap data
- Canvas-based rendering for optimal performance
- Gaussian blur applied via CSS filters
- Confidence-based filtering to reduce noise

## Development

### Project Structure

```
src/
├── components/          # React components
│   ├── EyeTrackingHeatmap.tsx
│   ├── Controls.tsx
│   └── GazeIndicator.tsx
├── utils/              # Utility classes
│   ├── eyeTracker.ts
│   └── heatmapRenderer.ts
├── types/              # TypeScript definitions
│   └── eyeTracking.ts
└── App.tsx             # Main application
```

### Key Technologies

- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **MediaPipe**: Google's ML framework for face detection
- **Canvas API**: High-performance 2D rendering

### Configuration

Eye tracking parameters can be adjusted in the `EyeTracker` class:

```typescript
// MediaPipe FaceMesh options
maxNumFaces: 1,
refineLandmarks: true,
minDetectionConfidence: 0.5,
minTrackingConfidence: 0.5
```

Heatmap appearance can be customized in the `HeatmapRenderer` class:

```typescript
// Heatmap parameters
radius: 30,           // Gaussian radius
maxIntensity: 100,    // Maximum intensity value
colorStops: [...]     // Color gradient stops
```

## Troubleshooting

### Common Issues

1. **Camera Access Denied**
   - Ensure you're using HTTPS
   - Check browser permissions
   - Try refreshing the page

2. **Poor Tracking Quality**
   - Ensure good lighting
   - Position face 60-90cm from camera
   - Avoid excessive head movement

3. **Performance Issues**
   - Close other browser tabs
   - Reduce browser zoom level
   - Check CPU usage

### Debug Mode

Add debug logging by setting:
```typescript
localStorage.setItem('eyeTrackingDebug', 'true')
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- MediaPipe team for the face detection models
- React team for the excellent framework
- The open-source community for inspiration and tools

## Future Enhancements

- [ ] Calibration system for improved accuracy
- [ ] Multiple face tracking
- [ ] Export functionality for heatmap data
- [ ] Real-time analytics dashboard
- [ ] Machine learning model optimization
- [ ] Extended browser compatibility