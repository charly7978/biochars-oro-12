
/**
 * Detector de ruido de fondo robusto
 * Determina el ambiente base antes de procesar cualquier señal
 */
export class NoiseDetector {
  private backgroundHistogram: number[] = [];
  private environmentalNoise: number = 0;
  private calibrationFrames: number = 0;
  private readonly CALIBRATION_REQUIRED = 30;
  private readonly HISTOGRAM_BINS = 256;
  private readonly NOISE_PERCENTILE = 15; // Más estricto que percentil 25
  
  /**
   * Actualizar histograma de fondo con nuevo frame
   */
  public updateBackground(imageData: ImageData): void {
    if (this.calibrationFrames >= this.CALIBRATION_REQUIRED) return;
    
    const { data, width, height } = imageData;
    const samples: number[] = [];
    
    // Muestrear esquinas y bordes donde típicamente no hay dedo
    const sampleRegions = [
      { x: 0, y: 0, w: Math.floor(width * 0.1), h: Math.floor(height * 0.1) },
      { x: width - Math.floor(width * 0.1), y: 0, w: Math.floor(width * 0.1), h: Math.floor(height * 0.1) },
      { x: 0, y: height - Math.floor(height * 0.1), w: Math.floor(width * 0.1), h: Math.floor(height * 0.1) },
      { x: width - Math.floor(width * 0.1), y: height - Math.floor(height * 0.1), w: Math.floor(width * 0.1), h: Math.floor(height * 0.1) }
    ];
    
    for (const region of sampleRegions) {
      for (let y = region.y; y < region.y + region.h; y += 2) {
        for (let x = region.x; x < region.x + region.w; x += 2) {
          const index = (y * width + x) * 4;
          const luminance = (data[index] + data[index + 1] + data[index + 2]) / 3;
          samples.push(luminance);
        }
      }
    }
    
    this.backgroundHistogram.push(...samples);
    this.calibrationFrames++;
    
    if (this.calibrationFrames === this.CALIBRATION_REQUIRED) {
      this.calculateEnvironmentalNoise();
    }
  }
  
  /**
   * Calcular ruido ambiental real basado en histograma
   */
  private calculateEnvironmentalNoise(): void {
    if (this.backgroundHistogram.length === 0) return;
    
    this.backgroundHistogram.sort((a, b) => a - b);
    const index = Math.floor(this.backgroundHistogram.length * (this.NOISE_PERCENTILE / 100));
    this.environmentalNoise = this.backgroundHistogram[index];
    
    console.log("NoiseDetector: Ruido ambiental calibrado:", {
      environmentalNoise: this.environmentalNoise,
      samples: this.backgroundHistogram.length,
      min: this.backgroundHistogram[0],
      max: this.backgroundHistogram[this.backgroundHistogram.length - 1]
    });
  }
  
  /**
   * Verificar si una señal supera significativamente el ruido de fondo
   */
  public isAboveNoiseFloor(redValue: number): boolean {
    if (this.calibrationFrames < this.CALIBRATION_REQUIRED) {
      return redValue > 45; // Umbral temporal durante calibración
    }
    
    const noiseThreshold = this.environmentalNoise * 2.5; // Debe superar 2.5x el ruido
    const minimumSignal = 50; // Mínimo absoluto
    
    return redValue > Math.max(noiseThreshold, minimumSignal);
  }
  
  /**
   * Obtener nivel de ruido actual
   */
  public getNoiseLevel(): number {
    return this.environmentalNoise;
  }
  
  /**
   * Verificar si la calibración está completa
   */
  public isCalibrated(): boolean {
    return this.calibrationFrames >= this.CALIBRATION_REQUIRED;
  }
  
  /**
   * Reset del detector
   */
  public reset(): void {
    this.backgroundHistogram = [];
    this.environmentalNoise = 0;
    this.calibrationFrames = 0;
  }
}
