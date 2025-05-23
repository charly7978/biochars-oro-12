
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
  const [deviceSupportsTorch, setDeviceSupportsTorch] = useState(false);
  const cameraInitialized = useRef<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

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
        return;
      }

      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      // Configuración simple y compatible
      let videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      };

      // Solo especificar facingMode en móviles
      if (isAndroid || isIOS) {
        videoConstraints.facingMode = { ideal: 'environment' };
      }

      const constraints: MediaStreamConstraints = {
        video: videoConstraints,
        audio: false
      };

      console.log("CameraView: Intentando obtener acceso a la cámara con constraints:", constraints);
      
      navigator.mediaDevices.getUserMedia(constraints)
        .then(newStream => {
          console.log("CameraView: Acceso a la cámara obtenido exitosamente");
          handleStream(newStream);
        })
        .catch(err => {
          console.error("CameraView: Error al acceder a la cámara:", err);
          
          // Fallback con configuración más simple
          console.log("CameraView: Intentando con configuración simple");
          const simpleConstraints: MediaStreamConstraints = {
            video: true,
            audio: false
          };
          
          navigator.mediaDevices.getUserMedia(simpleConstraints)
            .then(fallbackStream => {
              console.log("CameraView: Acceso a la cámara obtenido con configuración simple");
              handleStream(fallbackStream);
            })
            .catch(fallbackErr => {
              console.error("CameraView: Error con configuración simple:", fallbackErr);
              toast({
                title: "Error de cámara",
                description: "No se pudo acceder a la cámara. Verifique los permisos del navegador.",
                variant: "destructive"
              });
            });
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
    streamRef.current = newStream;
    
    if (!onStreamReady) {
      console.error("CameraView: onStreamReady callback no disponible");
      toast({
        title: "Error de cámara",
        description: "No hay callback para procesar el video",
        variant: "destructive"
      });
      return;
    }
    
    const videoTrack = newStream.getVideoTracks()[0];

    if (videoTrack) {
      try {
        const capabilities = videoTrack.getCapabilities();
        console.log("CameraView: Capacidades de la cámara:", capabilities);
        
        // Verificar linterna disponible
        if (capabilities.torch) {
          console.log("CameraView: Este dispositivo tiene linterna disponible");
          setDeviceSupportsTorch(true);
          
          // Intentar activar linterna después de un delay
          setTimeout(() => {
            videoTrack.applyConstraints({
              advanced: [{ torch: true }]
            }).then(() => {
              setTorchEnabled(true);
              console.log("CameraView: Linterna activada para medición PPG");
            }).catch(err => {
              console.warn("CameraView: No se pudo activar la linterna:", err);
              setTorchEnabled(false);
            });
          }, 1000);
        } else {
          console.log("CameraView: Este dispositivo no tiene linterna disponible");
          setDeviceSupportsTorch(false);
        }

        // NO aplicar constraints adicionales que pueden causar errores
        // Mantener la configuración simple para evitar "setPhotoOptions failed"
        
      } catch (err) {
        console.warn("CameraView: Error verificando capacidades de cámara:", err);
      }
    }

    if (videoRef.current) {
      videoRef.current.srcObject = newStream;
    }

    setStream(newStream);
    cameraInitialized.current = true;
    
    // Llamar al callback cuando el video esté listo
    if (onStreamReady) {
      videoRef.current?.addEventListener('loadedmetadata', () => {
        console.log("CameraView: Video metadata cargada, llamando onStreamReady");
        if (onStreamReady && streamRef.current) {
          onStreamReady(streamRef.current);
        }
      }, { once: true });
      
      // Respaldo por timeout
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

  // Mantener linterna encendida durante la medición
  useEffect(() => {
    if (!stream || !deviceSupportsTorch || !isMonitoring) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || !videoTrack.getCapabilities()?.torch) return;
    
    const keepTorchOn = () => {
      if (!isMonitoring || !deviceSupportsTorch || !stream) return;

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || !videoTrack.getSettings) return;

      const torchIsReallyOn = (videoTrack.getSettings() as any).torch === true;

      if (!torchIsReallyOn && torchEnabled) {
        console.log("CameraView: Re-activando linterna");
        videoTrack.applyConstraints({ advanced: [{ torch: true }] })
          .then(() => {
            setTorchEnabled(true);
          })
          .catch(err => {
            console.warn("CameraView: Error re-encendiendo linterna:", err);
            setTorchEnabled(false);
          });
      }
    };
    
    const torchCheckInterval = setInterval(keepTorchOn, 3000);
    
    return () => {
      clearInterval(torchCheckInterval);
    };
  }, [stream, isMonitoring, deviceSupportsTorch, torchEnabled]);

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
