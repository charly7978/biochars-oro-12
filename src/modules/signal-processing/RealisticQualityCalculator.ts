
/**
 * Calculador de calidad REAL basado en métricas físicas medidas
 * SIN SIMULACIÓN - Solo cálculos basados en datos reales de la señal
 */
export class RealisticQualityCalculator {
  private snrHistory: number[] = [];
  private signalHistory: number[] = [];
  private noiseHistory: number[] = [];
  private readonly HISTORY_SIZE = 20;
  
  private readonly QUALITY_FACTORS = {
    SNR_WEIGHT: 0.40,           // Relación señal/ruido real
    AMPLITUDE_WEIGHT: 0.25,     // Amplitud de la señal real
    STABILITY_WEIGHT: 0.20,     // Estabilidad temporal real
    CONSISTENCY_WEIGHT: 0.15    // Consistencia de medición real
  };
  
  /**
   * Calcular calidad REAL basada únicamente en métricas medidas
   */
  public calculateRealisticQuality(data: {
    signalValue: number;
    noiseLevel: number;
    stability: number;
    hemoglobinValidity: number;
    textureScore: number;
    temporalConsistency: number;
    isFingerDetected: boolean;
  }): number {
    
    const { signalValue, noiseLevel, stability, hemoglobinValidity, 
            textureScore, temporalConsistency, isFingerDetected } = data;
    
    // Si no hay dedo detectado, calidad basada en ruido de fondo real
    if (!isFingerDetected) {
      return this.calculateBackgroundNoiseQuality(noiseLevel);
    }
    
    // Almacenar datos reales para análisis temporal
    this.signalHistory.push(signalValue);
    this.noiseHistory.push(noiseLevel);
    
    if (this.signalHistory.length > this.HISTORY_SIZE) {
      this.signalHistory.shift();
      this.noiseHistory.shift();
    }
    
    // 1. Calcular SNR real de la señal medida
    const realSNR = this.calculateRealSNR(signalValue, noiseLevel);
    const snrScore = this.mapSNRToQuality(realSNR);
    
    // 2. Calcular amplitud relativa real
    const amplitudeScore = this.calculateRealAmplitudeScore(signalValue);
    
    // 3. Calcular estabilidad real de la señal
    const realStabilityScore = this.calculateRealStability();
    
    // 4. Calcular consistencia temporal real
    const realConsistencyScore = this.calculateRealConsistency();
    
    // 5. Combinar factores con pesos científicos
    const weightedQuality = 
      (snrScore * this.QUALITY_FACTORS.SNR_WEIGHT) +
      (amplitudeScore * this.QUALITY_FACTORS.AMPLITUDE_WEIGHT) +
      (realStabilityScore * this.QUALITY_FACTORS.STABILITY_WEIGHT) +
      (realConsistencyScore * this.QUALITY_FACTORS.CONSISTENCY_WEIGHT);
    
    // 6. Aplicar factores de validación reales
    let finalQuality = weightedQuality * 100;
    
    // Factor de hemoglobina real (sin simulación)
    finalQuality *= (0.7 + hemoglobinValidity * 0.3);
    
    // Factor de textura real (sin simulación)
    finalQuality *= (0.8 + textureScore * 0.2);
    
    // Factor de consistencia temporal real (sin simulación)
    finalQuality *= (0.85 + temporalConsistency * 0.15);
    
    // Limitar a rangos técnicamente posibles
    finalQuality = Math.max(10, Math.min(95, finalQuality));
    
    console.log("RealisticQualityCalculator (100% REAL):", {
      signalValue,
      realSNR: realSNR.toFixed(2),
      snrScore: snrScore.toFixed(2),
      amplitudeScore: amplitudeScore.toFixed(2),
      realStabilityScore: realStabilityScore.toFixed(2),
      realConsistencyScore: realConsistencyScore.toFixed(2),
      finalQuality: Math.round(finalQuality)
    });
    
    return Math.round(finalQuality);
  }
  
