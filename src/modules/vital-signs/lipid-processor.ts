export interface LipidProfile {
  totalCholesterol: number;
  triglycerides: number;
  hdlCholesterol: number;
  ldlCholesterol: number;
  vldlCholesterol: number;
  risk: 'low' | 'moderate' | 'high';
}

export class LipidProcessor {
  private lipidHistory: { cholesterol: number; triglycerides: number }[] = [];
  private baselineCholesterol: number = 180; // mg/dL normal
  private baselineTriglycerides: number = 120; // mg/dL normal
  private isCalibrated: boolean = false;
  
  /**
   * Calcula perfil lipídico usando análisis avanzado de PPG
   */
  public calculateLipids(ppgValues: number[]): LipidProfile {
    if (ppgValues.length < 60) {
      return this.getDefaultProfile();
    }
    
    // Análisis de viscosidad sanguínea mediante PPG
    const viscosityIndex = this.calculateBloodViscosityIndex(ppgValues);
    
    // Análisis de resistencia vascular periférica
    const peripheralResistance = this.calculatePeripheralResistance(ppgValues);
    
    // Análisis de elasticidad arterial
    const arterialElasticity = this.calculateArterialElasticity(ppgValues);
    
    // Cálculo de colesterol total
    let totalCholesterol = this.baselineCholesterol;
    totalCholesterol += viscosityIndex * 25;
    totalCholesterol += peripheralResistance * 20;
    totalCholesterol -= arterialElasticity * 15;
    
    // Cálculo de triglicéridos
    let triglycerides = this.baselineTriglycerides;
    triglycerides += viscosityIndex * 30;
    triglycerides += this.getPostprandialAdjustment();
    
    // Aplicar filtros temporales
    totalCholesterol = this.applyLipidTemporalFilter(totalCholesterol, 'cholesterol');
    triglycerides = this.applyLipidTemporalFilter(triglycerides, 'triglycerides');
    
    // Calcular otros componentes del perfil lipídico
    const hdlCholesterol = this.calculateHDL(totalCholesterol, arterialElasticity);
    const vldlCholesterol = triglycerides / 5; // Regla de Friedewald simplificada
    const ldlCholesterol = totalCholesterol - hdlCholesterol - vldlCholesterol;
    
    // Aplicar límites fisiológicos
    const profile: LipidProfile = {
      totalCholesterol: Math.max(120, Math.min(350, Math.round(totalCholesterol))),
      triglycerides: Math.max(50, Math.min(500, Math.round(triglycerides))),
      hdlCholesterol: Math.max(25, Math.min(100, Math.round(hdlCholesterol))),
      ldlCholesterol: Math.max(50, Math.min(250, Math.round(ldlCholesterol))),
      vldlCholesterol: Math.max(5, Math.min(50, Math.round(vldlCholesterol))),
      risk: this.calculateCardiovascularRisk(totalCholesterol, hdlCholesterol, ldlCholesterol)
    };
    
    return profile;
  }
  
  private calculateBloodViscosityIndex(values: number[]): number {
    // La viscosidad afecta la forma de onda PPG
    const morphologyAnalysis = this.analyzePulseMorphology(values);
    const flowResistance = this.calculateFlowResistance(values);
    
    // Índice combinado de viscosidad
    const viscosityIndex = (morphologyAnalysis.sluggishness + flowResistance) / 2;
    
    // Normalizar a rango -1 a 1
    return Math.max(-1, Math.min(1, viscosityIndex));
  }
  
  private analyzePulseMorphology(values: number[]): { sluggishness: number } {
    let totalSlope = 0;
    let peakCount = 0;
    
    // Analizar pendientes de subida de pulsos
    for (let i = 2; i < values.length - 2; i++) {
      if (this.isPeakPoint(values, i)) {
        // Calcular pendiente promedio de subida
        let upstrokeSlope = 0;
        let slopeCount = 0;
        
        for (let j = Math.max(0, i - 10); j < i; j++) {
          if (j > 0) {
            upstrokeSlope += values[j] - values[j-1];
            slopeCount++;
          }
        }
        
        if (slopeCount > 0) {
          totalSlope += upstrokeSlope / slopeCount;
          peakCount++;
        }
      }
    }
    
    const avgSlope = peakCount > 0 ? totalSlope / peakCount : 0;
    
    // Convertir pendiente a índice de "sluggishness"
    const sluggishness = Math.max(-1, Math.min(1, -avgSlope / 10));
    
    return { sluggishness };
  }
  
