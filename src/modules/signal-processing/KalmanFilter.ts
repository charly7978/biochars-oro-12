
/**
 * Implementación de Filtro Kalman para procesamiento de señal
 */
export class KalmanFilter {
  private R: number = 0.05; // Reducido de 0.09 a 0.05 - Menor varianza de medición (más confianza en señal original)
  private Q: number = 1.2;  // Aumentado de 0.8 a 1.2 - Mayor varianza del proceso (permite cambios mucho más bruscos)
  private P: number = 1;    // Covarianza del error estimado
  private X: number = 0;    // Estado estimado
  private K: number = 0;    // Ganancia de Kalman

  filter(measurement: number): number {
    // Predicción
    this.P = this.P + this.Q;
    
    // Actualización
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    
    return this.X;
  }

  reset() {
    this.X = 0;
    this.P = 1;
  }
}
