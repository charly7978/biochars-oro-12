import React, { useRef, useEffect, useState } from "react";

interface CameraViewProps {
  onFrame: (
    frame: Uint8ClampedArray,
    width: number,
    height: number,
    rawSignal: number[]
  ) => void;
  isMonitoring: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({
  onFrame,
  isMonitoring,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [rawSignal, setRawSignal] = useState<number[]>([]);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setStreaming(true);
      } catch (err) {
        setStreaming(false);
      }
    }
    startCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    let animationId: number;
    function processFrame() {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      // Extrae el canal rojo promedio
      let sumRed = 0;
      let n = 0;
      for (let i = 0; i < frame.length; i += 4) {
        sumRed += frame[i];
        n++;
      }
      const avgRed = sumRed / n;
      setRawSignal((prev) => {
        const next = [...prev, avgRed];
        if (next.length > 300) next.shift();
        return next;
      });
      if (rawSignal.length > 60 && isMonitoring) {
        onFrame(frame, canvas.width, canvas.height, rawSignal);
      }
      animationId = requestAnimationFrame(processFrame);
    }
    if (streaming) {
      animationId = requestAnimationFrame(processFrame);
    }
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [streaming, rawSignal, isMonitoring, onFrame]);

  return (
    <div>
      <video ref={videoRef} style={{ display: "none" }} playsInline />
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};

export default CameraView;
