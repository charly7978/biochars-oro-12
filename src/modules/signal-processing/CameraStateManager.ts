
/**
 * Camera state management and error recovery
 */
export class CameraStateManager {
  private videoTrack: MediaStreamTrack | null = null;
  private stream: MediaStream | null = null;
  private onTrackInvalid?: () => void;
  private onStreamReady?: (stream: MediaStream) => void;
  private checkInterval: number | null = null;
  private isActive: boolean = false;

  constructor(
    onTrackInvalid?: () => void,
    onStreamReady?: (stream: MediaStream) => void
  ) {
    this.onTrackInvalid = onTrackInvalid;
    this.onStreamReady = onStreamReady;
  }

  setStream(stream: MediaStream): void {
    console.log("CameraStateManager: Setting new stream");
    
    // Clean up previous stream
    this.cleanup();
    
    this.stream = stream;
    this.videoTrack = stream.getVideoTracks()[0] || null;
    this.isActive = true;
    
    if (this.videoTrack) {
      console.log("CameraStateManager: Video track available, starting monitoring");
      
      // Start monitoring after a short delay to ensure track is stable
      setTimeout(() => {
        if (this.isActive && this.videoTrack) {
          this.startTrackMonitoring();
          this.enableTorch();
        }
      }, 500);
    } else {
      console.error("CameraStateManager: No video track found in stream");
    }
    
    if (this.onStreamReady) {
      this.onStreamReady(stream);
    }
  }

  private startTrackMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = window.setInterval(() => {
      if (!this.isActive) {
        this.stopMonitoring();
        return;
      }

      if (this.videoTrack && this.videoTrack.readyState !== 'live') {
        console.warn('CameraStateManager: Track is no longer live:', this.videoTrack.readyState);
        if (this.onTrackInvalid) {
          this.onTrackInvalid();
        }
        this.stopMonitoring();
      }
    }, 2000); // Check every 2 seconds instead of 1
  }

  private enableTorch(): void {
    if (!this.videoTrack || !this.isActive) return;

    try {
      const capabilities = (this.videoTrack as any).getCapabilities();
      if (capabilities?.torch) {
        console.log("CameraStateManager: Torch available, attempting to enable");
        
        // Add delay before enabling torch to ensure track is ready
        setTimeout(() => {
          if (this.videoTrack && this.isActive && this.videoTrack.readyState === 'live') {
            (this.videoTrack as any).applyConstraints({
              advanced: [{ torch: true }]
            }).then(() => {
              console.log("CameraStateManager: Torch enabled successfully");
            }).catch((err: any) => {
              console.warn("CameraStateManager: Could not enable torch:", err);
            });
          }
        }, 1000);
      } else {
        console.log("CameraStateManager: Torch not available on this device");
      }
    } catch (err) {
      console.warn("CameraStateManager: Error checking torch capabilities:", err);
    }
  }

  isTrackValid(): boolean {
    return this.isActive && this.videoTrack?.readyState === 'live';
  }

  getVideoTrack(): MediaStreamTrack | null {
    return this.isTrackValid() ? this.videoTrack : null;
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  cleanup(): void {
    console.log("CameraStateManager: Cleaning up");
    this.isActive = false;
    this.stopMonitoring();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          console.warn("Error stopping track:", err);
        }
      });
    }
    
    this.videoTrack = null;
    this.stream = null;
  }
}
