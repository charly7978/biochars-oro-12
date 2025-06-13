// Eliminar este archivo si SignalProcessingCore y hooks ya cubren el procesamiento de signos vitales.

import { VitalSignsProcessor as NewVitalSignsProcessor } from './vital-signs/VitalSignsProcessor';

/**
 * This is a wrapper class to maintain backward compatibility with
 * the original VitalSignsProcessor implementation while using the 
 * refactored version under the hood.
 */
export class VitalSignsProcessor {
  private processor: NewVitalSignsProcessor;
  
  // Expose constants for compatibility
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.02;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.05;
  private readonly SPO2_WINDOW = 10;
  private readonly SMA_WINDOW = 3;
  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 25;
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 3000;
  private readonly PEAK_THRESHOLD = 0.3;
  
  constructor() {
    this.processor = new NewVitalSignsProcessor();
  }
  
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ) {
    return this.processor.processSignal(ppgValue, rrData);
  }
  
  public reset(): void {
    this.processor.reset();
  }
}