  private calculateBackgroundNoiseQuality(noiseLevel: number): number {
    // Calidad basada en nivel de ruido de fondo real medido
    if (noiseLevel > 50) return 0;
    if (noiseLevel > 30) return 5;
    if (noiseLevel > 15) return 10;
    return 15;
  }
  
  private calculateRealSNR(signal: number, noise: number): number {
    if (noise <= 0) noise = 1; // Evitar división por cero
    
    // SNR real en dB
    const snr = 20 * Math.log10(signal / noise);
    
    this.snrHistory.push(snr);
    if (this.snrHistory.length > this.HISTORY_SIZE) {
      this.snrHistory.shift();
    }
    
    return snr;
  }
  
  private mapSNRToQuality(snr: number): number {
    // Mapeo basado en estándares técnicos reales para señales PPG
    if (snr < 5) return 0;      // Señal no utilizable
    if (snr < 10) return 0.2;   // Señal muy pobre
    if (snr < 15) return 0.4;   // Señal pobre
    if (snr < 20) return 0.6;   // Señal aceptable
    if (snr < 25) return 0.8;   // Señal buena
    return 1.0;                 // Señal excelente
  }
  
  private calculateRealAmplitudeScore(currentSignal: number): number {
    if (this.signalHistory.length < 5) return 0.5;
    
    // Calcular amplitud promedio real de las últimas mediciones
    const avgSignal = this.signalHistory.reduce((a, b) => a + b, 0) / this.signalHistory.length;
    
    // Normalizar amplitud relativa (sin simulación)
    const relativeAmplitude = avgSignal / 255; // Normalizar a rango 0-1
    
    return Math.max(0, Math.min(1, relativeAmplitude));
  }
  
  private calculateRealStability(): number {
    if (this.signalHistory.length < 10) return 0.5;
    
    // Calcular variabilidad real de la señal
    const mean = this.signalHistory.reduce((a, b) => a + b, 0) / this.signalHistory.length;
    const variance = this.signalHistory.reduce((acc, val) => acc + (val - mean) ** 2, 0) / this.signalHistory.length;
    const stdDev = Math.sqrt(variance);
    
    // Coeficiente de variación real
    const cv = mean > 0 ? stdDev / mean : 1;
    
    // Mapear CV a score de estabilidad (menor CV = mayor estabilidad)
    if (cv > 0.3) return 0;     // Muy inestable
    if (cv > 0.2) return 0.3;   // Inestable
    if (cv > 0.1) return 0.6;   // Moderadamente estable
    if (cv > 0.05) return 0.8;  // Estable
    return 1.0;                 // Muy estable
  }
  
  private calculateRealConsistency(): number {
    if (this.snrHistory.length < 8) return 0.5;
    
    // Calcular consistencia real del SNR a lo largo del tiempo
    const recentSNR = this.snrHistory.slice(-8);
    const snrMean = recentSNR.reduce((a, b) => a + b, 0) / recentSNR.length;
    const snrVariance = recentSNR.reduce((acc, val) => acc + (val - snrMean) ** 2, 0) / recentSNR.length;
    const snrStdDev = Math.sqrt(snrVariance);
    
    // Consistencia basada en estabilidad del SNR
    const snrCV = snrMean > 0 ? snrStdDev / Math.abs(snrMean) : 1;
    
    if (snrCV > 0.4) return 0;    // Muy inconsistente
    if (snrCV > 0.3) return 0.3;  // Inconsistente
    if (snrCV > 0.2) return 0.6;  // Moderadamente consistente
    if (snrCV > 0.1) return 0.8;  // Consistente
    return 1.0;                   // Muy consistente
  }
  
  /**
   * Obtener descripción textual de la calidad basada en métricas reales
   */
  public getQualityDescription(quality: number): string {
    if (quality >= 80) return "Excelente";
    if (quality >= 65) return "Buena";
    if (quality >= 45) return "Aceptable";
    if (quality >= 25) return "Pobre";
    return "No utilizable";
  }
  
  /**
   * Reset del calculador
   */
  public reset(): void {
    this.snrHistory = [];
    this.signalHistory = [];
    this.noiseHistory = [];
  }
}
