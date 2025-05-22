
/**
 * Implementación de filtro Savitzky-Golay para suavizado 
 * preservando características de picos en la señal
 */
export class SavitzkyGolayFilter {
  private readonly coefficients: number[];
  private readonly normFactor: number;
  private buffer: number[] = [];
  private readonly windowSize: number;

  constructor(windowSize: number = 5) { // Reduced window size from 7 to 5 for less filtering
    // Coeficientes para ventana de 5 puntos (polinomio de grado 2) - mucho más sensible
    this.windowSize = windowSize;
    this.coefficients = [0.1, 0.2, 0.4, 0.2, 0.1]; // Even less aggressive coefficients
    this.normFactor = 1.0; // Reduced normalization factor to preserve more signal (was 1.2)
    this.buffer = new Array(windowSize).fill(0);
  }

  filter(value: number): number {
    // Actualizar buffer
    this.buffer.push(value);
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }
    
    if (this.buffer.length < this.windowSize) {
      return value; // No tenemos suficientes puntos
    }
    
    // Aplicar convolución con coeficientes S-G
    let filtered = 0;
    for (let i = 0; i < this.windowSize; i++) {
      filtered += this.buffer[i] * this.coefficients[i];
    }
    
    return filtered / this.normFactor;
  }

  reset(): void {
    this.buffer = new Array(this.windowSize).fill(0);
  }
}
