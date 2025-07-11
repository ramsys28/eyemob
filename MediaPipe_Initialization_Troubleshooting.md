# MediaPipe Initialization Failure - Troubleshooting Guide

## Current Error Analysis

**Error**: "MediaPipe initialization failed" / "Failed to Initialize eyetracker"

## Potential Root Causes

### 1. **MediaPipe Package Version Issue**
Your project is using `@mediapipe/tasks-vision@0.10.22-rc.20250304` (Release Candidate), which may be unstable.

### 2. **WASM Loading Failures**
The CDN URLs for WASM files might be failing or incompatible with the RC version.

### 3. **Model Loading Issues**
The face landmarker model URL might be returning 404 or CORS errors.

### 4. **Browser Compatibility**
Some browsers may not fully support the required APIs.

## Immediate Solutions

### Solution 1: Downgrade to Stable MediaPipe Version

**Replace the RC version with the latest stable release:**

```bash
npm uninstall @mediapipe/tasks-vision
npm install @mediapipe/tasks-vision@0.10.11
```

### Solution 2: Fix WASM Loading URLs

**Update the WASM loading strategies in `eyeTracker.ts`:**

```typescript
// Replace the current loadingStrategies with:
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
```

### Solution 3: Update Model URL

**Replace the model URL with a more reliable one:**

```typescript
// In the configs array, replace the modelAssetPath with:
modelAssetPath: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/face_landmarker.task"
```

### Solution 4: Add Network Connectivity Check

**Add network validation before initialization:**

```typescript
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
```

## Quick Fix Implementation

### Step 1: Update Package Version
```bash
npm install @mediapipe/tasks-vision@0.10.11
```

### Step 2: Update Eye Tracker Configuration
The key changes needed in `src/utils/eyeTracker.ts`:

1. **Fix WASM URLs** (lines ~67-85)
2. **Update model URL** (lines ~95-105)
3. **Add network check** (new method)

### Step 3: Add Debug Logging
Enable debug mode in browser console:
```javascript
localStorage.setItem('eyeTrackingDebug', 'true')
```

## Debugging Steps

### 1. **Check Browser Console**
Look for specific error messages:
- WASM loading failures
- Model download errors
- CORS issues
- SharedArrayBuffer warnings

### 2. **Test Browser Compatibility**
- ✅ Chrome 88+ (recommended)
- ✅ Edge 88+ (recommended)  
- ⚠️ Firefox 89+ (limited support)
- ⚠️ Safari 15+ (limited support)

### 3. **Verify Network Access**
Test these URLs in your browser:
- https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/wasm/
- https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/face_landmarker.task

### 4. **Check Cross-Origin Isolation**
In browser console, verify:
```javascript
console.log('Cross-origin isolated:', window.crossOriginIsolated)
console.log('Secure context:', window.isSecureContext)
console.log('SharedArrayBuffer:', typeof SharedArrayBuffer !== 'undefined')
```

## Expected Working Configuration

### Dependencies (package.json)
```json
{
  "dependencies": {
    "@mediapipe/tasks-vision": "^0.10.11"
  }
}
```

### WASM Loading Strategy
```typescript
const loadingStrategies = [
  async () => await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/wasm"
  ),
  async () => await FilesetResolver.forVisionTasks(
    "https://unpkg.com/@mediapipe/tasks-vision@0.10.11/wasm"
  )
]
```

### Model Configuration
```typescript
{
  baseOptions: {
    modelAssetPath: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/face_landmarker.task",
    delegate: "CPU"
  },
  runningMode: "VIDEO",
  numFaces: 1,
  minFaceDetectionConfidence: 0.5,
  minFacePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5
}
```

## Success Indicators

After implementing fixes, you should see:
- ✅ "Browser compatibility check" logged with all true values
- ✅ "WASM loading successful" message
- ✅ "FaceLandmarker created successfully" message
- ✅ "Eye tracker initialization completed successfully"
- ✅ FPS counter shows > 0 when tracking

## Alternative Approach

If the above solutions don't work, consider:

1. **Local WASM Files**: Download and serve WASM files locally
2. **Different MediaPipe Package**: Try `@mediapipe/face_mesh` (deprecated but sometimes more stable)
3. **Fallback Implementation**: Use basic webcam without MediaPipe for testing

## Next Steps

1. **Implement Solution 1** (stable version) first
2. **Test with debug mode** enabled
3. **Check browser console** for specific errors
4. **Try different browsers** if issues persist
5. **Report back** with specific error messages for further assistance

This systematic approach should resolve the MediaPipe initialization failure.