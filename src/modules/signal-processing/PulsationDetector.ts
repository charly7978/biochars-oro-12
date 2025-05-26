
/**
 * DETECTOR DE PULSACIÓN REAL - SIN SIMULACIONES
 * Detecta pulsación cardíaca real en la señal
 */

export class PulsationDetector {
  private redHistory: { value: number; timestamp: number }[] = [];
  
  detectPulsation(redValue: number): number {
    this.redHistory.push({ value: redValue, timestamp: Date.now() });
    
    // Mantener ventana de 3 segundos
    const cutoffTime = Date.now() - 3000;
    this.redHistory = this.redHistory.filter(item => item.timestamp > cutoffTime);
    
    if (this.redHistory.length < 60) return 0; // Necesitamos al menos 2 segundos de datos
    
    const values = this.redHistory.map(item => item.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    if (mean < 30) return 0;
    
    // Detectar variabilidad cardíaca
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const cv = Math.sqrt(variance) / mean;
    
    // Rango real de variabilidad cardíaca: 0.01-0.04
    if (cv >= 0.008 && cv <= 0.06) {
      return Math.min(1.0, cv / 0.03);
    }
    
    return 0;
  }
  
  reset(): void {
    this.redHistory = [];
  }
}
