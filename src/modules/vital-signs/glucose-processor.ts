import { MedicalFFTAnalyzer } from '../signal-processing/MedicalFFTAnalyzer';
import { calculateStandardDeviation, findPeaksAndValleys } from './utils';

// Define the interface for extracted features
export interface GlucoseFeatures {
  spectralGlucoseIndicator: number; // e.g., ratio of specific frequency bands
  vascularResistanceIndex: number; // proxy from pulse wave morphology
  pulseMorphologyScore: number; // comprehensive score from various morphological parameters
  hrvRmssd?: number; // Heart Rate Variability - RMSSD
  hrvSdnn?: number; // Heart Rate Variability - SDNN
  upstrokeTime: number; // Time from foot to peak
  dicroticNotchPresence: number; // Binary: 1 if present, 0 if absent
  augmentationIndex: number; // Derived from pre/post-dicrotic notch peaks
  areaUnderCurve: number; // Area of the pulse wave
}

export class GlucoseProcessor {
  private glucoseHistory: number[] = [];
  private baselineGlucose: number = 95; // mg/dL normal fasting
  private isCalibrated: boolean = false;
  private fftAnalyzer: MedicalFFTAnalyzer;

  // Constants for physiological model weights (illustrative, for a real app these would be derived from ML)
  private readonly WEIGHT_SPECTRAL = 20; // Impact of vasomotion on glucose
  private readonly WEIGHT_VASCULAR = -15; // Impact of arterial stiffness on glucose
  private readonly WEIGHT_MORPHOLOGY = 0.3; // Impact of pulse wave shape
  private readonly WEIGHT_HRV_RMSSD = -0.5; // Impact of parasympathetic activity
  private readonly WEIGHT_HRV_SDNN = -0.2; // Impact of overall HRV

  // Constants for temporal filtering (EMA)
  private readonly GLUCOSE_ALPHA = 0.4; // Smoothing factor for estimated glucose

  constructor() {
    this.fftAnalyzer = new MedicalFFTAnalyzer();
  }

  /**
   * Calcula niveles de glucosa usando análisis avanzado de PPG
   */
  public calculateGlucose(ppgValues: number[], rrIntervals: number[]): {
    estimatedGlucose: number;
    glucoseRange: [number, number];
    confidence: number;
    variability: number;
    features: GlucoseFeatures;
  } {
    if (ppgValues.length < this.fftAnalyzer.BUFFER_SIZE || rrIntervals.length < 5) {
      // Need sufficient data for robust analysis
      return {
        estimatedGlucose: this.glucoseHistory.length > 0 ? this.glucoseHistory[this.glucoseHistory.length - 1] : 0,
        glucoseRange: [0, 0],
        confidence: 0,
        variability: 0,
        features: {
          spectralGlucoseIndicator: 0,
          vascularResistanceIndex: 0,
          pulseMorphologyScore: 0,
          upstrokeTime: 0,
          dicroticNotchPresence: 0,
          augmentationIndex: 0,
          areaUnderCurve: 0,
        },
      };
    }

    // 1. Preprocesamiento avanzado de la señal PPG
    const preprocessedSignal = this.preprocessPPGSignal(ppgValues);

    // 2. Extracción de características avanzadas
    const features = this.extractAdvancedFeatures(preprocessedSignal, rrIntervals);

    // 3. Algoritmo de estimación de glucosa basado en un modelo fisiológicamente informado
    // Este modelo combina las características extraídas con pesos que reflejan su influencia fisiológica.
    // Los pesos son ilustrativos y deberían ser calibrados con datos clínicos reales.
    let estimatedGlucose =
      this.baselineGlucose +
      (features.spectralGlucoseIndicator * this.WEIGHT_SPECTRAL) +
      (features.vascularResistanceIndex * this.WEIGHT_VASCULAR) +
      (features.pulseMorphologyScore * this.WEIGHT_MORPHOLOGY);

    if (features.hrvRmssd !== undefined) {
      estimatedGlucose += (features.hrvRmssd * this.WEIGHT_HRV_RMSSD);
    }
    if (features.hrvSdnn !== undefined) {
      estimatedGlucose += (features.hrvSdnn * this.WEIGHT_HRV_SDNN);
    }

    // 4. Aplicar filtro temporal (EMA) para estabilidad
    const smoothedGlucose = this.applyTemporalFilter(estimatedGlucose);
    
    // 5. Calcular confianza y variabilidad (mejorado)
    const confidence = this.calculateConfidence(preprocessedSignal, features);
    const variability = this.calculateVariability(this.glucoseHistory);

    // 6. Límites fisiológicos estrictos
    const finalGlucose = Math.max(70, Math.min(180, Math.round(smoothedGlucose))); // Hard physiological clamps

    // 7. Definir rango basado en confianza y variabilidad
    const rangeOffset = (1 - confidence) * 20 + variability * 0.5; // Adjusted factors based on perceived impact
    const glucoseRange: [number, number] = [
      Math.max(70, finalGlucose - rangeOffset),
      Math.min(180, finalGlucose + rangeOffset),
    ];

    // Actualizar historial
    this.glucoseHistory.push(finalGlucose);
    if (this.glucoseHistory.length > 30) { // Keep history for stability
      this.glucoseHistory.shift();
    }

    return {
      estimatedGlucose: finalGlucose,
      glucoseRange,
      confidence,
      variability,
      features,
    };
  }

