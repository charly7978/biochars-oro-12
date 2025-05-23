
/**
 * Camera management with working torch functionality
 */
export class SimpleCameraManager {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private onStreamReady?: (stream: MediaStream) => void;
  private onError?: (error: string) => void;
  private retryCount = 0;
  private readonly MAX_RETRIES = 3;

  constructor(
    onStreamReady?: (stream: MediaStream) => void,
    onError?: (error: string) => void
  ) {
    this.onStreamReady = onStreamReady;
    this.onError = onError;
  }

  async startCamera(): Promise<boolean> {
    try {
      // Enhanced constraints for better torch support
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: { exact: 'environment' }, // Force rear camera
          // Add torch constraint from the start
          advanced: [{ torch: true }]
        },
        audio: false
      };

      console.log("SimpleCameraManager: Requesting camera with torch");
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        throw new Error("No video tracks in stream");
      }

      const videoTrack = videoTracks[0];
      if (videoTrack.readyState !== 'live') {
        throw new Error("Video track not live: " + videoTrack.readyState);
      }

      this.stream = stream;
      this.retryCount = 0;

      // Enable torch immediately
      await this.enableTorch(videoTrack);

      console.log("SimpleCameraManager: Camera and torch started successfully", {
        trackState: videoTrack.readyState,
        trackEnabled: videoTrack.enabled,
        capabilities: videoTrack.getCapabilities()
      });

      if (this.onStreamReady) {
        this.onStreamReady(stream);
      }

      return true;
    } catch (error) {
      console.error("SimpleCameraManager: Camera start failed", error);
      
      if (this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        console.log(`SimpleCameraManager: Retrying (${this.retryCount}/${this.MAX_RETRIES})`);
        
        // Wait and retry with fallback constraints
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.startCameraFallback();
      }

      if (this.onError) {
        this.onError(error instanceof Error ? error.message : "Camera access failed");
      }
      return false;
    }
  }

  private async startCameraFallback(): Promise<boolean> {
    try {
      // Fallback without torch constraint
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: { ideal: 'environment' }
        },
        audio: false
      };

      console.log("SimpleCameraManager: Fallback camera request");
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = stream.getVideoTracks()[0];
      
      if (!videoTrack || videoTrack.readyState !== 'live') {
        throw new Error("Fallback camera failed");
      }

      this.stream = stream;
      
      // Try to enable torch after getting stream
      setTimeout(() => this.enableTorch(videoTrack), 500);

      if (this.onStreamReady) {
        this.onStreamReady(stream);
      }

      return true;
    } catch (error) {
      console.error("SimpleCameraManager: Fallback failed", error);
      if (this.onError) {
        this.onError("Camera fallback failed");
      }
      return false;
    }
  }

  private async enableTorch(videoTrack: MediaStreamTrack): Promise<void> {
    try {
      const capabilities = (videoTrack as any).getCapabilities();
      console.log("SimpleCameraManager: Camera capabilities", capabilities);
      
      if (capabilities && capabilities.torch) {
        console.log("SimpleCameraManager: Torch available, enabling...");
        
        await (videoTrack as any).applyConstraints({
          advanced: [{ torch: true }]
        });
        
        console.log("SimpleCameraManager: Torch enabled successfully");
      } else {
        console.log("SimpleCameraManager: Torch not available on this device");
      }
    } catch (error) {
      console.warn("SimpleCameraManager: Failed to enable torch:", error);
      
      // Try alternative torch method
      try {
        await (videoTrack as any).applyConstraints({
          torch: true
        });
        console.log("SimpleCameraManager: Torch enabled with alternative method");
      } catch (altError) {
        console.warn("SimpleCameraManager: Alternative torch method also failed:", altError);
      }
    }
  }

  isStreamActive(): boolean {
    if (!this.stream) return false;
    
    const videoTrack = this.stream.getVideoTracks()[0];
    return videoTrack && videoTrack.readyState === 'live';
  }

  getStream(): MediaStream | null {
    return this.isStreamActive() ? this.stream : null;
  }

  stopCamera(): void {
    console.log("SimpleCameraManager: Stopping camera");
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  setVideoElement(videoElement: HTMLVideoElement): void {
    this.videoElement = videoElement;
    if (this.stream && this.videoElement) {
      this.videoElement.srcObject = this.stream;
    }
  }
}
