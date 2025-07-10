# Deployment Guide - Eye-Tracking Heatmap Web App

## Development Setup

### Local Development
The app is currently configured to run on HTTP for development purposes. To start:

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

### Important Security Requirements

⚠️ **HTTPS Required for Camera Access** ⚠️

Eye tracking requires camera access, which modern browsers only allow over HTTPS connections. The current HTTP setup will work for UI testing but **will not be able to access the camera**.

## Production Deployment

### Option 1: Deploy to Vercel/Netlify (Recommended)

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel:**
   ```bash
   npm install -g vercel
   vercel --prod
   ```

3. **Deploy to Netlify:**
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod --dir=dist
   ```

Both services provide automatic HTTPS, which is required for camera access.

### Option 2: Self-hosted with HTTPS

To run with HTTPS locally for testing:

1. **Install mkcert (for local SSL certificates):**
   ```bash
   # macOS
   brew install mkcert
   
   # Linux
   sudo apt install libnss3-tools
   wget -O mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
   chmod +x mkcert
   sudo mv mkcert /usr/local/bin/
   ```

2. **Create local certificates:**
   ```bash
   mkcert -install
   mkcert localhost 127.0.0.1 ::1
   ```

3. **Update vite.config.ts:**
   ```typescript
   export default defineConfig({
     // ... other config
     server: {
       https: {
         key: fs.readFileSync('./localhost+2-key.pem'),
         cert: fs.readFileSync('./localhost+2.pem')
       },
       port: 3000,
       host: '0.0.0.0'
     }
   })
   ```

### Option 3: Docker Deployment

1. **Create Dockerfile:**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   RUN npm run build
   EXPOSE 3000
   CMD ["npm", "run", "preview"]
   ```

2. **Build and run:**
   ```bash
   docker build -t eye-tracking-heatmap .
   docker run -p 3000:3000 eye-tracking-heatmap
   ```

## Browser Compatibility

### Supported Browsers
- **Chrome 88+** (Full support, recommended)
- **Safari 14+** (iOS/macOS, with some limitations)
- **Edge 88+** (Full support)
- **Firefox 78+** (Limited MediaPipe support)

### Camera Requirements
- **Desktop:** Webcam required
- **Mobile:** Front-facing camera preferred
- **Permissions:** User must grant camera access

## Performance Considerations

### Minimum Requirements
- **CPU:** Dual-core 1.5GHz+
- **RAM:** 4GB+
- **Camera:** 720p minimum, 1080p preferred
- **Network:** Low latency for real-time processing

### Optimization Tips
1. **Close unnecessary browser tabs**
2. **Use Chrome for best performance**
3. **Ensure good lighting conditions**
4. **Position camera 60-90cm from face**
5. **Minimize background processing**

## Security & Privacy

### Data Privacy
- All processing happens locally in the browser
- No gaze data is transmitted to servers
- No data persistence between sessions
- Camera access is only for real-time processing

### Security Headers
For production deployment, add these headers:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://cdn.jsdelivr.net;
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

## Troubleshooting

### Common Issues

1. **Camera not working**
   - Ensure HTTPS is enabled
   - Check browser permissions
   - Verify camera is not used by other apps

2. **Poor tracking quality**
   - Improve lighting conditions
   - Adjust distance from camera
   - Use Chrome for best results

3. **Performance issues**
   - Close other browser tabs
   - Reduce browser zoom level
   - Check available RAM

### Debug Mode
Enable debug logging:
```javascript
localStorage.setItem('eyeTrackingDebug', 'true')
```

## Environment Variables

For production deployment, you can set:

```bash
# .env
VITE_MEDIAPIPE_CDN=https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh
VITE_TRACKING_CONFIDENCE=0.5
VITE_HEATMAP_RADIUS=30
```

## Monitoring

### Performance Metrics
- FPS counter (visible in UI)
- Memory usage via browser DevTools
- CPU usage monitoring
- Camera stream quality

### Error Tracking
Consider adding error tracking service like Sentry for production:

```bash
npm install @sentry/react
```

## License & Attribution

This project uses:
- MediaPipe (Apache 2.0 License)
- React (MIT License)
- TypeScript (Apache 2.0 License)

Ensure proper attribution when deploying.