  // New method for advanced feature extraction
  private extractAdvancedFeatures(ppgValues: number[], rrIntervals: number[]): GlucoseFeatures {
    // Spectral features using MedicalFFTAnalyzer
    this.fftAnalyzer.reset(); // Reset for fresh analysis
    for (const val of ppgValues) {
      this.fftAnalyzer.addSample(val);
    }
    const fftResult = this.fftAnalyzer.analyzeBPM();
    const spectralGlucoseIndicator = fftResult ? this.calculateSpectralGlucoseIndicator(fftResult.spectrum) : 0;

    // Pulse Wave Morphology Analysis
    const { upstrokeTime, dicroticNotchPresence, augmentationIndex, areaUnderCurve, vascularResistanceIndex, pulseMorphologyScore } = this.analyzePulseWaveMorphology(ppgValues);

    // HRV Features
    const hrvRmssd = this.calculateRMSSD(rrIntervals);
    const hrvSdnn = this.calculateSDNN(rrIntervals);

    return {
      spectralGlucoseIndicator,
      vascularResistanceIndex,
      pulseMorphologyScore,
      hrvRmssd,
      hrvSdnn,
      upstrokeTime,
      dicroticNotchPresence,
      augmentationIndex,
      areaUnderCurve,
    };
  }

  // Placeholder for a more detailed spectral analysis related to glucose
  private calculateSpectralGlucoseIndicator(spectrum: number[]): number {
    // This is where domain-specific knowledge is critical.
    // Example: Ratio of very low frequency (VLF) power to total power, or specific harmonics.
    // Assuming SAMPLE_RATE is known, map frequency ranges to bins.
    // This is a placeholder and needs real research-backed frequency ranges.
    const SAMPLE_RATE = 30; // Assuming 30 FPS for PPG
    const N = spectrum.length * 2; // FFT returns half spectrum, so double for original signal length
    const freqResolution = SAMPLE_RATE / N;

    // Example bands (illustrative)
    const vlfMinBin = Math.floor(0.04 / freqResolution);
    const vlfMaxBin = Math.floor(0.15 / freqResolution); // Very low frequency (vasomotor activity)

    const lfMinBin = Math.floor(0.15 / freqResolution);
    const lfMaxBin = Math.floor(0.4 / freqResolution); // Low frequency (sympathetic and parasympathetic)

    const hfMinBin = Math.floor(0.4 / freqResolution);
    const hfMaxBin = Math.floor(1.0 / freqResolution); // High frequency (parasympathetic)

    let vlfPower = 0;
    for (let i = vlfMinBin; i <= vlfMaxBin && i < spectrum.length; i++) {
      vlfPower += spectrum[i] * spectrum[i];
    }
    let lfPower = 0;
    for (let i = lfMinBin; i <= lfMaxBin && i < spectrum.length; i++) {
      lfPower += spectrum[i] * spectrum[i];
    }
    let hfPower = 0;
    for (let i = hfMinBin; i <= hfMaxBin && i < spectrum.length; i++) {
      hfPower += spectrum[i] * spectrum[i];
    }

    const totalPower = vlfPower + lfPower + hfPower;
    if (totalPower === 0) return 0;

    // Example indicator: Ratio of VLF power to total power, or LF/HF ratio etc.
    // The specific ratio depends on physiological studies correlating PPG spectral features with glucose.
    return vlfPower / totalPower;
  }

  // Advanced Pulse Wave Morphology Analysis
  private analyzePulseWaveMorphology(values: number[]): {
    upstrokeTime: number;
    dicroticNotchPresence: number;
    augmentationIndex: number;
    areaUnderCurve: number;
    vascularResistanceIndex: number; // Placeholder for improved calculation
    pulseMorphologyScore: number; // Composite score
  } {
    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);

    if (peakIndices.length < 2) {
      return {
        upstrokeTime: 0,
        dicroticNotchPresence: 0,
        augmentationIndex: 0,
        areaUnderCurve: 0,
        vascularResistanceIndex: 0,
        pulseMorphologyScore: 0,
      };
    }

    const firstPeakIndex = peakIndices[0];
    const secondPeakIndex = peakIndices[1]; // For augmentation index

