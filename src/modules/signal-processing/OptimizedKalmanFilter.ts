
/**
 * Filtro Kalman optimizado con parámetros adaptativos
 */
export class OptimizedKalmanFilter {
  private R: number; // Varianza de medición
  private Q: number; // Varianza del proceso
  private P: number = 1; // Covarianza del error
  private X: number = 0; // Estado estimado
  private K: number = 0; // Ganancia de Kalman
  
  private measurementHistory: number[] = [];
  private readonly ADAPTATION_WINDOW = 20;
  
  constructor(initialR: number = 0.01, initialQ: number = 0.1) {
    this.R = initialR;
    this.Q = initialQ;
  }
  
  /**
   * Filtrado con adaptación automática de parámetros
   */
  public filter(measurement: number): number {
    // Guardar historial para adaptación
    this.measurementHistory.push(measurement);
    if (this.measurementHistory.length > this.ADAPTATION_WINDOW) {
      this.measurementHistory.shift();
    }
    
    // Adaptar parámetros cada cierto número de mediciones
    if (this.measurementHistory.length >= this.ADAPTATION_WINDOW && 
        this.measurementHistory.length % 10 === 0) {
      this.adaptParameters();
    }
    
    // Predicción
    this.P = this.P + this.Q;
    
    // Actualización
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    
    return this.X;
  }
  
  /**
   * Adaptación automática de parámetros basada en estadísticas de la señal
   */
  private adaptParameters(): void {
    if (this.measurementHistory.length < this.ADAPTATION_WINDOW) return;
    
    // Calcular varianza de las mediciones recientes
    const mean = this.measurementHistory.reduce((a, b) => a + b, 0) / this.measurementHistory.length;
    const variance = this.measurementHistory.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.measurementHistory.length;
    
    // Adaptar R basado en la varianza observada
    this.R = Math.max(0.001, Math.min(0.1, variance / 1000));
    
    // Adaptar Q basado en la estabilidad de la señal
    const differences = [];
    for (let i = 1; i < this.measurementHistory.length; i++) {
      differences.push(Math.abs(this.measurementHistory[i] - this.measurementHistory[i-1]));
    }
    const avgDifference = differences.reduce((a, b) => a + b, 0) / differences.length;
    
    this.Q = Math.max(0.01, Math.min(0.5, avgDifference / 100));
    
    console.log("OptimizedKalmanFilter: Parámetros adaptados - R:", this.R.toFixed(4), "Q:", this.Q.toFixed(4));
  }
  
  public reset(): void {
    this.X = 0;
    this.P = 1;
    this.measurementHistory = [];
  }
  
  public getParameters(): { R: number; Q: number; P: number; K: number } {
    return { R: this.R, Q: this.Q, P: this.P, K: this.K };
  }
}
