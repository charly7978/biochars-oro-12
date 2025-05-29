import React, { useRef, useEffect, useState } from 'react';
import { toast } from "@/components/ui/use-toast";

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
}

const CameraView = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
}: CameraViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const frameIntervalRef = useRef<number>(1000 / 30); // 30 FPS
  const lastFrameTimeRef = useRef<number>(0);
  const [deviceSupportsAutoFocus, setDeviceSupportsAutoFocus] = useState(false);
  const [deviceSupportsTorch, setDeviceSupportsTorch] = useState(false);
  const torchAttempts = useRef<number>(0);
  const cameraInitialized = useRef<boolean>(false);
  const requestedTorch = useRef<boolean>(false);
  const attemptCount = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const torchRetryTimer = useRef<number | null>(null);
  const MAX_TORCH_ATTEMPTS = 5;
  const TORCH_RETRY_DELAY_MS = 500;

  const stopCamera = () => {
    if (stream) {
      console.log("Stopping camera stream and turning off torch");
      stream.getTracks().forEach(track => {
        // Turn off torch if it's available
        if (track.kind === 'video' && track.getCapabilities()?.torch) {
          track.applyConstraints({
            advanced: [{ torch: false }]
          }).catch(err => console.error("Error desactivando linterna:", err));
        }
        
        // Stop the track
        track.stop();
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
      streamRef.current = null;
      setTorchEnabled(false);
      cameraInitialized.current = false;
      requestedTorch.current = false;
    }
  };

  const startCamera = () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.error("Su dispositivo no soporta acceso a la cámara");
        toast({
          title: "Error de cámara",
          description: "Su dispositivo no soporta acceso a la cámara",
          variant: "destructive"
        });
        throw new Error("getUserMedia no está soportado");
      }

      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isDesktop = !isAndroid && !isIOS;

      // Configuración optimizada para captura PPG - ajustes para mejor detección
      let baseVideoConstraints: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      console.log("CameraView: Configurando cámara para detección de dedo");

      // Solo especificar facingMode='environment' en móviles
      if (isAndroid || isIOS) {
        baseVideoConstraints.facingMode = { exact: 'environment' };
      }

      if (isAndroid) {
        // Ajustes para mejorar la extracción de señal en Android
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 30 },
          resizeMode: 'crop-and-scale'
        });
      } else if (isIOS) {
        // Ajustes específicos para iOS
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 30 },
        });
      } else {
        // Para Windows y otros desktops, configuración más flexible
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30 }
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("CameraView: Intentando obtener acceso a la cámara con constraints:", constraints);
      
      navigator.mediaDevices.getUserMedia(constraints)
        .then(newStream => {
          console.log("CameraView: Acceso a la cámara obtenido exitosamente");
          handleStream(newStream);
        })
        .catch(err => {
          attemptCount.current += 1;
          console.error(`CameraView: Error al acceder a la cámara (intento ${attemptCount.current}):`, err);
          
          // Si fallamos en desktop, intentar con configuración más simple
          if (isDesktop) {
            console.log("CameraView: Intentando con configuración alternativa para Windows");
            const simpleConstraints: MediaStreamConstraints = {
              video: true,
              audio: false
            };
            
            navigator.mediaDevices.getUserMedia(simpleConstraints)
              .then(fallbackStream => {
                console.log("CameraView: Acceso a la cámara obtenido con configuración alternativa");
                handleStream(fallbackStream);
              })
              .catch(fallbackErr => {
                console.error("CameraView: Error con configuración alternativa:", fallbackErr);
                toast({
                  title: "Error de cámara",
                  description: "No se pudo acceder a la cámara. Intente con otro navegador o dispositivo.",
                  variant: "destructive"
                });
              });
          } else {
            // Si estamos en móvil, mostrar un mensaje de error
            toast({
              title: "Error de cámara",
              description: "No se pudo acceder a la cámara. Revise los permisos e intente de nuevo.",
              variant: "destructive"
            });
          }
        });
    } catch (err) {
      console.error("CameraView: Error general al iniciar la cámara:", err);
      toast({
        title: "Error de cámara",
        description: "Error inesperado al inicializar la cámara",
        variant: "destructive"
      });
    }
  };

  const handleStream = (newStream: MediaStream) => {
    // Guardar referencia al stream para estabilidad
    streamRef.current = newStream;
    
    // NUEVO: Verificación de callback
    if (!onStreamReady) {
      console.error("CameraView: onStreamReady callback no disponible");
      toast({
        title: "Error de cámara",
        description: "No hay callback para procesar el video",
        variant: "destructive"
      });
    }
    
    const videoTrack = newStream.getVideoTracks()[0];

    if (videoTrack) {
      try {
        const capabilities = videoTrack.getCapabilities();
        console.log("CameraView: Capacidades de la cámara:", capabilities);
        
        // Resetear contador de intentos de linterna
        torchAttempts.current = 0;
        requestedTorch.current = false;
        
        const advancedConstraints: MediaTrackConstraintSet[] = [];
        
        // Configuración optimizada para captura PPG
        if (capabilities.exposureMode) {
          // Exposición manual para tener mejores resultados con PPG
          advancedConstraints.push({ 
            exposureMode: 'manual'
          });
          console.log("CameraView: Modo de exposición manual aplicado");

          // Solo si tiene controles de exposición, intentamos establecer un valor
          if (capabilities.exposureTime) {
            const minExposure = capabilities.exposureTime.min || 0;
            const maxExposure = capabilities.exposureTime.max || 1000;
            // Usar un valor más alto de exposición para capturar mejor la señal PPG
            const targetExposure = maxExposure * 0.8;
            
            advancedConstraints.push({
              exposureTime: targetExposure
            });
            console.log(`CameraView: Tiempo de exposición ajustado a ${targetExposure}`);
          }
        }
        
        if (capabilities.focusMode) {
          advancedConstraints.push({ focusMode: 'continuous' });
          setDeviceSupportsAutoFocus(true);
          console.log("CameraView: Modo de enfoque continuo aplicado");
        }
        
        if (capabilities.whiteBalanceMode) {
          advancedConstraints.push({ whiteBalanceMode: 'continuous' });
          console.log("CameraView: Modo de balance de blancos continuo aplicado");
        }

        // Aplicar configuraciones avanzadas con tiempo de espera para estabilidad
        if (advancedConstraints.length > 0) {
          // Esperar un momento antes de aplicar constraints
          setTimeout(() => {
            videoTrack.applyConstraints({
              advanced: advancedConstraints
            }).catch(err => {
              console.error("CameraView: Error aplicando constraints avanzados:", err);
            });
            console.log("CameraView: Constraints avanzados aplicados exitosamente");
          }, 300);
        }

        if (videoRef.current) {
          videoRef.current.style.transform = 'translateZ(0)';
          videoRef.current.style.backfaceVisibility = 'hidden';
        }
        
        // Verificar disponibilidad de linterna - con tiempo de espera para estabilidad
        if (capabilities.torch) {
          console.log("CameraView: Este dispositivo tiene linterna disponible");
          setDeviceSupportsTorch(true);
          
          // Esperar un momento antes de activar la linterna
          setTimeout(() => {
            attemptToEnableTorch(videoTrack);
          }, 300);
        } else {
          console.log("CameraView: Este dispositivo no tiene linterna disponible");
          setDeviceSupportsTorch(false);
        }
      } catch (err) {
        console.log("CameraView: No se pudieron aplicar algunas optimizaciones:", err);
      }
    }

    if (videoRef.current) {
      videoRef.current.srcObject = newStream;
      if (/android/i.test(navigator.userAgent)) {
        videoRef.current.style.willChange = 'transform';
        videoRef.current.style.transform = 'translateZ(0)';
      }
    }

    setStream(newStream);
    cameraInitialized.current = true;
    
    // CRÍTICO: Asegurar que el callback se llame correctamente después de que el video esté listo
    if (onStreamReady) {
      // Esperar a que el video esté listo antes de llamar al callback
      videoRef.current?.addEventListener('loadedmetadata', () => {
        console.log("CameraView: Video metadata cargada, llamando onStreamReady");
        if (onStreamReady && streamRef.current) {
          onStreamReady(streamRef.current);
        }
      }, { once: true });
      
      // Respaldo: si después de 1 segundo no se ha disparado el evento, llamar al callback
      setTimeout(() => {
        if (onStreamReady && streamRef.current && cameraInitialized.current) {
          console.log("CameraView: Llamando onStreamReady (respaldo por timeout)");
          onStreamReady(streamRef.current);
        }
      }, 1000);
    }
  };

  useEffect(() => {
    if (isMonitoring && !stream) {
      console.log("[DIAG] CameraView: Iniciando cámara porque isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("[DIAG] CameraView: Deteniendo cámara porque isMonitoring=false");
      stopCamera();
    }
    return () => {
      console.log("[DIAG] CameraView: Desmontando componente, deteniendo cámara");
      stopCamera();
    };
  }, [isMonitoring]);

  // Efecto para mantener la linterna encendida durante toda la medición
  useEffect(() => {
    if (!stream || !deviceSupportsTorch || !isMonitoring) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || !videoTrack.getCapabilities()?.torch) return;
    
    /*
     * Mantiene la linterna encendida mientras la medición esté activa.
     * Antes sólo se intentaba re-encender si `torchEnabled` era false, pero este estado
     * no se actualizaba si la linterna se apagaba de forma externa (ahorro de energía,
     * cambios de foco, etc.).
     * Ahora se comprueba directamente el estado real mediante `getSettings().torch` y
     * se reactiva cuando sea necesario.
     */
    const keepTorchOn = () => {
      if (!isMonitoring || !deviceSupportsTorch || !stream) return;

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || !videoTrack.getSettings) return;

      const torchIsReallyOn = (videoTrack.getSettings() as any).torch === true;

      if (!torchIsReallyOn) {
        console.log("CameraView: Re-activando linterna (torch)");
        videoTrack.applyConstraints({ advanced: [{ torch: true }] })
          .then(() => {
            setTorchEnabled(true);
            requestedTorch.current = true;
          })
          .catch(err => {
            console.error("CameraView: Error re-encendiendo linterna:", err);
            torchAttempts.current++;
            setTorchEnabled(false);
          });
      } else {
        // Mantener el estado de la UI sincronizado con el estado real
        if (!torchEnabled) {
          setTorchEnabled(true);
        }
      }
    };
    
    // Verificar periódicamente que la linterna permanezca encendida
    const torchCheckInterval = setInterval(keepTorchOn, 2000);
    
    // Activar inmediatamente
    keepTorchOn();
    
    return () => {
      clearInterval(torchCheckInterval);
    };
  }, [stream, isMonitoring, deviceSupportsTorch, torchEnabled]);

  // Enfoque automático optimizado para la detección PPG
  useEffect(() => {
    if (!stream || !isMonitoring || !deviceSupportsAutoFocus) return;
    
    let focusInterval: number;
    
    // Adaptamos la frecuencia de enfoque según si hay dedo o no
    const focusIntervalTime = isFingerDetected ? 4000 : 1500;
    
    const attemptRefocus = () => {
      if (!stream) return;
      
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.focusMode) {
        console.log("CameraView: Ajustando enfoque para optimizar detección");
        videoTrack.applyConstraints({
          advanced: [{ focusMode: 'continuous' }]
        }).catch(err => {
          console.warn("CameraView: Error al intentar re-enfocar:", err);
        });
      }
    };
    
    // Enfocamos inmediatamente cuando cambia el estado del dedo
    attemptRefocus();
    
    focusInterval = window.setInterval(attemptRefocus, focusIntervalTime);
    
    return () => {
      clearInterval(focusInterval);
    };
  }, [stream, isMonitoring, isFingerDetected, deviceSupportsAutoFocus]);

  const attemptToEnableTorch = (videoTrack: MediaStreamTrack) => {
    if (!videoTrack || !videoTrack.getCapabilities()?.torch) {
      console.warn("CameraView: No se puede intentar activar la linterna: track o capacidad no disponible.");
      return;
    }

    if (torchAttempts.current >= MAX_TORCH_ATTEMPTS) {
      console.error(`CameraView: Máximo número de intentos de linterna alcanzado (${MAX_TORCH_ATTEMPTS}). Falló la activación.`);
      // Mostrar mensaje al usuario si es crucial
      toast({
        title: "Linterna Requerida",
        description: "No se pudo activar la linterna. La medición puede no ser posible o fiable.",
        variant: "destructive"
      });
      requestedTorch.current = false; // Reset para permitir reintentos si se llama startCamera de nuevo
      setTorchEnabled(false);
      return;
    }

    torchAttempts.current++;
    console.log(`CameraView: Intentando activar linterna (Intento ${torchAttempts.current}/${MAX_TORCH_ATTEMPTS})`);

    videoTrack.applyConstraints({
      advanced: [{ torch: true }]
    }).then(() => {
      console.log("CameraView: Linterna activada exitosamente.");
      setTorchEnabled(true);
      requestedTorch.current = true;
      // Limpiar timer si estaba programado un reintento
      if (torchRetryTimer.current) {
        clearTimeout(torchRetryTimer.current);
        torchRetryTimer.current = null;
      }
    }).catch(err => {
      console.warn(`CameraView: Falló la activación de linterna (Intento ${torchAttempts.current}):`, err);
      setTorchEnabled(false);
      requestedTorch.current = false; // Considerar si esto debe ser true para seguir reintentando
      
      // Programar próximo reintento
      torchRetryTimer.current = window.setTimeout(() => {
        attemptToEnableTorch(videoTrack);
      }, TORCH_RETRY_DELAY_MS);
    });
  };

  useEffect(() => {
    // Este effect ahora solo maneja la limpieza del timer de reintento
    return () => {
      if (torchRetryTimer.current) {
        clearTimeout(torchRetryTimer.current);
        torchRetryTimer.current = null;
      }
    };
  }, []);

  // Mantener la linterna encendida si está monitoreando y la linterna está soportada
  useEffect(() => {
    if (isMonitoring && deviceSupportsTorch && streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.torch && !torchEnabled && requestedTorch.current) {
        console.log("CameraView: Detectada linterna apagada, intentando reactivar...");
        // Limpiar intentos anteriores antes de reintentar activarla aquí
        torchAttempts.current = 0;
        attemptToEnableTorch(videoTrack);
      }
    } else if (!isMonitoring && torchEnabled) {
      // Si deja de monitorear y la linterna está encendida, apagarla
      stopCamera(); // stopCamera ya maneja apagar la linterna
    }
  }, [isMonitoring, deviceSupportsTorch, streamRef, torchEnabled, requestedTorch]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute top-0 left-0 min-w-full min-h-full w-auto h-auto z-0 object-cover"
      style={{
        willChange: 'transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden'
      }}
    />
  );
};

export default CameraView;
