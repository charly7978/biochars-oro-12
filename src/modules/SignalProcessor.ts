// Este archivo exporta el PPGSignalProcessor UNIFICADO
import { PPGSignalProcessor as UnifiedPPGSignalProcessor } from './signal-processing/PPGSignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

// Extender la clase unificada
export class PPGSignalProcessor extends UnifiedPPGSignalProcessor {
  private isInitialized: boolean = false;
  
  constructor(
    onSignalReady?: (signal: ProcessedSignal) => void,
    onError?: (error: ProcessingError) => void
  ) {
    console.log("SignalProcessor wrapper UNIFICADO: Constructor", {
      hasSignalReadyCallback: !!onSignalReady,
      hasErrorCallback: !!onError
    });
    
    super(onSignalReady, onError);
    
    setTimeout(() => {
      this.checkInitialization();
    }, 1000);
  }
  
  private checkInitialization() {
    console.log("SignalProcessor wrapper UNIFICADO: checkInitialization");
    if (!this.isInitialized) {
      console.log("⚠️ PPGSignalProcessor UNIFICADO: Inicialización verificada manualmente");
      this.initialize().then(() => {
        console.log("✅ PPGSignalProcessor UNIFICADO: Inicialización manual exitosa");
        this.isInitialized = true;
      }).catch(err => {
        console.error("❌ PPGSignalProcessor UNIFICADO: Error en inicialización manual", err);
      });
    }
  }
  
  async initialize(): Promise<void> {
    console.log("SignalProcessor wrapper UNIFICADO: initialize() called");
    
    if (this.onSignalReady) {
      super.onSignalReady = this.onSignalReady;
    }
    
    if (this.onError) {
      super.onError = this.onError;
    }
    
    const result = await super.initialize();
    this.isInitialized = true;
    return result;
  }

  processFrame(imageData: ImageData): void {
    console.log("SignalProcessor wrapper UNIFICADO: processFrame() called", {
      isInitialized: this.isInitialized,
      hasOnSignalReadyCallback: !!this.onSignalReady,
      imageSize: `${imageData.width}x${imageData.height}`
    });
    
    // Asegurar que los callbacks están correctamente configurados
    if (this.onSignalReady && super.onSignalReady !== this.onSignalReady) {
      console.log("PPGSignalProcessor wrapper UNIFICADO: Actualizando onSignalReady callback");
      super.onSignalReady = this.onSignalReady;
    }
    
    if (this.onError && super.onError !== this.onError) {
      console.log("PPGSignalProcessor wrapper UNIFICADO: Actualizando onError callback");
      super.onError = this.onError;
    }
    
    if (!this.isInitialized) {
      console.log("PPGSignalProcessor UNIFICADO: Inicializando en processFrame");
      this.initialize().then(() => {
        console.log("PPGSignalProcessor UNIFICADO: Inicializado correctamente, procesando frame");
        super.processFrame(imageData);
      }).catch(error => {
        console.error("PPGSignalProcessor UNIFICADO: Error al inicializar", error);
      });
    } else {
      super.processFrame(imageData);
    }
  }
}

export * from './signal-processing/types';
