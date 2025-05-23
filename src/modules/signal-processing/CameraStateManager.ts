
/**
 * Camera state management and error recovery
 */
export class CameraStateManager {
  private videoTrack: MediaVideoTrack | null = null;
  private stream: MediaStream | null = null;
  private onTrackInvalid?: () => void;
  private onStreamReady?: (stream: MediaStream) => void;
  private checkInterval: number | null = null;

  constructor(
    onTrackInvalid?: () => void,
    onStreamReady?: (stream: MediaStream) => void
  ) {
    this.onTrackInvalid = onTrackInvalid;
    this.onStreamReady = onStreamReady;
  }

  setStream(stream: MediaStream): void {
    this.stream = stream;
    this.videoTrack = stream.getVideoTracks()[0] || null;
    
    if (this.videoTrack) {
      // Monitor track state
      this.startTrackMonitoring();
      
      // Enable torch if available
      this.enableTorch();
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
      if (this.videoTrack && this.videoTrack.readyState !== 'live') {
        console.warn('CameraStateManager: Track is no longer live:', this.videoTrack.readyState);
        if (this.onTrackInvalid) {
          this.onTrackInvalid();
        }
        this.stopMonitoring();
      }
    }, 1000);
  }

  private enableTorch(): void {
    if (this.videoTrack && this.videoTrack.getCapabilities()?.torch) {
      this.videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).catch(err => console.warn("Could not enable torch:", err));
    }
  }

  isTrackValid(): boolean {
    return this.videoTrack?.readyState === 'live';
  }

  getVideoTrack(): MediaVideoTrack | null {
    return this.isTrackValid() ? this.videoTrack : null;
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  cleanup(): void {
    this.stopMonitoring();
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.videoTrack = null;
    this.stream = null;
  }
}
