
import React, { useState, useRef, useEffect } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import { VitalSignsResult } from "@/modules/vital-signs/VitalSignsProcessor";
import { debugFrame, debugSignal } from "@/utils/debug";

const Index = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);
  const [vitalSigns, setVitalSigns] = useState<VitalSignsResult>({
    spo2: 0,
    pressure: "--/--",
    arrhythmiaStatus: "--",
    glucose: 0,
    lipids: {
      totalCholesterol: 0,
      triglycerides: 0
    },
    hemoglobin: 0
  });
  const [heartRate, setHeartRate] = useState(0);
  const [heartbeatSignal, setHeartbeatSignal] = useState(0);
  const [beatMarker, setBeatMarker] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const measurementTimerRef = useRef<number | null>(null);
  const processingRef = useRef<boolean>(false);
  const frameProcessingRef = useRef<number | null>(null);

  const { startProcessing, stopProcessing, lastSignal, processFrame } = useSignalProcessor();
  const { processSignal: processHeartBeat } = useHeartBeatProcessor();
  const { processSignal: processVitalSigns, reset: resetVitalSigns, fullReset: fullResetVitalSigns } = useVitalSignsProcessor();

  // Fullscreen management
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const enterFullScreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
          setIsFullscreen(true);
        }
      } catch (err) {
        console.log('Fullscreen not available');
      }
    };

    setTimeout(enterFullScreen, 1000);

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const startMonitoring = () => {
    console.log("Index: Starting monitoring");
    
    setIsMonitoring(true);
    setShowResults(false);
    setElapsedTime(0);
    
    startProcessing();
    processingRef.current = true;
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
    }
    
    measurementTimerRef.current = window.setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;
        if (newTime >= 30) {
          finalizeMeasurement();
          return 30;
        }
        return newTime;
      });
    }, 1000);
  };

  const finalizeMeasurement = () => {
    console.log("Index: Finalizing measurement");
    
    setIsMonitoring(false);
    processingRef.current = false;
    stopProcessing();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    if (frameProcessingRef.current) {
      cancelAnimationFrame(frameProcessingRef.current);
      frameProcessingRef.current = null;
    }
    
    const savedResults = resetVitalSigns();
    if (savedResults) {
      setVitalSigns(savedResults);
      setShowResults(true);
    }
    
    setElapsedTime(0);
  };

  const handleReset = () => {
    console.log("Index: Resetting application");
    
    setIsMonitoring(false);
    processingRef.current = false;
    stopProcessing();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    if (frameProcessingRef.current) {
      cancelAnimationFrame(frameProcessingRef.current);
      frameProcessingRef.current = null;
    }
    
    fullResetVitalSigns();
    setShowResults(false);
    setElapsedTime(0);
    setHeartRate(0);
    setHeartbeatSignal(0);
    setBeatMarker(0);
    setSignalQuality(0);
    setVitalSigns({ 
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: { totalCholesterol: 0, triglycerides: 0 },
      hemoglobin: 0
    });
  };

  // FASE 2: Captura real de frames usando canvas directamente desde video
  const handleStreamReady = (stream: MediaStream) => {
    if (!processingRef.current) return;
    
    debugFrame("Stream ready - starting frame capture");
    
    const videoElement = document.querySelector('video');
    if (!videoElement) {
      debugFrame("ERROR: No video element found");
      return;
    }

    const processFrames = () => {
      if (!processingRef.current || !videoElement) return;
      
      try {
        // Verificar que el video esté reproduciendo
        if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
          debugFrame("Video not ready - dimensions zero");
          frameProcessingRef.current = requestAnimationFrame(processFrames);
          return;
        }
        
        // FASE 2: Usar canvas directamente desde video element
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (ctx) {
          canvas.width = Math.min(320, videoElement.videoWidth);
          canvas.height = Math.min(240, videoElement.videoHeight);
          
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // FASE 2: Verificar que tenemos datos válidos
          if (imageData.data.length > 0) {
            debugFrame("Processing frame", {
              width: canvas.width,
              height: canvas.height,
              dataLength: imageData.data.length
            });
            processFrame(imageData);
          }
        }
        
        if (processingRef.current) {
          frameProcessingRef.current = requestAnimationFrame(processFrames);
        }
      } catch (error) {
        debugFrame("Frame processing error", error);
        if (processingRef.current) {
          setTimeout(() => {
            frameProcessingRef.current = requestAnimationFrame(processFrames);
          }, 100);
        }
      }
    };

    // Esperar a que el video esté listo
    const startFrameProcessing = () => {
      if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
        debugFrame("Starting frame processing", {
          width: videoElement.videoWidth,
          height: videoElement.videoHeight
        });
        frameProcessingRef.current = requestAnimationFrame(processFrames);
      } else {
        debugFrame("Waiting for video to be ready...");
        setTimeout(startFrameProcessing, 100);
      }
    };

    startFrameProcessing();
  };

  // Procesar señales cuando se reciben
  useEffect(() => {
    if (lastSignal && processingRef.current) {
      debugSignal("Signal received", {
        fingerDetected: lastSignal.fingerDetected,
        quality: lastSignal.quality,
        rawValue: lastSignal.rawValue
      });
      
      setSignalQuality(lastSignal.quality);
      
      if (lastSignal.fingerDetected) {
        const heartBeatResult = processHeartBeat(lastSignal.rawValue);
        setHeartRate(heartBeatResult.bpm);
        setHeartbeatSignal(heartBeatResult.filteredValue);
        setBeatMarker(heartBeatResult.isPeak ? 1 : 0);
        
        const vitals = processVitalSigns(lastSignal.rawValue, heartBeatResult.rrData);
        if (vitals) {
          setVitalSigns(vitals);
        }
      }
    }
  }, [lastSignal, processHeartBeat, processVitalSigns]);

  return (
    <div className="fixed inset-0 flex flex-col bg-black overflow-hidden">
      {!isFullscreen && (
        <button 
          onClick={() => document.documentElement.requestFullscreen()}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 text-white"
        >
          <div className="text-center p-4 bg-primary/20 rounded-lg">
            <p className="text-lg font-semibold">Toca para pantalla completa</p>
          </div>
        </button>
      )}

      <div className="flex-1 relative">
        <CameraView 
          onStreamReady={handleStreamReady}
          isMonitoring={isMonitoring}
          isFingerDetected={lastSignal?.fingerDetected}
          signalQuality={signalQuality}
        />

        <div className="relative z-10 h-full flex flex-col">
          {/* Estados reales en UI */}
          <div className="px-4 py-2 flex justify-around items-center bg-black/20">
            <div className="text-white text-lg">
              Calidad: {signalQuality.toFixed(0)}%
            </div>
            <div className="text-white text-lg">
              {lastSignal?.fingerDetected ? "Dedo Detectado" : "Coloque su dedo"}
            </div>
            {isMonitoring && (
              <div className="text-white text-lg">
                Tiempo: {elapsedTime}s
              </div>
            )}
          </div>

          <div className="flex-1">
            <PPGSignalMeter 
              value={beatMarker}
              quality={signalQuality}
              isFingerDetected={lastSignal?.fingerDetected || false}
              onStartMeasurement={startMonitoring}
              onReset={handleReset}
              arrhythmiaStatus={vitalSigns.arrhythmiaStatus}
              preserveResults={showResults}
            />
          </div>

          {/* Resultados honestos */}
          <div className="absolute inset-x-0 top-[55%] bottom-[60px] bg-black/10 px-4 py-6">
            <div className="grid grid-cols-3 gap-4 place-items-center">
              <VitalSign 
                label="FRECUENCIA CARDÍACA"
                value={heartRate || "--"}
                unit="BPM"
                highlighted={showResults}
              />
              <VitalSign 
                label="SPO2"
                value={vitalSigns.spo2 || "--"}
                unit="%"
                highlighted={showResults}
              />
              <VitalSign 
                label="PRESIÓN ARTERIAL"
                value={vitalSigns.pressure}
                unit="mmHg"
                highlighted={showResults}
              />
              <VitalSign 
                label="HEMOGLOBINA"
                value={vitalSigns.hemoglobin || "--"}
                unit="g/dL"
                highlighted={showResults}
              />
              <VitalSign 
                label="GLUCOSA"
                value={vitalSigns.glucose || "--"}
                unit="mg/dL"
                highlighted={showResults}
              />
              <VitalSign 
                label="COLESTEROL/TRIGL."
                value={`${vitalSigns.lipids?.totalCholesterol || "--"}/${vitalSigns.lipids?.triglycerides || "--"}`}
                unit="mg/dL"
                highlighted={showResults}
              />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-4 flex gap-4 px-4">
            <div className="w-1/2">
              <MonitorButton 
                isMonitoring={isMonitoring} 
                onToggle={isMonitoring ? finalizeMeasurement : startMonitoring} 
                variant="monitor"
              />
            </div>
            <div className="w-1/2">
              <MonitorButton 
                isMonitoring={isMonitoring} 
                onToggle={handleReset} 
                variant="reset"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
