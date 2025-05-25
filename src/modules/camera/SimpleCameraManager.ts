
/**
 * Camera management with working torch functionality - FASE 1: REPARAR GESTIÓN DE CÁMARA
 */
export class SimpleCameraManager {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private onStreamReady?: (stream: MediaStream) => void;
  private onError?: (error: string) => void;
  private retryCount = 0;
  private readonly MAX_RETRIES = 3;
  private torchRetryCount = 0;
  private readonly MAX_TORCH_RETRIES = 5;

  constructor(
    onStreamReady?: (stream: MediaStream) => void,
    onError?: (error: string) => void
  ) {
    this.onStreamReady = onStreamReady;
    this.onError = onError;
  }

  async startCamera(): Promise<boolean> {
    try {
      // FASE 1: Usar constraints básicos sin complicaciones
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
          facingMode: { ideal: 'environment' }
        },
        audio: false
      };

      console.log("SimpleCameraManager: Requesting basic camera access");
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        throw new Error("No video tracks in stream");
      }

      const videoTrack = videoTracks[0];
      
      // FASE 1: Simplificar verificación - no exigir 'live' inmediatamente
      if (!videoTrack || videoTrack.readyState === 'ended') {
        throw new Error("Invalid video track state: " + videoTrack.readyState);
      }

      this.stream = stream;
      this.retryCount = 0;
      this.torchRetryCount = 0;

      console.log("SimpleCameraManager: Camera started successfully", {
        trackState: videoTrack.readyState,
        trackEnabled: videoTrack.enabled
      });

      // FASE 1: Intentar activar torch después de establecer stream
      this.tryEnableTorchWithRetries(videoTrack);

      if (this.onStreamReady) {
        this.onStreamReady(stream);
      }

      return true;
    } catch (error) {
      console.error("SimpleCameraManager: Camera start failed", error);
      
      if (this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        console.log(`SimpleCameraManager: Retrying (${this.retryCount}/${this.MAX_RETRIES})`);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.startCamera();
      }

      if (this.onError) {
        this.onError(error instanceof Error ? error.message : "Camera access failed");
      }
      return false;
    }
  }

  // FASE 1: Implementar torch con reintentos sin fallar el stream
  private async tryEnableTorchWithRetries(videoTrack: MediaStreamTrack): Promise<void> {
    const tryTorch = async (attempt: number): Promise<void> => {
      try {
        const capabilities = (videoTrack as any).getCapabilities();
        
        if (capabilities && capabilities.torch) {
          console.log(`SimpleCameraManager: Torch attempt ${attempt} - capabilities available`);
          
          await (videoTrack as any).applyConstraints({
            advanced: [{ torch: true }]
          });
          
          console.log("SimpleCameraManager: Torch enabled successfully");
          return;
        } else if (attempt === 1) {
          console.log("SimpleCameraManager: Torch not available in capabilities");
        }
      } catch (error) {
        console.warn(`SimpleCameraManager: Torch attempt ${attempt} failed:`, error);
        
        if (attempt < this.MAX_TORCH_RETRIES) {
          setTimeout(() => tryTorch(attempt + 1), 500 * attempt);
        }
      }
    };

    // Intentar inmediatamente y con reintentos
    tryTorch(1);
  }

  isStreamActive(): boolean {
    if (!this.stream) return false;
    
    const videoTrack = this.stream.getVideoTracks()[0];
    return videoTrack && videoTrack.readyState !== 'ended';
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
