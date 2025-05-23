
// Updated wrapper to use the new SimplifiedPPGProcessor
import { SimplifiedPPGProcessor } from './signal-processing/SimplifiedPPGProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

// Extend the simplified processor
export class PPGSignalProcessor extends SimplifiedPPGProcessor {
  private isInitialized: boolean = false;
  
  constructor(
    onSignalReady?: (signal: ProcessedSignal) => void,
    onError?: (error: ProcessingError) => void
  ) {
    console.log("[DIAG] SignalProcessor wrapper: Constructor (using SimplifiedPPGProcessor)", {
      hasSignalReadyCallback: !!onSignalReady,
      hasErrorCallback: !!onError
    });
    
    super(onSignalReady, onError);
    
    setTimeout(() => {
      this.checkInitialization();
    }, 1000);
  }
  
  private checkInitialization() {
    console.log("[DIAG] SignalProcessor wrapper: checkInitialization", { isInitialized: this.isInitialized });
    if (!this.isInitialized) {
      console.log("⚠️ PPGSignalProcessor: Inicialización verificada manualmente");
      this.initialize().then(() => {
        console.log("✅ PPGSignalProcessor: Inicialización manual exitosa");
        this.isInitialized = true;
      }).catch(err => {
        console.error("❌ PPGSignalProcessor: Error en inicialización manual", err);
      });
    }
  }
  
  async initialize(): Promise<void> {
    console.log("[DIAG] SignalProcessor wrapper: initialize() called");
    const result = await super.initialize();
    this.isInitialized = true;
    return result;
  }

  processFrame(imageData: ImageData): void {
    console.log("[DIAG] SignalProcessor wrapper: processFrame() called", {
      isInitialized: this.isInitialized,
      hasOnSignalReadyCallback: !!this.onSignalReady,
      imageSize: `${imageData.width}x${imageData.height}`
    });
    
    if (!this.isInitialized) {
      console.log("PPGSignalProcessor: Inicializando en processFrame");
      this.initialize().then(() => {
        console.log("PPGSignalProcessor: Inicializado correctamente, procesando frame");
        super.processFrame(imageData);
      }).catch(error => {
        console.error("PPGSignalProcessor: Error al inicializar", error);
      });
    } else {
      super.processFrame(imageData);
    }
  }
}

// Re-export types
export * from './signal-processing/types';
