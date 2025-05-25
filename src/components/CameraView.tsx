
import React, { useRef, useEffect, useState } from 'react';
import { SimpleCameraManager } from '../modules/camera/SimpleCameraManager';
import { toast } from "@/components/ui/use-toast";
import { debugCamera } from '../utils/debug';

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
      debugCamera("Starting camera for monitoring");
      
      // Create simple camera manager
      cameraManagerRef.current = new SimpleCameraManager(
        (stream) => {
          debugCamera("Stream ready callback received", {
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            cameraManagerRef.current?.setVideoElement(videoRef.current);
            debugCamera("Video element updated with stream");
          }
          
          setIsReady(true);
          setError(null);
          
          if (onStreamReady) {
            debugCamera("Calling onStreamReady callback");
            onStreamReady(stream);
          }
        },
        (errorMsg) => {
          debugCamera("Camera error received", errorMsg);
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
      debugCamera("Stopping camera - monitoring disabled");
      
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
        debugCamera("Cleanup - stopping camera");
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
      debugCamera("Video element loaded and ready", {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState
      });
      setIsReady(true);
    };

    const handleError = (e: Event) => {
      debugCamera("Video element error", e);
      setError("Error del elemento de video");
    };

    const handlePlay = () => {
      debugCamera("Video started playing");
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    video.addEventListener('play', handlePlay);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      video.removeEventListener('play', handlePlay);
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

      {/* Debug info */}
      <div className="absolute bottom-4 left-4 bg-black/50 text-white p-2 rounded text-xs">
        <div>Monitor: {isMonitoring ? 'ON' : 'OFF'}</div>
        <div>Ready: {isReady ? 'YES' : 'NO'}</div>
        <div>Error: {error || 'NONE'}</div>
        <div>Finger: {isFingerDetected ? 'DETECTED' : 'NOT DETECTED'}</div>
        <div>Quality: {signalQuality.toFixed(1)}%</div>
      </div>
    </div>
  );
};

export default CameraView;
