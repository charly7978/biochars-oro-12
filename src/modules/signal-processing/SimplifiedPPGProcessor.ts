/**
 * PROCESADOR PPG SIMPLIFICADO - VERSIÓN DEFINITIVA
 * Pipeline optimizado sin redundancias
 */

import { FingerDetectionCore, FingerDetectionCoreResult } from './FingerDetectionCore';

export interface PPGResult {
  fingerDetected: boolean;
  signalQuality: number;
  rawValue: number;
  filteredValue: number;
  metrics: any;
  timestamp: number;
}

export class SimplifiedPPGProcessor {
  private fingerDetector: FingerDetectionCore;
  private lastFilteredValue = 0;
  private frameCount = 0;
  
  constructor() {
    this.fingerDetector = new FingerDetectionCore();
  }
  
  processFrame(imageData: ImageData): PPGResult {
    this.frameCount++;
    const timestamp = Date.now();
    
    // 1. DETECCIÓN DE DEDO OPTIMIZADA
    const detectionResult: FingerDetectionCoreResult = this.fingerDetector.detectFinger(imageData);
    
    // 2. EXTRACCIÓN DE SEÑAL SIMPLE
    const rawValue = this.extractSimplePPGSignal(imageData);
    const filteredValue = this.applySimpleFilter(rawValue);
    
    // 3. USAR CALIDAD DIRECTA DEL DETECTOR
    const signalQuality = detectionResult.quality;
    
    // Log cada 30 frames
    if (this.frameCount % 30 === 0) {
      console.log("SimplifiedPPGProcessor:", {
        fingerDetected: detectionResult.detected,
        quality: signalQuality.toFixed(1),
        confidence: detectionResult.confidence.toFixed(2),
        rawValue: rawValue.toFixed(1)
      });
    }
    
    return {
      fingerDetected: detectionResult.detected,
      signalQuality,
      rawValue,
      filteredValue,
      metrics: detectionResult.metrics,
      timestamp
    };
  }
  
  private extractSimplePPGSignal(imageData: ImageData): number {
    const { data, width, height } = imageData;
    
    // Área central pequeña para PPG
    const centerX = width / 2;
    const centerY = height / 2;
    const size = Math.min(width, height) * 0.2;
    
    let redSum = 0;
    let pixelCount = 0;
    
    for (let y = centerY - size/2; y < centerY + size/2; y += 2) {
      for (let x = centerX - size/2; x < centerX + size/2; x += 2) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const index = (Math.floor(y) * width + Math.floor(x)) * 4;
          redSum += data[index];
          pixelCount++;
        }
      }
    }
    
    return pixelCount > 0 ? redSum / pixelCount : 0;
  }
  
  private applySimpleFilter(rawValue: number): number {
    // Filtro simple de media móvil
    const alpha = 0.7;
    this.lastFilteredValue = alpha * this.lastFilteredValue + (1 - alpha) * rawValue;
    return this.lastFilteredValue;
  }
  
  reset(): void {
    this.fingerDetector.reset();
    this.lastFilteredValue = 0;
    this.frameCount = 0;
  }
}

// Eliminar este archivo si no hay lógica única.
// Si hay funciones útiles, muévelas a SignalProcessingCore.ts antes de borrar.
