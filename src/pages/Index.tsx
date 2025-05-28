import { useState, useRef, useEffect } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import { VitalSignsResult, BloodPressureResult as BPResultType } from "@/modules/vital-signs/VitalSignsProcessor";
import { toast } from "@/components/ui/use-toast";

const Index = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);
  const [vitalSigns, setVitalSigns] = useState<VitalSignsResult>({
    heartRate: 0,
    spo2: 0,
    pressure: { systolic: 0, diastolic: 0, confidence: 0, status: "--/--" },
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
  const [arrhythmiaCount, setArrhythmiaCount] = useState<string | number>("--");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState<VitalSignsResult['calibration']>();
  const measurementTimerRef = useRef<number | null>(null);
  const [lastArrhythmiaData, setLastArrhythmiaData] = useState<{
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rrIntervals, setRRIntervals] = useState<number[]>([]);
  
  // Nueva referencia para controlar el estado del procesamiento de imagen
  const isProcessingFramesRef = useRef(false);
  const processingLoopRef = useRef<number | null>(null);
  
  const {
    isProcessing,
    calibrationStatus,
    lastSignal,
    error: pipelineError,
    framesProcessed,
    startProcessing,
    stopProcessing,
    startCalibration,
    processFrame,
    criticalError,
    pipelineRef
  } = useSignalProcessor();
  const { 
    processSignal: processHeartBeat, 
    setArrhythmiaState 
  } = useHeartBeatProcessor();
  const { 
    processSignal: processVitalSigns, 
    reset: resetVitalSigns,
    fullReset: fullResetVitalSigns,
    lastValidResults
  } = useVitalSignsProcessor();

  const enterFullScreen = async () => {
    try {
      if (!isFullscreen) {
        const docEl = document.documentElement;
        
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if ((docEl as any).webkitRequestFullscreen) {
          await (docEl as any).webkitRequestFullscreen();
        } else if ((docEl as any).msRequestFullscreen) {
          await (docEl as any).msRequestFullscreen();
        } else if ((docEl as any).mozRequestFullScreen) {
          await (docEl as any).mozRequestFullScreen();
        }
        
        // Bloquear orientación si es dispositivo móvil
        if (screen.orientation && screen.orientation.lock) {
          try {
            await screen.orientation.lock('portrait');
            console.log('Orientación portrait bloqueada');
          } catch (err) {
            console.log('Error al bloquear la orientación:', err);
          }
        }
        
        setIsFullscreen(true);
        console.log("Pantalla completa activada");
      }
    } catch (err) {
      console.log('Error al entrar en pantalla completa:', err);
    }
  };
  
  const exitFullScreen = () => {
    try {
      if (isFullscreen) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        }
        
        // Desbloquear orientación si es necesario
        if (screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock();
          console.log('Orientación desbloqueada');
        }
        
        setIsFullscreen(false);
      }
    } catch (err) {
      console.log('Error al salir de pantalla completa:', err);
    }
  };
  
  // Activar pantalla completa automáticamente al cargar la página
  useEffect(() => {
    setTimeout(() => {
      enterFullScreen();
    }, 1000); // Pequeño retraso para asegurar que todo está cargado
    
    // Detectar cambios en el estado de pantalla completa
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(
        document.fullscreenElement || 
        (document as any).webkitFullscreenElement || 
        (document as any).msFullscreenElement || 
        (document as any).mozFullScreenElement
      ));
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      
      // Asegurarse de salir del modo pantalla completa al desmontar
      exitFullScreen();
    };
  }, []);

  useEffect(() => {
    const preventScroll = (e: Event) => e.preventDefault();
    document.body.addEventListener('touchmove', preventScroll, { passive: false });
    document.body.addEventListener('scroll', preventScroll, { passive: false });

    return () => {
      document.body.removeEventListener('touchmove', preventScroll);
      document.body.removeEventListener('scroll', preventScroll);
    };
  }, []);

  useEffect(() => {
    if (lastValidResults && !isMonitoring) {
      setVitalSigns(lastValidResults);
      setShowResults(true);
    }
  }, [lastValidResults, isMonitoring]);

  // Bloquear la medición y feedback si hay error crítico
  useEffect(() => {
    if (criticalError) {
      setIsMonitoring(false);
      setIsCameraOn(false);
      setShowResults(false);
      setSignalQuality(0);
      setHeartRate(0);
      setVitalSigns({
        heartRate: 0,
        spo2: 0,
        pressure: { systolic: 0, diastolic: 0, confidence: 0, status: "ERROR" },
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: { totalCholesterol: 0, triglycerides: 0 },
        hemoglobin: 0
      });
    }
  }, [criticalError]);

  const startMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      enterFullScreen();
      setIsMonitoring(true);
      setIsCameraOn(true);
      setShowResults(false);
      
      startProcessing(); 
      
      setElapsedTime(0);
      setVitalSigns(prev => ({
        ...prev,
        arrhythmiaStatus: "SIN ARRITMIAS|0"
      }));
      
      console.log("Index.tsx: Solicitando inicio de MODO calibración al SignalProcessingPipeline.");
      startCalibration();
      
      // Iniciar temporizador para medición
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
      
      measurementTimerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          console.log(`Tiempo transcurrido: ${newTime}s`);
          
          // Finalizar medición después de 30 segundos
          if (newTime >= 30) {
            finalizeMeasurement();
            return 30;
          }
          return newTime;
        });
      }, 1000);
    }
  };

  // Efecto para actualizar la UI de calibración basado en el pipeline
  useEffect(() => {
    if (calibrationStatus) {
      console.log("Index.tsx: calibrationStatus del pipeline actualizado", calibrationStatus);
      setIsCalibrating(!calibrationStatus.isComplete && calibrationStatus.phase !== 'complete');
      
      const generalProgress = calibrationStatus.progress;
      setCalibrationProgress({
        isCalibrating: !calibrationStatus.isComplete,
        progress: {
          heartRate: generalProgress,
          spo2: generalProgress,
          pressure: generalProgress,
          arrhythmia: generalProgress,
          glucose: generalProgress,
          lipids: generalProgress,
          hemoglobin: generalProgress
        }
      });

      if (calibrationStatus.isComplete) {
        if (calibrationStatus.succeeded) {
          toast({ title: "Calibración Completada", description: calibrationStatus.recommendations?.join(' ') || "Lista para medir.", duration: 3000 });
        } else {
          toast({ title: "Calibración Fallida", description: calibrationStatus.recommendations?.join(' ') || "Intente de nuevo.", variant: "destructive", duration: 5000 });
        }
      }
    } else {
      // Si no hay calibrationStatus (ej. al inicio o después de un reset completo), asegurar que la UI esté limpia.
      setIsCalibrating(false);
      setCalibrationProgress(undefined);
    }
  }, [calibrationStatus, toast]);

  const finalizeMeasurement = () => {
    console.log("Finalizando medición: deteniendo procesamiento de frames");
    
    // CRÍTICO: Detener procesamiento de frames PRIMERO
    isProcessingFramesRef.current = false;
    if (processingLoopRef.current) {
      cancelAnimationFrame(processingLoopRef.current);
      processingLoopRef.current = null;
    }
    
    setIsMonitoring(false);
    setIsCameraOn(false);
    setIsCalibrating(false);
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
    setSignalQuality(0);
    setCalibrationProgress(undefined);
  };

  const handleReset = () => {
    console.log("Reseteando completamente la aplicación");
    
    // CRÍTICO: Detener procesamiento de frames PRIMERO
    isProcessingFramesRef.current = false;
    if (processingLoopRef.current) {
      cancelAnimationFrame(processingLoopRef.current);
      processingLoopRef.current = null;
    }
    
    setIsMonitoring(false);
    setIsCameraOn(false);
    setShowResults(false);
    setIsCalibrating(false);
    stopProcessing();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    fullResetVitalSigns();
    setElapsedTime(0);
    setHeartRate(0);
    setHeartbeatSignal(0);
    setBeatMarker(0);
    setVitalSigns(prev => ({
      ...prev,
      heartRate: 0,
      spo2: 0,
      pressure: { systolic: 0, diastolic: 0, confidence: 0, status: "--/--" },
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: { totalCholesterol: 0, triglycerides: 0 },
      hemoglobin: 0
    }));
    setArrhythmiaCount("--");
    setSignalQuality(0);
    setLastArrhythmiaData(null);
    setCalibrationProgress(undefined);
  };

  const handleStreamReady = (stream: MediaStream) => {
    if (!isMonitoring) {
      console.log("handleStreamReady: No está monitoreando, ignorando stream");
      return;
    }
    
    console.log("handleStreamReady: Configurando procesamiento de frames");
    
    const videoTrack = stream.getVideoTracks()[0];
    
    // Verificar que el track esté activo
    if (!videoTrack || videoTrack.readyState !== 'live') {
      console.error("handleStreamReady: Track de video no está activo");
      return;
    }
    
    const imageCapture = new ImageCapture(videoTrack);
    
    // Asegurar que la linterna esté encendida para mediciones de PPG
    if (videoTrack.getCapabilities()?.torch) {
      console.log("Activando linterna para mejorar la señal PPG");
      videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).catch(err => console.error("Error activando linterna:", err));
    } else {
      console.warn("Esta cámara no tiene linterna disponible, la medición puede ser menos precisa");
    }
    
    // Crear un canvas de tamaño óptimo para el procesamiento
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
    if (!tempCtx) {
      console.error("No se pudo obtener el contexto 2D");
      return;
    }
    
    // Variables para controlar el rendimiento y la tasa de frames
    let lastProcessTime = 0;
    const targetFrameInterval = 1000/30; // Apuntar a 30 FPS para precisión
    let frameCount = 0;
    let lastFpsUpdateTime = Date.now();
    let processingFps = 0;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;
    
    // Crearemos un contexto dedicado para el procesamiento de imagen
    const enhanceCanvas = document.createElement('canvas');
    const enhanceCtx = enhanceCanvas.getContext('2d', {willReadFrequently: true});
    enhanceCanvas.width = 320;  // Tamaño óptimo para procesamiento PPG
    enhanceCanvas.height = 240;
    
    // Activar el flag de procesamiento
    isProcessingFramesRef.current = true;
    
    const processImage = async () => {
      // CRÍTICO: Verificar si debemos seguir procesando
      if (!isProcessingFramesRef.current || !isMonitoring) {
        console.log("processImage: Deteniendo loop de procesamiento");
        return;
      }
      
      // Verificar que el track siga siendo válido
      if (!videoTrack || videoTrack.readyState !== 'live') {
        console.error("processImage: Track de video ya no está activo");
        isProcessingFramesRef.current = false;
        return;
      }
      
      const now = Date.now();
      const timeSinceLastProcess = now - lastProcessTime;
      
      // Control de tasa de frames para no sobrecargar el dispositivo
      if (timeSinceLastProcess >= targetFrameInterval) {
        try {
          // Capturar frame con verificación de estado
          const frame = await imageCapture.grabFrame();
          
          // Reset contador de errores consecutivos
          consecutiveErrors = 0;
          
          // Configurar tamaño adecuado del canvas para procesamiento
          const targetWidth = Math.min(320, frame.width);
          const targetHeight = Math.min(240, frame.height);
          
          tempCanvas.width = targetWidth;
          tempCanvas.height = targetHeight;
          
          // Dibujar el frame en el canvas
          tempCtx.drawImage(
            frame, 
            0, 0, frame.width, frame.height, 
            0, 0, targetWidth, targetHeight
          );
          
          // Mejorar la imagen para detección PPG
          if (enhanceCtx) {
            // Resetear canvas
            enhanceCtx.clearRect(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            
            // Dibujar en el canvas de mejora
            enhanceCtx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
            
            // Opcionales: Ajustes para mejorar la señal roja
            enhanceCtx.globalCompositeOperation = 'source-over';
            enhanceCtx.fillStyle = 'rgba(255,0,0,0.05)';  // Sutil refuerzo del canal rojo
            enhanceCtx.fillRect(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            enhanceCtx.globalCompositeOperation = 'source-over';
          
            // Obtener datos de la imagen mejorada
            const imageData = enhanceCtx.getImageData(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            
            // --- ADDED LOGGING ---
            console.log("Index.tsx: Image data captured from enhanceCanvas", {
                width: imageData.width,
                height: imageData.height,
                dataLength: imageData.data.length,
            });
            // --- END ADDED LOGGING ---

            // Procesar el frame mejorado
            processFrame(imageData);
          } else {
            // Fallback a procesamiento normal
            const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
            
            // --- ADDED LOGGING (Fallback) ---
             console.log("Index.tsx: Image data captured from tempCanvas (fallback)", {
                width: imageData.width,
                height: imageData.height,
                dataLength: imageData.data.length,
            });
            // --- END ADDED LOGGING (Fallback) ---

            processFrame(imageData);
          }
          
          // Actualizar contadores para monitoreo de rendimiento
          frameCount++;
          lastProcessTime = now;
          
          // Calcular FPS cada segundo
          if (now - lastFpsUpdateTime > 1000) {
            processingFps = frameCount;
            frameCount = 0;
            lastFpsUpdateTime = now;
            console.log(`Rendimiento de procesamiento: ${processingFps} FPS`);
          }
        } catch (error) {
          consecutiveErrors++;
          console.error(`Error capturando frame (${consecutiveErrors}/${maxConsecutiveErrors}):`, error);
          
          // Si hay demasiados errores consecutivos, detener el procesamiento
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.error("Demasiados errores consecutivos, deteniendo procesamiento de frames");
            isProcessingFramesRef.current = false;
            return;
          }
        }
      }
      
      // Programar el siguiente frame SOLO si debemos seguir procesando
      if (isProcessingFramesRef.current && isMonitoring) {
        processingLoopRef.current = requestAnimationFrame(processImage);
      }
    };

    // Iniciar el loop de procesamiento
    console.log("Iniciando loop de procesamiento de frames");
    processImage();
  };

  useEffect(() => {
    if (lastSignal) {
      console.log("[DIAG] Index.tsx: lastSignal actualizado", {
        timestamp: new Date(lastSignal.timestamp).toISOString(),
        fingerDetected: lastSignal.fingerDetected,
        quality: lastSignal.quality,
        rawValue: lastSignal.rawValue,
        filteredValue: lastSignal.filteredValue
      });
    }
  }, [lastSignal]);

  useEffect(() => {
    if (lastSignal && lastSignal.fingerDetected && isMonitoring) {
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      setHeartRate(heartBeatResult.bpm);
      setHeartbeatSignal(heartBeatResult.filteredValue);
      setBeatMarker(heartBeatResult.isPeak ? 1 : 0);
      // Actualizar últimos intervalos RR para debug
      if (heartBeatResult.rrData && heartBeatResult.rrData.intervals) {
        setRRIntervals(heartBeatResult.rrData.intervals.slice(-5));
      }
      
      const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
      if (vitals) {
        setVitalSigns(vitals);
        
        if (vitals.lastArrhythmiaData) {
          setLastArrhythmiaData(vitals.lastArrhythmiaData);
          const [status, count] = vitals.arrhythmiaStatus.split('|');
          setArrhythmiaCount(count || "0");
          
          // Aquí detectamos si hay arritmia y enviamos la señal al HeartBeatProcessor
          const isArrhythmiaDetected = status === "ARRITMIA DETECTADA";
          
          // Solo actualizamos cuando cambia el estado para no sobrecargar
          if (isArrhythmiaDetected !== arrhythmiaDetectedRef.current) {
            arrhythmiaDetectedRef.current = isArrhythmiaDetected;
            setArrhythmiaState(isArrhythmiaDetected);
            
            // Mostrar un toast cuando se detecta arritmia por primera vez
            if (isArrhythmiaDetected) {
              console.log("Arritmia detectada - Activando sonido distintivo");
              toast({
                title: "¡Arritmia detectada!",
                description: "Se activará un sonido distintivo con los latidos.",
                variant: "destructive",
                duration: 3000,
              });
            }
          }
        }
      }
      
      setSignalQuality(lastSignal.quality);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, setArrhythmiaState]);

  // Referencia para activar o desactivar el sonido de arritmia
  const arrhythmiaDetectedRef = useRef(false);
  
  // Nueva función para alternar medición
  const handleToggleMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      startMonitoring();
    }
  };

  const formatPressureForDisplay = (
    pressureData: BPResultType | { systolic: 0, diastolic: 0, confidence: 0, status?: string }
  ): string => {
    if (pressureData && typeof pressureData === 'object') {
      if ('systolic' in pressureData && pressureData.systolic > 0 && 
          'diastolic' in pressureData && pressureData.diastolic > 0) {
        return `${pressureData.systolic}/${pressureData.diastolic}`;
      }
      // Check for status only if systolic/diastolic aren't valid for display
      if ('status' in pressureData && typeof pressureData.status === 'string') {
        return pressureData.status;
      }
    }
    return "--/--";
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-black" style={{ 
      height: '100svh',
      width: '100vw',
      maxWidth: '100vw',
      maxHeight: '100svh',
      overflow: 'hidden',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)'
    }}>
      {/* Overlay de error crítico/calibración */}
      {criticalError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="text-center p-6 bg-red-900/80 rounded-lg shadow-xl text-white max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-2">Atención</h2>
            <p className="mb-4 text-lg">{criticalError}</p>
            {calibrationStatus && calibrationStatus.recommendations && (
              <ul className="mb-4 text-left list-disc list-inside text-sm">
                {calibrationStatus.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            )}
            <button
              className="mt-2 px-4 py-2 bg-primary rounded text-white font-semibold"
              onClick={handleReset}
            >
              Reintentar calibración
            </button>
          </div>
        </div>
      )}
      {/* Debug overlay de intervalos RR */}
      {rrIntervals.length > 0 && (
        <div className="absolute top-4 left-4 text-white z-20 bg-black/50 p-2 rounded">
          Últimos intervalos RR: {rrIntervals.map(i => i + ' ms').join(', ')}
        </div>
      )}
      {/* Overlay button for re-entering fullscreen if user exits */}
      {!isFullscreen && (
        <button 
          onClick={enterFullScreen}
          className="fixed inset-0 z-50 w-full h-full flex items-center justify-center bg-black/90 text-white"
        >
          <div className="text-center p-4 bg-primary/20 rounded-lg backdrop-blur-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
            <p className="text-lg font-semibold">Toca para modo pantalla completa</p>
          </div>
        </button>
      )}

      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <CameraView 
            onStreamReady={handleStreamReady}
            isMonitoring={isCameraOn}
            isFingerDetected={lastSignal?.fingerDetected}
            signalQuality={signalQuality}
          />
        </div>

        <div className="relative z-10 h-full flex flex-col">
          {/* Se agrega header para sensor de calidad y estado de huella digital */}
          <div className="px-4 py-2 flex flex-col items-center bg-black/30">
            <div className="flex justify-around items-center w-full">
              <div className="text-white text-sm">
                Calidad: {signalQuality}
                {lastSignal?.debugInfo?.dbgRawQuality !== undefined && ` (Raw: ${lastSignal.debugInfo.dbgRawQuality.toFixed(0)})`}
              </div>
              <div className="text-white text-sm">
                {lastSignal?.fingerDetected ? "Dedo Detectado" : "No Dedo"}
              </div>
            </div>
            {/* Fila adicional para debugInfo detallado */ 
            (lastSignal?.debugInfo && (
              <div className="flex flex-col items-center w-full mt-1 text-xs text-gray-400">
                <div className="flex justify-around items-center w-full">
                  <span>
                    SpecConf: {lastSignal.debugInfo.dbgSpectralConfidence !== undefined ? lastSignal.debugInfo.dbgSpectralConfidence.toFixed(2) : "N/A"}
                  </span>
                  <span>
                    PulsScore: {lastSignal.debugInfo.pulsatilityScore !== undefined ? lastSignal.debugInfo.pulsatilityScore.toFixed(2) : "N/A"}
                  </span>
                  <span>
                    StabScore: {lastSignal.debugInfo.stabilityScore !== undefined ? lastSignal.debugInfo.stabilityScore.toFixed(2) : "N/A"}
                  </span>
                </div>
                {(lastSignal.debugInfo.rejectionReasons && lastSignal.debugInfo.rejectionReasons.length > 0) && (
                  <div className="mt-1 text-red-400 w-full text-center">
                    Rechazado por: {lastSignal.debugInfo.rejectionReasons.join(', ')}
                  </div>
                )}
                {(lastSignal.debugInfo.acceptanceReasons && lastSignal.debugInfo.acceptanceReasons.length > 0) && (
                  <div className="mt-1 text-green-400 w-full text-center">
                    Aceptado por: {lastSignal.debugInfo.acceptanceReasons.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex-1">
            <PPGSignalMeter 
              value={beatMarker}
              quality={lastSignal?.quality || 0}
              isFingerDetected={lastSignal?.fingerDetected || false}
              onStartMeasurement={startMonitoring}
              onReset={handleReset}
              arrhythmiaStatus={vitalSigns.arrhythmiaStatus}
              rawArrhythmiaData={lastArrhythmiaData}
              preserveResults={showResults}
            />
          </div>

          {/* Contenedor de los displays ampliado y con mayor espaciamiento */}
          <div className="absolute inset-x-0 top-[55%] bottom-[60px] bg-black/10 px-4 py-6">
            <div className="grid grid-cols-2 gap-4">
              <VitalSign 
                label="FRECUENCIA CARDÍACA" 
                value={vitalSigns.heartRate > 0 ? vitalSigns.heartRate : heartbeatSignal > 0 ? heartbeatSignal : '--'} 
                unit="BPM" 
                highlighted={showResults}
                calibrationProgress={calibrationProgress?.progress.heartRate}
              />
              <VitalSign 
                label="SPO2" 
                value={vitalSigns.spo2 > 0 ? vitalSigns.spo2 : '--'} 
                unit="%" 
                highlighted={showResults}
                calibrationProgress={calibrationProgress?.progress.spo2}
              />
              <VitalSign 
                label="PRESIÓN ARTERIAL" 
                value={formatPressureForDisplay(vitalSigns.pressure)} 
                unit="mmHg" 
                highlighted={showResults}
                calibrationProgress={calibrationProgress?.progress.pressure}
              />
              <VitalSign 
                label="ARRITMIAS" 
                value={arrhythmiaCount} // arrhythmiaCount ya es string o number
                unit="" 
                highlighted={showResults}
                calibrationProgress={calibrationProgress?.progress.arrhythmia}
              />
              <VitalSign 
                label="GLUCOSA" 
                value={vitalSigns.glucose > 0 ? vitalSigns.glucose : '--'} 
                unit="mg/dL" 
                highlighted={showResults} 
                calibrationProgress={calibrationProgress?.progress.glucose}
              />
              <VitalSign 
                label="COLESTEROL/TRIGL." 
                value={vitalSigns.lipids.totalCholesterol > 0 ? `${vitalSigns.lipids.totalCholesterol}/${vitalSigns.lipids.triglycerides}` : '--'} 
                unit="mg/dL" 
                highlighted={showResults}
                calibrationProgress={calibrationProgress?.progress.lipids}
              />
              {/* <VitalSign 
                label="HEMOGLOBINA" 
                value={vitalSigns.hemoglobin > 0 ? vitalSigns.hemoglobin : '--'} 
                unit="g/dL" 
                highlighted={showResults}
                calibrationProgress={calibrationProgress?.progress.hemoglobin}
              /> */}
            </div>
          </div>

          {/* Botonera inferior: botón de iniciar/detener y de reset en fila */}
          <div className="absolute inset-x-0 bottom-4 flex gap-4 px-4">
            <div className="w-1/2">
              <MonitorButton 
                isMonitoring={isMonitoring} 
                onToggle={handleToggleMonitoring} 
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
