export interface PPGFrame {
  timestamp: number;
  values: number[];
}

export interface ProcessedSignalData {
  heartRate: number;
  spo2: number;
  perfusionIndex: number;
  signalQuality: number;
}

export interface VitalSignsResult {
  heartRate: number;
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  perfusionIndex?: number;
  signalQuality?: number;
  vascularAge?: number;
  hemoglobin?: number;
  glucose?: number;
  lipids?: {
    total: number;
    hdl: number;
    ldl: number;
  };
}
