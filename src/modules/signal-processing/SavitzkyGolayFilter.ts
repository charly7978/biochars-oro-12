
/**
 * Implementación de filtro Savitzky-Golay para suavizado 
 * preservando características de picos en la señal
 */
export class SavitzkyGolayFilter {
  private readonly coefficients: number[];
  private readonly normFactor: number;
  private buffer: number[] = [];
  private readonly windowSize: number;

  constructor(windowSize: number = 3) { // Further reduced from 5 to 3 for minimal filtering
    // Coeficientes para ventana de 3 puntos (polinomio de grado 1) - mucho más sensible
    this.windowSize = windowSize;
    this.coefficients = [0.33, 0.34, 0.33]; // Even simpler coefficients - almost no filtering
    this.normFactor = 0.8; // Further reduced normalization to preserve even more signal (was 1.0)
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