  private calculateFlowResistance(values: number[]): number {
    // Calcular tiempo de tránsito aparente
    const peaks = this.findPeaks(values);
    if (peaks.length < 2) return 0;
    
    let totalTransitTime = 0;
    let transitCount = 0;
    
    for (let i = 1; i < peaks.length; i++) {
      const interval = peaks[i] - peaks[i-1];
      if (interval > 10 && interval < 50) { // Filtrar intervalos válidos
        totalTransitTime += interval;
        transitCount++;
      }
    }
    
    if (transitCount === 0) return 0;
    
    const avgTransitTime = totalTransitTime / transitCount;
    const expectedTransitTime = 25; // Valor típico para 30 FPS
    
    // Resistencia basada en desviación del tiempo esperado
    return Math.max(-1, Math.min(1, (avgTransitTime - expectedTransitTime) / 10));
  }
  
  private calculatePeripheralResistance(values: number[]): number {
    // Analizar la forma de onda diastólica
    const diastolicDecay = this.analyzeDiastolicDecay(values);
    
    // Calcular índice de reflexión de ondas
    const reflectionIndex = this.calculateWaveReflectionIndex(values);
    
    // Combinar métricas
    return (diastolicDecay + reflectionIndex) / 2;
  }
  
  private analyzeDiastolicDecay(values: number[]): number {
    const peaks = this.findPeaks(values);
    let totalDecayRate = 0;
    let validDecays = 0;
    
    for (const peak of peaks) {
      // Analizar declive diastólico después del pico
      const decayRate = this.calculateDecayRate(values, peak);
      if (decayRate !== null) {
        totalDecayRate += decayRate;
        validDecays++;
      }
    }
    
    if (validDecays === 0) return 0;
    
    const avgDecayRate = totalDecayRate / validDecays;
    
    // Mapear a índice de resistencia (-1 a 1)
    return Math.max(-1, Math.min(1, (avgDecayRate - 0.5) * 2));
  }
  
  private calculateDecayRate(values: number[], peakIndex: number): number | null {
    if (peakIndex >= values.length - 10) return null;
    
    const peakValue = values[peakIndex];
    let decaySum = 0;
    let decayCount = 0;
    
    // Analizar los siguientes 8 puntos después del pico
    for (let i = 1; i <= 8 && peakIndex + i < values.length; i++) {
      const currentValue = values[peakIndex + i];
      const decay = (peakValue - currentValue) / peakValue;
      decaySum += decay;
      decayCount++;
    }
    
    return decayCount > 0 ? decaySum / decayCount : null;
  }
  
  private calculateWaveReflectionIndex(values: number[]): number {
    // Buscar muescas dicrotas y ondas reflejadas
    let reflectionScore = 0;
    const peaks = this.findPeaks(values);
    
    for (const peak of peaks) {
      // Buscar muesca dicrota después del pico
      const dicroticNotch = this.findDicroticNotch(values, peak);
      if (dicroticNotch !== null) {
        reflectionScore += 0.3;
      }
      
      // Analizar componente de onda reflejada
      const reflectedWave = this.analyzeReflectedWave(values, peak);
      reflectionScore += reflectedWave * 0.7;
    }
    
    return Math.max(-1, Math.min(1, reflectionScore / Math.max(peaks.length, 1)));
  }
  
  private findDicroticNotch(values: number[], peakIndex: number): number | null {
    // Buscar mínimo local después del pico sistólico
    for (let i = peakIndex + 3; i < Math.min(values.length - 2, peakIndex + 15); i++) {
      if (values[i] < values[i-1] && values[i] < values[i+1] &&
          values[i] < values[peakIndex] * 0.7) {
        return i;
      }
    }
    return null;
  }
  
  private analyzeReflectedWave(values: number[], peakIndex: number): number {
    // Analizar la presencia de ondas reflejadas en la fase diastólica
    let reflectionStrength = 0;
    
    for (let i = peakIndex + 5; i < Math.min(values.length - 5, peakIndex + 20); i++) {
      // Buscar incrementos que podrían indicar ondas reflejadas
      const localSlope = values[i + 1] - values[i];
      if (localSlope > 0) {
        reflectionStrength += localSlope;
      }
    }
    
    return Math.max(0, Math.min(1, reflectionStrength / 10));
  }
  
  private calculateArterialElasticity(values: number[]): number {
    // La elasticidad arterial afecta la velocidad de propagación de ondas
    const pulsePropagation = this.analyzePulsePropagation(values);
    const arterialCompliance = this.calculateArterialCompliance(values);
    
    return (pulsePropagation + arterialCompliance) / 2;
  }
  
  private analyzePulsePropagation(values: number[]): number {
    // Analizar la velocidad aparente de propagación del pulso
    const peaks = this.findPeaks(values);
    if (peaks.length < 2) return 0;
    
    let totalVelocity = 0;
    let velocityCount = 0;
    
    for (let i = 1; i < peaks.length; i++) {
      const interval = peaks[i] - peaks[i-1];
      if (interval > 15 && interval < 45) {
        // Velocidad aparente (inversa del intervalo)
        const velocity = 30 / interval; // 30 FPS normalizado
        totalVelocity += velocity;
        velocityCount++;
      }
    }
    
    if (velocityCount === 0) return 0;
    
    const avgVelocity = totalVelocity / velocityCount;
    const expectedVelocity = 1.2; // Valor de referencia
    
    // Mapear a índice de elasticidad
    return Math.max(-1, Math.min(1, (avgVelocity - expectedVelocity) / 0.5));
  }
  
