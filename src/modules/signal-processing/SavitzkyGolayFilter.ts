
/**
 * Implementación de filtro Savitzky-Golay para suavizado 
 * preservando características de picos en la señal
 */
export class SavitzkyGolayFilter {
  private readonly coefficients: number[];
  private readonly normFactor: number;
  private buffer: number[] = [];
  private readonly windowSize: number;

  constructor(windowSize: number = 3) { // Mantener ventana mínima para preservar señal original
    // Coeficientes optimizados para preservar picos mucho mejor
    this.windowSize = windowSize;
    this.coefficients = [0.15, 0.7, 0.15]; // Mucho más peso al valor central para preservar picos mejor
    this.normFactor = 0.4; // Reducido drásticamente para preservar más la señal original
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
    
    // Aplicar convolución con coeficientes S-G optimizados
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
