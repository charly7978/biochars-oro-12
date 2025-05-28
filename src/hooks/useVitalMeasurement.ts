import { useState, useEffect } from 'react';
import { SignalProcessingPipeline } from '../modules/signal-processing/SignalProcessingPipeline';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { ProcessedSignal } from '../types/signal';

interface VitalMeasurements {
  heartRate: number;
  spo2: number;
  pressure: string;
  arrhythmiaCount: string | number;
}

interface UseVitalMeasurementProps {
    isMeasuring: boolean;
    pipeline: SignalProcessingPipeline;
    vitalSignsProcessor: VitalSignsProcessor;
    onMeasurementComplete?: (result: VitalSignsResult | null) => void;
}

export const useVitalMeasurement = ({
    isMeasuring,
    pipeline,
    vitalSignsProcessor,
    onMeasurementComplete
}: UseVitalMeasurementProps) => {
  const [measurements, setMeasurements] = useState<VitalMeasurements>({
    heartRate: 0,
    spo2: 0,
    pressure: "--/--",
    arrhythmiaCount: 0
  });
  const [currentVitalSignsResult, setCurrentVitalSignsResult] = useState<VitalSignsResult | null>(null);
  const [calibrationStatus, setCalibrationStatus] = useState<{ phase: string; progress: number; instructions: string; isComplete: boolean; results?: any } | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    console.log('useVitalMeasurement - Estado detallado:', {
      isMeasuring,
      currentMeasurements: measurements,
      elapsedTime,
      timestamp: new Date().toISOString(),
      session: Math.random().toString(36).substring(2, 9)
    });

    if (!isMeasuring) {
      console.log('useVitalMeasurement - Reiniciando mediciones por detención', {
        prevValues: {...measurements},
        timestamp: new Date().toISOString()
      });
      
      setMeasurements(prev => {
        const newValues = {
          ...prev,
          heartRate: 0,
          spo2: 0,
          pressure: "--/--",
          arrhythmiaCount: "--"
        };
        
        console.log('useVitalMeasurement - Nuevos valores tras reinicio', newValues);
        return newValues;
      });
      
      setCurrentVitalSignsResult(null);
      setCalibrationStatus(null);
      pipeline.reset();
      vitalSignsProcessor.fullReset();
      return;
    }

    console.log('useVitalMeasurement - Iniciando procesamiento del pipeline');
    pipeline.onSignalReady = (signal) => {
        if (signal.fingerDetected && signal.quality > 0) {
            const vitalSignsResult = vitalSignsProcessor.processSignal(signal.amplifiedValue, signal.rrData);
            setCurrentVitalSignsResult(vitalSignsResult);
        } else {
             setCurrentVitalSignsResult(vitalSignsProcessor.reset());
        }
    };

    pipeline.onCalibrationUpdate = (status) => {
        setCalibrationStatus(status);
        console.log("useVitalMeasurement - Estado de calibración actualizado", status);
        if (status.isComplete) {
             vitalSignsProcessor.setExternalCalibration(status.results?.success || false, status.results?.referenceData);
             console.log("useVitalMeasurement - Notificando a VSP sobre calibración completada");
        }
    };

    pipeline.start();

    return () => {
      console.log('useVitalMeasurement - Deteniendo el pipeline');
      pipeline.stop();
      setCurrentVitalSignsResult(null);
      setCalibrationStatus(null);
      vitalSignsProcessor.fullReset();
    };
  }, [isMeasuring, pipeline, vitalSignsProcessor]);

  useEffect(() => {
      if (currentVitalSignsResult) {
          setMeasurements({
            heartRate: currentVitalSignsResult.heartRate,
            spo2: currentVitalSignsResult.spo2,
            pressure: typeof currentVitalSignsResult.pressure === 'string' ? 
                        currentVitalSignsResult.pressure : 
                        `${currentVitalSignsResult.pressure.systolic}/${currentVitalSignsResult.pressure.diastolic}`,
            arrhythmiaCount: currentVitalSignsResult.arrhythmiaStatus
          });
      } else {
           setMeasurements({
              heartRate: 0,
              spo2: 0,
              pressure: "--/--",
              arrhythmiaCount: "--"
           });
      }
  }, [currentVitalSignsResult]);

  const MEASUREMENT_DURATION = 30;

  useEffect(() => {
      let timer: NodeJS.Timeout;
      if (isMeasuring && !calibrationStatus?.isComplete) {
          const startTime = Date.now();
           timer = setInterval(() => {
              const elapsed = (Date.now() - startTime) / 1000;
              setElapsedTime(Math.min(elapsed, MEASUREMENT_DURATION));
               if (elapsed >= MEASUREMENT_DURATION) {
                   clearInterval(timer);
                    console.log("useVitalMeasurement: Duración de medición alcanzada.");
               }
           }, 1000);
      } else if (!isMeasuring || calibrationStatus?.isComplete) {
          setElapsedTime(0);
      }
      
      return () => clearInterval(timer);
  }, [isMeasuring, calibrationStatus]);

  return {
    ...measurements,
    elapsedTime: elapsedTime,
    isCalibrating: calibrationStatus?.isCalibrating || false,
    calibrationProgress: calibrationStatus?.progress || 0,
    calibrationInstructions: calibrationStatus?.instructions || '',
    isMeasurementComplete: elapsedTime >= MEASUREMENT_DURATION
  };
};
