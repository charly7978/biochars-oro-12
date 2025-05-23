import React, { useState, useRef, useEffect } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import { VitalSignsResult } from "@/modules/vital-signs/VitalSignsProcessor";
import { toast } from "@/components/ui/use-toast";

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

  const handleStreamReady = (stream: MediaStream) => {
    if (!processingRef.current) return;
    
    console.log("Index: Stream ready with torch support");
    
    try {
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== 'live') {
        console.error("Index: Invalid video track");
        return;
      }

      const imageCapture = new ImageCapture(videoTrack);
      
      const processFrames = async () => {
        if (!processingRef.current) return;
        
        try {
          const frame = await imageCapture.grabFrame();
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          
          if (ctx) {
            canvas.width = Math.min(320, frame.width);
            canvas.height = Math.min(240, frame.height);
            
            ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            processFrame(imageData);
          }
          
          if (processingRef.current) {
            requestAnimationFrame(processFrames);
          }
        } catch (error) {
          console.error("Frame processing error:", error);
          if (processingRef.current) {
            setTimeout(processFrames, 100);
          }
        }
      };

      setTimeout(processFrames, 500);
      
    } catch (error) {
      console.error("Error setting up frame processing:", error);
    }
  };

  // Process signals when received
  useEffect(() => {
    if (lastSignal && processingRef.current) {
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
          <div className="px-4 py-2 flex justify-around items-center bg-black/20">
            <div className="text-white text-lg">
              Calidad: {signalQuality}
            </div>
            <div className="text-white text-lg">
              {lastSignal?.fingerDetected ? "Dedo Detectado" : "Sin Dedo"}
            </div>
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
