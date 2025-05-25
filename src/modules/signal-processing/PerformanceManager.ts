
/**
 * Gestor de rendimiento para procesamiento PPG a 60 FPS
 */
export class PerformanceManager {
  private readonly TARGET_FPS = 60;
  private readonly FRAME_TIME_MS = 1000 / this.TARGET_FPS;
  private readonly MAX_PROCESSING_TIME_MS = 12; // 80% del tiempo de frame
  
  private frameStartTime: number = 0;
  private processingTimes: number[] = [];
  private droppedFrames: number = 0;
  private totalFrames: number = 0;
  private lastFrameTime: number = 0;
  private performanceLevel: 'high' | 'medium' | 'low' = 'high';
  
  /**
   * Iniciar medición de frame
   */
  public startFrame(): void {
    this.frameStartTime = performance.now();
    this.totalFrames++;
    
    // Verificar si el frame anterior se ejecutó a tiempo
    if (this.lastFrameTime > 0) {
      const actualFrameTime = this.frameStartTime - this.lastFrameTime;
      if (actualFrameTime > this.FRAME_TIME_MS * 1.5) {
        this.droppedFrames++;
      }
    }
    
    this.lastFrameTime = this.frameStartTime;
  }
  
  /**
   * Finalizar medición de frame
   */
  public endFrame(): boolean {
    const processingTime = performance.now() - this.frameStartTime;
    
    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > 60) {
      this.processingTimes.shift();
    }
    
    // Ajustar nivel de rendimiento dinámicamente
    this.adjustPerformanceLevel();
    
    return processingTime <= this.MAX_PROCESSING_TIME_MS;
  }
  
  /**
   * Obtener configuración de procesamiento según rendimiento
   */
  public getProcessingConfig(): {
    samplingRate: number;
    bufferSize: number;
    filterComplexity: 'simple' | 'medium' | 'complex';
    enabledFeatures: {
      fftAnalysis: boolean;
      kalmanFilter: boolean;
      adaptiveThresholds: boolean;
      temporalValidation: boolean;
    };
  } {
    switch (this.performanceLevel) {
      case 'high':
        return {
          samplingRate: 1, // Procesar cada frame
          bufferSize: 512,
          filterComplexity: 'complex',
          enabledFeatures: {
            fftAnalysis: true,
            kalmanFilter: true,
            adaptiveThresholds: true,
            temporalValidation: true
          }
        };
      
      case 'medium':
        return {
          samplingRate: 2, // Procesar cada 2 frames
          bufferSize: 256,
          filterComplexity: 'medium',
          enabledFeatures: {
            fftAnalysis: true,
            kalmanFilter: true,
            adaptiveThresholds: false,
            temporalValidation: true
          }
        };
      
      case 'low':
        return {
          samplingRate: 3, // Procesar cada 3 frames
          bufferSize: 128,
          filterComplexity: 'simple',
          enabledFeatures: {
            fftAnalysis: false,
            kalmanFilter: true,
            adaptiveThresholds: false,
            temporalValidation: false
          }
        };
    }
  }
  
  /**
   * Verificar si debe procesar el frame actual
   */
  public shouldProcessFrame(): boolean {
    const config = this.getProcessingConfig();
    return this.totalFrames % config.samplingRate === 0;
  }
  
  /**
   * Ajustar nivel de rendimiento dinámicamente
   */
  private adjustPerformanceLevel(): void {
    if (this.processingTimes.length < 30) return;
    
    const avgProcessingTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
    const dropRate = this.droppedFrames / this.totalFrames;
    
    if (avgProcessingTime > this.MAX_PROCESSING_TIME_MS || dropRate > 0.1) {
      // Reducir nivel de rendimiento
      if (this.performanceLevel === 'high') {
        this.performanceLevel = 'medium';
        console.log("PerformanceManager: Ajustando a rendimiento medio");
      } else if (this.performanceLevel === 'medium') {
        this.performanceLevel = 'low';
        console.log("PerformanceManager: Ajustando a rendimiento bajo");
      }
    } else if (avgProcessingTime < this.MAX_PROCESSING_TIME_MS * 0.5 && dropRate < 0.02) {
      // Aumentar nivel de rendimiento
      if (this.performanceLevel === 'low') {
        this.performanceLevel = 'medium';
        console.log("PerformanceManager: Ajustando a rendimiento medio");
      } else if (this.performanceLevel === 'medium') {
        this.performanceLevel = 'high';
        console.log("PerformanceManager: Ajustando a rendimiento alto");
      }
    }
  }
  
  /**
   * Obtener estadísticas de rendimiento
   */
  public getPerformanceStats(): {
    fps: number;
    avgProcessingTime: number;
    dropRate: number;
    performanceLevel: string;
  } {
    const avgProcessingTime = this.processingTimes.length > 0 
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length 
      : 0;
    
    const fps = this.totalFrames > 0 
      ? (this.totalFrames - this.droppedFrames) / (this.totalFrames / this.TARGET_FPS)
      : 0;
    
    return {
      fps: Math.round(fps),
      avgProcessingTime: Math.round(avgProcessingTime * 100) / 100,
      dropRate: Math.round((this.droppedFrames / this.totalFrames) * 10000) / 100,
      performanceLevel: this.performanceLevel
    };
  }
  
  /**
   * Reset estadísticas
   */
  public reset(): void {
    this.processingTimes = [];
    this.droppedFrames = 0;
    this.totalFrames = 0;
    this.lastFrameTime = 0;
    this.performanceLevel = 'high';
  }
}