    // Upstroke Time: Time from foot to peak
    const upstrokeStart = this.findUpstrokeStart(values, firstPeakIndex);
    const upstrokeTime = (upstrokeStart !== -1 && upstrokeStart < firstPeakIndex) ? (firstPeakIndex - upstrokeStart) : 0;

    // Dicrotic Notch Presence: Simplified detection
    const dicroticNotchPresence = this.findDicroticNotch(values, firstPeakIndex, valleyIndices) !== -1 ? 1 : 0;

    // Augmentation Index: Ratio of the second peak (if present) to the first peak amplitude
    let augmentationIndex = 0;
    if (peakIndices.length >= 2) {
      const firstPeakAmp = values[firstPeakIndex] - values[upstrokeStart]; // Assuming upstrokeStart is lowest point
      const secondPeakAmp = values[secondPeakIndex] - values[valleyIndices.find(v => v > firstPeakIndex && v < secondPeakIndex) || upstrokeStart]; // Lowest point between peaks
      if (firstPeakAmp > 0) {
        augmentationIndex = (secondPeakAmp / firstPeakAmp); // Simplified AI
      }
    }

    // Area Under Curve (AUC): Simple trapezoidal rule sum
    const areaUnderCurve = values.reduce((sum, val, idx) => sum + (val + (values[idx - 1] || 0)) / 2, 0);

    // Vascular Resistance Index (improved): Could be based on the stiffness of the arterial wall
    // This is often derived from PTT, but without ECG, it's challenging.
    // A proxy can be the steepness of the pulse wave and its decay.
    const vascularResistanceIndex = this.calculateVascularResistanceProxy(values, peakIndices);

    // Composite Pulse Morphology Score: Combine various aspects
    let pulseMorphologyScore = 0;
    // Example: normalize and sum features. Weights based on physiological significance.
    pulseMorphologyScore += (upstrokeTime > 0 ? (1 / upstrokeTime) * 10 : 0); // Faster upstroke, higher score (better elasticity)
    pulseMorphologyScore += dicroticNotchPresence * 5; // Presence indicates healthier arterial reflection
    pulseMorphologyScore += (1 - Math.abs(augmentationIndex - 0.5)) * 10; // Closer to 0.5 can be considered ideal for some contexts
    pulseMorphologyScore += (areaUnderCurve / values.length) * 0.1; // Avg amplitude
    pulseMorphologyScore += (1 - vascularResistanceIndex) * 10; // Lower resistance, higher score

    // Clamp score to reasonable range, e.g., 0-100
    pulseMorphologyScore = Math.max(0, Math.min(100, pulseMorphologyScore));