  private calculateArterialCompliance(values: number[]): number {
    // Compliance basada en la relación pulso/amplitud
    const peaks = this.findPeaks(values);
    const valleys = this.findValleys(values);
    
    if (peaks.length === 0 || valleys.length === 0) return 0;
    
    const avgPeak = peaks.reduce((sum, p) => sum + values[p], 0) / peaks.length;
    const avgValley = valleys.reduce((sum, v) => sum + values[v], 0) / valleys.length;
    
    const pulseAmplitude = avgPeak - avgValley;
    const meanPressure = (avgPeak + avgValley) / 2;
    
    // Compliance relativa
    const compliance = pulseAmplitude / Math.max(meanPressure, 1);
    
    return Math.max(-1, Math.min(1, (compliance - 0.3) * 3));
  }
  
  // ADVERTENCIA: Esta función es duplicada. Existe una función centralizada y robusta detectPeaks en src/modules/signal-processing/SignalAnalyzer.ts
  // TODO: Migrar todo el pipeline a usar detectPeaks para evitar inconsistencias.
  private findPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    for (let i = 2; i < values.length - 2; i++) {
      if (this.isPeakPoint(values, i)) {
        peaks.push(i);
      }
    }
    return peaks;
  }
  
  private findValleys(values: number[]): number[] {
    const valleys: number[] = [];
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] < values[i-1] && values[i] < values[i+1] &&
          values[i] < values[i-2] && values[i] < values[i+2]) {
        valleys.push(i);
      }
    }
    return valleys;
  }
  
  private isPeakPoint(values: number[], i: number): boolean {
    return values[i] > values[i-1] && values[i] > values[i+1] &&
           values[i] > values[i-2] && values[i] > values[i+2];
  }
  
  private getPostprandialAdjustment(): number {
    const hour = new Date().getHours();
    
    // Ajuste postprandial para triglicéridos
    if (hour >= 12 && hour <= 16) {
      return 20; // Post-almuerzo
    } else if (hour >= 20 && hour <= 23) {
      return 15; // Post-cena
    } else {
      return 0;
    }
  }
  
  private calculateHDL(totalCholesterol: number, elasticity: number): number {
    // HDL típicamente inverso al colesterol total y correlaciona con elasticidad arterial
    const baseHDL = 50;
    const totalEffect = (totalCholesterol - 180) / 20;
    const elasticityEffect = elasticity * 10;
    
    return Math.max(30, Math.min(80, baseHDL - totalEffect + elasticityEffect));
  }
  
  private calculateCardiovascularRisk(total: number, hdl: number, ldl: number): 'low' | 'moderate' | 'high' {
    const ratio = total / hdl;
    
    if (total > 240 || ldl > 160 || ratio > 5) {
      return 'high';
    } else if (total > 200 || ldl > 130 || ratio > 3.5) {
      return 'moderate';
    } else {
      return 'low';
    }
  }
  
  private applyLipidTemporalFilter(newValue: number, type: 'cholesterol' | 'triglycerides'): number {
    // Filtro específico para cada tipo de lípido
    const entry = { cholesterol: 0, triglycerides: 0 };
    entry[type] = newValue;
    
    this.lipidHistory.push(entry);
    if (this.lipidHistory.length > 15) {
      this.lipidHistory.shift();
    }
    
    // Media móvil ponderada
    let weightedSum = 0;
    let totalWeight = 0;
    
    this.lipidHistory.forEach((entry, index) => {
      const weight = index + 1; // Más peso a valores recientes
      weightedSum += entry[type] * weight;
      totalWeight += weight;
    });
    
    return totalWeight > 0 ? weightedSum / totalWeight : newValue;
  }
  
  private getDefaultProfile(): LipidProfile {
    return {
      totalCholesterol: 0,
      triglycerides: 0,
      hdlCholesterol: 0,
      ldlCholesterol: 0,
      vldlCholesterol: 0,
      risk: 'low'
    };
  }
  
  public calibrate(knownProfile: Partial<LipidProfile>): void {
    if (knownProfile.totalCholesterol) {
      this.baselineCholesterol = knownProfile.totalCholesterol;
    }
    if (knownProfile.triglycerides) {
      this.baselineTriglycerides = knownProfile.triglycerides;
    }
    this.isCalibrated = true;
  }
  
  public reset(): void {
    this.lipidHistory = [];
  }
}
