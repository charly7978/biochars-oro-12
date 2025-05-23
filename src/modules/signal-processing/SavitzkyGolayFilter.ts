
/**
 * Implementación de filtro Savitzky-Golay para suavizado 
 * preservando características de picos en la señal
 */
export class SavitzkyGolayFilter {
  private readonly coefficients: number[];
  private readonly normFactor: number;
  private buffer: number[] = [];
  private readonly windowSize: number;

  constructor(windowSize: number = 3) { // Mantener en 3 para filtrado mínimo
    // Coeficientes para ventana de 3 puntos (polinomio de grado 1) - muy sensible
    this.windowSize = windowSize;
    this.coefficients = [0.25, 0.5, 0.25]; // Coeficientes más centrados para preservar picos mejor
    this.normFactor = 0.65; // Reducido aún más para preservar más señal (era 0.7)
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
