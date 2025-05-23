
import React, { useRef, useEffect, useState } from 'react';
import { SimpleCameraManager } from '../modules/camera/SimpleCameraManager';
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
  const cameraManagerRef = useRef<SimpleCameraManager | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isMonitoring && !cameraManagerRef.current) {
      console.log("CameraView: Starting camera");
      
      // Create simple camera manager
      cameraManagerRef.current = new SimpleCameraManager(
        (stream) => {
          console.log("CameraView: Stream ready");
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            cameraManagerRef.current?.setVideoElement(videoRef.current);
          }
          
          setIsReady(true);
          setError(null);
          
          if (onStreamReady) {
            onStreamReady(stream);
          }
        },
        (errorMsg) => {
          console.error("CameraView: Camera error", errorMsg);
          setError(errorMsg);
          setIsReady(false);
          
          toast({
            title: "Error de cámara",
            description: errorMsg,
            variant: "destructive"
          });
        }
      );

      // Start camera
      cameraManagerRef.current.startCamera();
    } 
    else if (!isMonitoring && cameraManagerRef.current) {
      console.log("CameraView: Stopping camera");
      
      cameraManagerRef.current.stopCamera();
      cameraManagerRef.current = null;
      setIsReady(false);
      setError(null);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (cameraManagerRef.current) {
        cameraManagerRef.current.stopCamera();
        cameraManagerRef.current = null;
      }
    };
  }, [isMonitoring, onStreamReady]);

  // Handle video element events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      console.log("CameraView: Video loaded and ready");
      setIsReady(true);
    };

    const handleError = (e: Event) => {
      console.error("CameraView: Video element error", e);
      setError("Error del elemento de video");
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute top-0 left-0 min-w-full min-h-full w-auto h-auto z-0 object-cover"
      />
      
      {/* Status overlay */}
      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white p-2 rounded z-10">
          {error}
        </div>
      )}
      
      {isMonitoring && !isReady && !error && (
        <div className="absolute top-4 left-4 right-4 bg-blue-500/90 text-white p-2 rounded z-10">
          Iniciando cámara...
        </div>
      )}
    </div>
  );
};

export default CameraView;
