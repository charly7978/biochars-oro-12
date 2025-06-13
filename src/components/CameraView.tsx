import React, { useRef, useEffect, useState } from "react";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";

export const CameraView: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [rawSignal, setRawSignal] = useState<number[]>([]);
  const signalProc = useSignalProcessor();
  const heartProc = useHeartBeatProcessor();

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
      // Actualiza buffer de señal cruda
      setRawSignal((prev) => {
        const next = [...prev, avgRed];
        if (next.length > 300) next.shift();
        return next;
      });
      // Procesa señal si hay suficiente buffer
      if (rawSignal.length > 60) {
        signalProc.process(frame, canvas.width, canvas.height, rawSignal);
        if (signalProc.peaks && signalProc.peaks.length > 1) {
          heartProc.processPeaks(signalProc.peaks);
        }
      }
      animationId = requestAnimationFrame(processFrame);
    }
    if (streaming) {
      animationId = requestAnimationFrame(processFrame);
    }
    return () => {
      cancelAnimationFrame(animationId);
    };
    // eslint-disable-next-line
  }, [streaming, rawSignal, signalProc, heartProc]);

  return (
    <div>
      <video ref={videoRef} style={{ display: "none" }} playsInline />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div>
        {signalProc.warning && (
          <div style={{ color: "red" }}>{signalProc.warning}</div>
        )}
        {heartProc.bpm && (
          <div>
            <strong>BPM:</strong> {heartProc.bpm}
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraView;
