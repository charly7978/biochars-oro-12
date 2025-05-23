
/**
 * Simplified camera management - no complex state tracking
 * Direct stream handling with robust error recovery
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
      // Simple, reliable constraints
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 15, max: 30 },
          facingMode: { ideal: 'environment' }
        },
        audio: false
      };

      console.log("SimpleCameraManager: Requesting camera access");
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Verify stream has active video tracks
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

      console.log("SimpleCameraManager: Camera started successfully", {
        trackState: videoTrack.readyState,
        trackEnabled: videoTrack.enabled,
        constraints: videoTrack.getConstraints()
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
        
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.startCamera();
      }

      if (this.onError) {
        this.onError(error instanceof Error ? error.message : "Camera access failed");
      }
      return false;
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
