# Bug Fix: "Cannot read properties of null (reading 'videoWidth')" Error

## Problem Description

The application was encountering a JavaScript runtime error:
```
Cannot read properties of null (reading 'videoWidth')
```

This error occurred when the code tried to access the `videoWidth` property on a null video element reference.

## Root Cause Analysis

The error was happening in multiple locations:

1. **In `src/utils/eyeTracker.ts`**: The `this.videoElement` reference was being accessed without null checks
2. **In `src/components/EyeTrackingHeatmap.tsx`**: The `videoRef.current` was being accessed without proper null guards

### Specific Problem Areas:

1. **Camera Initialization**: When logging video dimensions during camera setup
2. **Video Ready Check**: When checking if video has valid dimensions during initialization
3. **Detection Loop**: When validating video state before processing frames
4. **Face Detection**: When extracting landmark coordinates from video frames
5. **Debug Logging**: When displaying video information in debug mode

## Solution Implementation

### 1. Added Null Checks in EyeTracker Class

**File**: `src/utils/eyeTracker.ts`

#### Camera Initialization Fix:
```typescript
// Before:
console.log('Camera initialized successfully - Video dimensions:', 
  this.videoElement.videoWidth, 'x', this.videoElement.videoHeight)

if (this.videoElement.videoWidth === 0 || this.videoElement.videoHeight === 0) {
  throw new Error('Video stream has invalid dimensions. Camera may not be working properly.')
}

// After:
console.log('Camera initialized successfully - Video dimensions:', 
  this.videoElement?.videoWidth || 0, 'x', this.videoElement?.videoHeight || 0)

if (!this.videoElement || this.videoElement.videoWidth === 0 || this.videoElement.videoHeight === 0) {
  throw new Error('Video stream has invalid dimensions. Camera may not be working properly.')
}
```

#### Video Ready Check Fix:
```typescript
// Before:
const hasValidDimensions = this.videoElement.videoWidth > 0 && this.videoElement.videoHeight > 0
const isReadyState = this.videoElement.readyState >= 2
const isPlaying = !this.videoElement.paused && !this.videoElement.ended

// After:
const hasValidDimensions = this.videoElement && this.videoElement.videoWidth > 0 && this.videoElement.videoHeight > 0
const isReadyState = this.videoElement && this.videoElement.readyState >= 2
const isPlaying = this.videoElement && !this.videoElement.paused && !this.videoElement.ended
```

#### Detection Loop Fix:
```typescript
// Before:
if (this.videoElement.readyState < 2) {
  console.log('Video not ready, readyState:', this.videoElement.readyState)
  return
}

// After:
if (!this.videoElement || this.videoElement.readyState < 2) {
  console.log('Video not ready, readyState:', this.videoElement?.readyState || 'N/A')
  return
}
```

#### Face Detection Fix:
```typescript
// Added validation at the beginning of extractFaceDetection method:
if (!this.videoElement || this.videoElement.videoWidth === 0 || this.videoElement.videoHeight === 0) {
  console.warn('Video element not available or has invalid dimensions')
  return null
}
```

### 2. Added Null Checks in React Component

**File**: `src/components/EyeTrackingHeatmap.tsx`

#### Initialization Logging Fix:
```typescript
// Before:
console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight)

// After:
console.log('Video dimensions:', videoRef.current?.videoWidth || 0, 'x', videoRef.current?.videoHeight || 0)
```

#### Debug Logging Fix:
```typescript
// Before:
console.log('Video not ready for tracking - readyState:', videoRef.current?.readyState, 
  'dimensions:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight)

// After:
console.log('Video not ready for tracking - readyState:', videoRef.current?.readyState || 'N/A', 
  'dimensions:', videoRef.current?.videoWidth || 0, 'x', videoRef.current?.videoHeight || 0)
```

## Prevention Measures

### 1. **Defensive Programming**
- Always check for null/undefined references before accessing object properties
- Use optional chaining (`?.`) when accessing potentially null objects
- Provide fallback values using the nullish coalescing operator (`|| 0`)

### 2. **Early Validation**
- Validate video element existence at the beginning of methods that rely on it
- Return early with appropriate error handling when validation fails

### 3. **Consistent Error Handling**
- Use consistent patterns for null checks across the codebase
- Provide meaningful error messages and fallback values

## Testing Recommendations

1. **Test video element lifecycle**: Ensure the fix works during component mounting/unmounting
2. **Test camera initialization failures**: Verify proper error handling when camera is not available
3. **Test rapid state changes**: Ensure null checks handle quick transitions between states
4. **Test browser compatibility**: Verify the fix works across different browsers

## Impact

This fix prevents the application from crashing when:
- The video element is not yet initialized
- The camera fails to initialize properly
- The component is unmounted while video processing is ongoing
- The video stream becomes unavailable during runtime

The application now gracefully handles these edge cases and provides meaningful debug information instead of throwing runtime errors.