    return {
      upstrokeTime,
      dicroticNotchPresence,
      augmentationIndex,
      areaUnderCurve,
      vascularResistanceIndex,
      pulseMorphologyScore,
    };
  }

  // Improved placeholder for vascular resistance proxy
  private calculateVascularResistanceProxy(values: number[], peakIndices: number[]): number {
    if (peakIndices.length < 2) return 0.5; // Default neutral

    // Use the slope of the steepest part of the upstroke
    let maxSlope = 0;
    for (const peakIndex of peakIndices) {
      const upstrokeStart = this.findUpstrokeStart(values, peakIndex);
      if (upstrokeStart !== -1 && upstrokeStart < peakIndex - 1) {
        for (let i = upstrokeStart + 1; i <= peakIndex; i++) {
          const slope = (values[i] - values[i - 1]);
          if (slope > maxSlope) maxSlope = slope;
        }
      }
    }
    // Higher slope indicates lower resistance (more elastic arteries)
    // Normalize to 0-1 range. Example: 0.1 slope could be 0 resistance, 0.01 could be 1 resistance
    // This needs to be tuned with real data.
    const normalizedSlope = Math.min(1, maxSlope / 0.1); // Assuming 0.1 is a good max slope for normalization
    return 1 - normalizedSlope; // Higher value means more resistance
  }

  // Calculate RMSSD for HRV
  private calculateRMSSD(rrIntervals: number[]): number {
    if (rrIntervals.length < 2) return 0;
    let sumSquaredDiff = 0;
    for (let i = 1; i < rrIntervals.length; i++) {
      const diff = rrIntervals[i] - rrIntervals[i - 1];
      sumSquaredDiff += diff * diff;
    }
    return Math.sqrt(sumSquaredDiff / (rrIntervals.length - 1));
  }

  // Calculate SDNN for HRV
  private calculateSDNN(rrIntervals: number[]): number {
    return calculateStandardDeviation(rrIntervals);
  }

  // Find dicrotic notch: The point of local minimum after the systolic peak before the diastolic phase
  private findDicroticNotch(values: number[], peakIndex: number, valleyIndices: number[]): number {
    // Search for a valley after the peak within a physiological window
    const searchStart = peakIndex + 1;
    // The dicrotic notch is typically a small valley shortly after the systolic peak
    const notchCandidates = valleyIndices.filter(v => v > searchStart && v < peakIndex + 20); // Search within ~20 frames
    if (notchCandidates.length > 0) {
      // Find the first significant valley after the peak
      for (const candidateIndex of notchCandidates) {
        // Check for a rise after the valley (indicating the start of diastolic wave)
        if (values[candidateIndex + 1] > values[candidateIndex] && values[candidateIndex + 2] > values[candidateIndex + 1]) {
          return candidateIndex;
        }
      }
    }
    return -1; // Not found
  }

  // Override existing methods for a more robust implementation
  private preprocessPPGSignal(values: number[]): number[] {
    // 1. Eliminación de tendencia DC (baseline wander removal) - Butterworth High-Pass Filter
    // Frecuencia de corte para eliminar la componente DC y el movimiento de la línea de base
    // asumiendo una frecuencia de muestreo de 30Hz, y un corte de 0.5 Hz
    const N = values.length;
    if (N < 2) return new Array(N).fill(0);

    const fs = 30; // Sample rate (frames per second)
    const cutoffFreq = 0.5; // Hz for high-pass filter
    const RC = 1 / (2 * Math.PI * cutoffFreq);
    const dt = 1 / fs;
    const alpha = dt / (RC + dt);

    let filtered: number[] = new Array(N);
    filtered[0] = 0; // First element is 0, or handle initial transient

    for (let i = 1; i < N; i++) {
      filtered[i] = alpha * (filtered[i - 1] + values[i] - values[i - 1]);
    }

    // 2. Normalización (0 a 1)
    const minVal = Math.min(...filtered);
    const maxVal = Math.max(...filtered);
    if (maxVal - minVal === 0) return new Array(N).fill(0); // Avoid division by zero

    const normalized = filtered.map(val => (val - minVal) / (maxVal - minVal));

    return normalized;
  }
  
  // Refined confidence calculation
  private calculateConfidence(signal: number[], features: GlucoseFeatures): number {
    // Confidence based on signal quality (e.g., amplitude, smoothness),
    // and consistency/plausibility of extracted features.
    const signalAmplitude = Math.max(...signal) - Math.min(...signal);
    const signalQualityScore = Math.min(1, signalAmplitude / 0.5); // Assuming 0.5 is a good amplitude

    // Feature consistency check (e.g., are the features changing wildly or stable?)
    let featureConsistencyScore = 1; // Start high, reduce if inconsistent
    if (features.upstrokeTime === 0 || features.vascularResistanceIndex === 0) {
      featureConsistencyScore -= 0.3; // Penalize for missing key features
    }
    // Add more checks for consistency if historical feature data is available.

    // Combine scores
    let confidence = (signalQualityScore * 0.6) + (featureConsistencyScore * 0.4);
    
    // Clamp between 0 and 1
    confidence = Math.max(0, Math.min(1, confidence));
    return confidence;
  }

  // Refined variability calculation
  private calculateVariability(glucoseHistory: number[]): number {
    // Variability based on the standard deviation of recent glucose estimations
    return calculateStandardDeviation(glucoseHistory);
  }

  // Apply temporal filter (Exponential Moving Average)
  private applyTemporalFilter(newValue: number): number {
    if (this.glucoseHistory.length === 0) {
      return newValue;
    }
    const lastSmoothedValue = this.glucoseHistory[this.glucoseHistory.length - 1];
    return lastSmoothedValue + this.GLUCOSE_ALPHA * (newValue - lastSmoothedValue);
  }

  private findUpstrokeStart(values: number[], peakIndex: number): number {
    // Find the lowest point (foot) before the peak.
    // This is crucial for calculating accurate upstroke time.
    let upstrokeStart = peakIndex;
    for (let i = peakIndex - 1; i >= 0; i--) {
      if (values[i] < values[upstrokeStart]) {
        upstrokeStart = i;
      } else {
        // If the value starts increasing again, the previous point was the foot.
        if (values[i] > values[i+1]) {
          break;
        }
      }
    }
    return upstrokeStart;
  }

  // Existing calibrate and reset methods are fine, but ensure they reset the new components.
  public calibrate(knownGlucose: number): void {
    // In a real scenario, this would involve a complex calibration process
    // where the model weights are adjusted based on actual glucose readings.
    // For this reference tool, we'll simply adjust the baseline.
    this.baselineGlucose = knownGlucose;
    this.isCalibrated = true;
    console.log(`GlucoseProcessor: Calibrated with baseline glucose: ${knownGlucose}`);
  }

  public reset(): void {
    this.glucoseHistory = [];
    this.isCalibrated = false;
    this.baselineGlucose = 95; // Reset to default
    this.fftAnalyzer.reset();
    console.log("GlucoseProcessor: Reset completo");
  }
}
