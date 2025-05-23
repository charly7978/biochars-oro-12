import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Fingerprint, AlertCircle, BarChart2 } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';
import { formatPeakValue, getPeakColor, formatRRInterval, rrIntervalToBPM } from '../modules/heart-beat/peak-visualization';
import PeakHistoryChart from './PeakHistoryChart';

interface PPGSignalMeterProps {
  value: number;
  quality: number;
  isFingerDetected: boolean;
  onStartMeasurement: () => void;
  onReset: () => void;
  arrhythmiaStatus?: string;
  rawArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  preserveResults?: boolean;
}

const PPGSignalMeter = ({ 
  value, 
  quality, 
  isFingerDetected,
  onStartMeasurement,
  onReset,
  arrhythmiaStatus,
  rawArrhythmiaData,
  preserveResults = false
}: PPGSignalMeterProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataBufferRef = useRef<CircularBuffer | null>(null);
  const baselineRef = useRef<number | null>(null);
  const lastValueRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);
  const lastArrhythmiaTime = useRef<number>(0);
  const arrhythmiaCountRef = useRef<number>(0);
  const peaksRef = useRef<{time: number, value: number, isArrhythmia: boolean}[]>([]);
  const [showArrhythmiaAlert, setShowArrhythmiaAlert] = useState(false);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastConfirmedPeakRef = useRef<number>(0);
  const lastPeakLockRef = useRef<boolean>(false);
  const peakLockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const effectiveFingerDetectionRef = useRef<boolean>(isFingerDetected);
  const qualityStabilityCounterRef = useRef<number>(0);
  const fingerDetectionCounterRef = useRef<number>(0);

  // Optimized constants for better signal detection and visualization
  const WINDOW_WIDTH_MS = 2900;
  const CANVAS_WIDTH = 1000;
  const CANVAS_HEIGHT = 900;
  const GRID_SIZE_X = 10;
  const GRID_SIZE_Y = 10;
  const verticalScale = 155.0; // Increased for better visualization
  const SMOOTHING_FACTOR = 1.5; // Reduced to allow more details in the signal
  const TARGET_FPS = 60;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 600;
  const PEAK_DETECTION_WINDOW = 4; // Fine-tuned for better response
  const PEAK_THRESHOLD = 1.2; // More sensitive threshold
  const MIN_PEAK_DISTANCE_MS = 300; // Optimized for human heart rate
  const PEAK_LOCK_TIMEOUT_MS = 230; // Adjusted for typical heart rates
  const IMMEDIATE_RENDERING = true;
  const MAX_PEAKS_TO_DISPLAY = 25;
  const QUALITY_STABILITY_THRESHOLD = 5; // New: count of consistent quality readings
  const FINGER_DETECTION_THRESHOLD = 3; // New: min counts needed for finger detection
  const MIN_SIGNAL_FOR_PEAK = 0.8; // New: minimum signal strength for peak

  // Nueva ref para estadísticas de picos
  const peakStatsRef = useRef({
    maxPeak: 0,
    minPeak: Infinity,
    avgPeak: 0,
    totalPeaks: 0,
    lastRRInterval: null as number | null
  });

  // Enhanced finger detection logic to improve stability
  useEffect(() => {
    // Update the effective finger detection status with hysteresis
    if (isFingerDetected) {
      fingerDetectionCounterRef.current = Math.min(10, fingerDetectionCounterRef.current + 1);
      if (fingerDetectionCounterRef.current >= FINGER_DETECTION_THRESHOLD) {
        effectiveFingerDetectionRef.current = true;
      }
    } else {
      fingerDetectionCounterRef.current = Math.max(0, fingerDetectionCounterRef.current - 0.5);
      if (fingerDetectionCounterRef.current <= 0) {
        effectiveFingerDetectionRef.current = false;
      }
    }

    // Quality stability tracking
    if (quality > 40) {
      qualityStabilityCounterRef.current = Math.min(10, qualityStabilityCounterRef.current + 1);
    } else {
      qualityStabilityCounterRef.current = Math.max(0, qualityStabilityCounterRef.current - 0.5);
    }

    // Log enhanced detection status for debugging
    console.log("PPGSignalMeter: Enhanced finger detection status", {
      rawFingerDetected: isFingerDetected,
      effectiveFingerDetected: effectiveFingerDetectionRef.current,
      detectionCounter: fingerDetectionCounterRef.current,
      qualityCounter: qualityStabilityCounterRef.current,
      quality: quality
    });
  }, [isFingerDetected, quality]);

  // Get the peak values for history chart
  const getPeakValues = useCallback(() => {
    return peaksRef.current.map(peak => Math.abs(peak.value / verticalScale));
  }, [verticalScale]);

  // Calculate last RR interval
  const getLastRRInterval = useCallback(() => {
    if (peaksRef.current.length < 2) return null;
    const sortedPeaks = [...peaksRef.current].sort((a, b) => b.time - a.time);
    if (sortedPeaks.length >= 2) {
      return sortedPeaks[0].time - sortedPeaks[1].time;
    }
    return null;
  }, []);

  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer(BUFFER_SIZE);
    }
    if (preserveResults && !effectiveFingerDetectionRef.current) {
      if (dataBufferRef.current) {
        dataBufferRef.current.clear();
      }
      peaksRef.current = [];
      baselineRef.current = null;
      lastValueRef.current = null;
    }
  }, [preserveResults]);

  const getQualityColor = useCallback((q: number) => {
    // Use effective finger detection instead of raw isFingerDetected
    if (!effectiveFingerDetectionRef.current) return 'from-gray-400 to-gray-500';
    if (q > 75) return 'from-green-500 to-emerald-500';
    if (q > 50) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }, []);

  const getQualityText = useCallback((q: number) => {
    // Use effective finger detection instead of raw isFingerDetected
    if (!effectiveFingerDetectionRef.current) return 'Sin detección';
    if (q > 75) return 'Señal óptima';
    if (q > 50) return 'Señal aceptable';
    return 'Señal débil';
  }, []);

  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
    if (previousValue === null) return currentValue;
    return previousValue + SMOOTHING_FACTOR * (currentValue - previousValue);
  }, [SMOOTHING_FACTOR]);

  // Grid drawing function remains the same
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#FDF5E6';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.3)';
    ctx.lineWidth = 0.5;
    
    // Draw vertical grid lines
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE_X) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      if (x % (GRID_SIZE_X * 5) === 0) {
        ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(x.toString(), x, CANVAS_HEIGHT - 5);
      }
    }
    
    // Draw horizontal grid lines
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE_Y) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      if (y % (GRID_SIZE_Y * 5) === 0) {
        ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(y.toString(), 15, y + 3);
      }
    }
    ctx.stroke();
    
    // Draw center line (baseline)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.5)';
    ctx.lineWidth = 1;
    ctx.moveTo(0, CANVAS_HEIGHT / 2);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
    ctx.stroke();
    
    // Añadir escala vertical de referencia en el lado izquierdo
    ctx.fillStyle = 'rgba(40, 40, 40, 0.8)';
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'left';
    
    // Dibujar marcas de escala en el lado izquierdo con valores numéricos
    for (let i = 0; i <= 10; i++) {
      const y = CANVAS_HEIGHT / 2 - (CANVAS_HEIGHT * 0.4 * (i / 10));
      const value = (i / 10 * 10).toFixed(1);
      
      // Línea de marca
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(40, 40, 40, 0.5)';
      ctx.lineWidth = 1;
      ctx.moveTo(0, y);
      ctx.lineTo(10, y);
      ctx.stroke();
      
      // Valor numérico
      ctx.fillText(value, 15, y + 4);
    }
    
    // Draw arrhythmia status if present
    if (arrhythmiaStatus) {
      const [status, count] = arrhythmiaStatus.split('|');
      
      if (status.includes("ARRITMIA") && count === "1" && !showArrhythmiaAlert) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 24px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('¡PRIMERA ARRITMIA DETECTADA!', 45, 95);
        setShowArrhythmiaAlert(true);
      } else if (status.includes("ARRITMIA") && Number(count) > 1) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 24px Inter';
        ctx.textAlign = 'left';
        const redPeaksCount = peaksRef.current.filter(peak => peak.isArrhythmia).length;
        ctx.fillText(`Arritmias detectadas: ${count}`, 45, 95);
      }
    }
  }, [arrhythmiaStatus, showArrhythmiaAlert]);

  // Enhanced peak detection with better sensitivity
  const detectPeaks = useCallback((points: PPGDataPoint[], now: number) => {
    if (points.length < PEAK_DETECTION_WINDOW) return;
    
    // Skip peak detection if effective finger detection is false
    if (!effectiveFingerDetectionRef.current || qualityStabilityCounterRef.current < QUALITY_STABILITY_THRESHOLD) {
      return;
    }
    
    // Si hay un bloqueo activo, no detectar nuevos picos
    if (lastPeakLockRef.current) {
      return;
    }
    
    const potentialPeaks: {index: number, value: number, time: number, isArrhythmia: boolean}[] = [];
    
    for (let i = PEAK_DETECTION_WINDOW; i < points.length - PEAK_DETECTION_WINDOW; i++) {
      const currentPoint = points[i];
      
      // Verificar que el punto actual no esté demasiado cerca de un pico ya detectado
      const timeSinceLastPeak = currentPoint.time - lastConfirmedPeakRef.current;
      
      // Ignorar puntos que están demasiado cerca del último pico confirmado
      if (timeSinceLastPeak < MIN_PEAK_DISTANCE_MS) {
        continue;
      }
      
      // Verificar que no esté demasiado cerca de picos ya procesados
      const recentlyProcessed = peaksRef.current.some(
        peak => Math.abs(peak.time - currentPoint.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (recentlyProcessed) continue;
      
      // Enhanced peak detection: check if it's a peak by comparing with a wider range
      let isPeak = true;
      
      // Verificar que sea un máximo local mirando puntos antes
      for (let j = Math.max(0, i - PEAK_DETECTION_WINDOW); j < i; j++) {
        if (points[j].value >= currentPoint.value) {
          isPeak = false;
          break;
        }
      }
      
      // Verificar que sea un máximo local mirando puntos después
      if (isPeak) {
        for (let j = i + 1; j <= Math.min(points.length - 1, i + PEAK_DETECTION_WINDOW); j++) {
          if (points[j].value > currentPoint.value) {
            isPeak = false;
            break;
          }
        }
      }
      
      // Si es un pico y supera el umbral, registrarlo como potencial
      const normalizedPeakValue = Math.abs(currentPoint.value / verticalScale);
      if (isPeak && Math.abs(currentPoint.value) > PEAK_THRESHOLD && normalizedPeakValue > MIN_SIGNAL_FOR_PEAK) {
        potentialPeaks.push({
          index: i,
          value: currentPoint.value,
          time: currentPoint.time,
          isArrhythmia: currentPoint.isArrhythmia
        });
        
        console.log("PPGSignalMeter: Potential peak detected", {
          time: new Date(currentPoint.time).toISOString().slice(11, 23),
          normalizedValue: normalizedPeakValue.toFixed(2),
          rawValue: currentPoint.value.toFixed(2),
          timeSinceLastPeak: timeSinceLastPeak
        });
      }
    }
    
    // Procesar picos potenciales con verificación adicional
    for (const peak of potentialPeaks) {
      const tooClose = peaksRef.current.some(
        existingPeak => Math.abs(existingPeak.time - peak.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (!tooClose) {
        // Activar bloqueo para evitar picos duplicados
        lastPeakLockRef.current = true;
        
        // Configurar temporizador para liberar el bloqueo
        if (peakLockTimeoutRef.current) {
          clearTimeout(peakLockTimeoutRef.current);
        }
        
        peakLockTimeoutRef.current = setTimeout(() => {
          lastPeakLockRef.current = false;
        }, PEAK_LOCK_TIMEOUT_MS);
        
        peaksRef.current.push({
          time: peak.time,
          value: peak.value,
          isArrhythmia: peak.isArrhythmia
        });
        lastConfirmedPeakRef.current = peak.time;
        
        // Actualizar estadísticas de picos
        const normalizedPeakValue = Math.abs(peak.value / verticalScale);
        peakStatsRef.current.totalPeaks++;
        peakStatsRef.current.maxPeak = Math.max(peakStatsRef.current.maxPeak, normalizedPeakValue);
        peakStatsRef.current.minPeak = Math.min(peakStatsRef.current.minPeak, normalizedPeakValue);
        
        // Actualizar promedio acumulativo
        peakStatsRef.current.avgPeak = 
          (peakStatsRef.current.avgPeak * (peakStatsRef.current.totalPeaks - 1) + normalizedPeakValue) / 
          peakStatsRef.current.totalPeaks;
          
        // Actualizar último intervalo RR
        peakStatsRef.current.lastRRInterval = getLastRRInterval();
        
        console.log("PPGSignalMeter: CONFIRMED PEAK DETECTED", {
          time: new Date(peak.time).toISOString().slice(11, 23),
          normalizedValue: normalizedPeakValue.toFixed(2),
          peakValue: peak.value.toFixed(2),
          totalPeaks: peakStatsRef.current.totalPeaks
        });
      }
    }
    
    // Ordenar por tiempo y limitar la cantidad de picos
    peaksRef.current.sort((a, b) => a.time - b.time);
    
    peaksRef.current = peaksRef.current
      .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
      .slice(-MAX_PEAKS_TO_DISPLAY);
  }, [getLastRRInterval, verticalScale, PEAK_DETECTION_WINDOW, PEAK_THRESHOLD, MIN_PEAK_DISTANCE_MS, PEAK_LOCK_TIMEOUT_MS, MIN_SIGNAL_FOR_PEAK]);

  const renderSignal = useCallback(() => {
    if (!canvasRef.current || !dataBufferRef.current) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const currentTime = performance.now();
    const timeSinceLastRender = currentTime - lastRenderTimeRef.current;
    
    if (!IMMEDIATE_RENDERING && timeSinceLastRender < FRAME_TIME) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const now = Date.now();
    
    drawGrid(ctx);
    
    if (preserveResults && !effectiveFingerDetectionRef.current) {
      lastRenderTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    if (baselineRef.current === null) {
      baselineRef.current = value;
    } else {
      // More responsive baseline adjustment
      baselineRef.current = baselineRef.current * 0.92 + value * 0.08;
    }
    
    const smoothedValue = smoothValue(value, lastValueRef.current);
    lastValueRef.current = smoothedValue;
    
    // Amplificación de señal para mejor visualización - increased for more noticeable peaks
    const normalizedValue = (baselineRef.current || 0) - smoothedValue;
    const scaledValue = normalizedValue * verticalScale * 2.0; // Increased amplification for better peaks
    
    let isArrhythmia = false;
    if (rawArrhythmiaData && 
        arrhythmiaStatus?.includes("ARRITMIA") && 
        now - rawArrhythmiaData.timestamp < 1000) {
      isArrhythmia = true;
      lastArrhythmiaTime.current = now;
    }
    
    const dataPoint: PPGDataPoint = {
      time: now,
      value: scaledValue,
      isArrhythmia
    };
    
    dataBufferRef.current.push(dataPoint);
    
    const points = dataBufferRef.current.getPoints();
    detectPeaks(points, now);
    
    if (points.length > 1) {
      // Draw main signal with enhancement
      ctx.beginPath();
      ctx.strokeStyle = effectiveFingerDetectionRef.current ? '#0EA5E9' : '#9CA3AF';
      ctx.lineWidth = 2.5; // Thicker line for better visibility
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      let firstPoint = true;
      
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1];
        const point = points[i];
        
        const x1 = canvas.width - ((now - prevPoint.time) * canvas.width / WINDOW_WIDTH_MS);
        const y1 = canvas.height / 2 - prevPoint.value;
        
        const x2 = canvas.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);
        const y2 = canvas.height / 2 - point.value;
        
        if (firstPoint) {
          ctx.moveTo(x1, y1);
          firstPoint = false;
        }
        
        ctx.lineTo(x2, y2);
        
        if (point.isArrhythmia) {
          ctx.stroke();
          ctx.beginPath();
          ctx.strokeStyle = '#DC2626';
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.beginPath();
          ctx.strokeStyle = effectiveFingerDetectionRef.current ? '#0EA5E9' : '#9CA3AF';
          ctx.moveTo(x2, y2);
          firstPoint = true;
        }
      }
      
      ctx.stroke();
      
      // Enhanced peak visualization with glow effect
      peaksRef.current.forEach(peak => {
        const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
        const y = canvas.height / 2 - peak.value;
        const normalizedValue = Math.abs(peak.value / verticalScale);
        
        if (x >= 0 && x <= canvas.width) {
          // Background glow for better visibility
          ctx.beginPath();
          ctx.arc(x, y, 16, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fill();
          
          // Main peak circle
          ctx.beginPath();
          ctx.arc(x, y, 10, 0, Math.PI * 2); // Increased size
          ctx.fillStyle = peak.isArrhythmia ? '#DC2626' : '#0EA5E9';
          ctx.fill();
          
          // Inner highlight
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fillStyle = 'white';
          ctx.fill();
          
          // Animated pulse effect for better visibility
          if (now - peak.time < 800) {
            const pulseSize = 10 + 8 * Math.sin((now - peak.time) / 120); // More visible pulse
            ctx.beginPath();
            ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
            ctx.strokeStyle = peak.isArrhythmia ? '#F87171' : '#38BDF8';
            ctx.lineWidth = 4; // Thicker line
            ctx.stroke();
          }
          
          if (peak.isArrhythmia) {
            ctx.beginPath();
            ctx.arc(x, y, 14, 0, Math.PI * 2);
            ctx.strokeStyle = '#FEF7CD';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.font = 'bold 18px Inter';
            ctx.fillStyle = '#F97316';
            ctx.textAlign = 'center';
            ctx.fillText('ARRITMIA', x, y - 25);
          }
          
          // Enhanced value display with background
          const valueText = formatPeakValue(normalizedValue);
          const textWidth = ctx.measureText(valueText).width;
          
          // Better background for enhanced readability
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.fillRect(x - textWidth/2 - 6, y - 30, textWidth + 12, 22);
          
          // Bold value text
          ctx.font = 'bold 16px Inter';
          ctx.fillStyle = getPeakColor(normalizedValue, 3.0);
          ctx.textAlign = 'center';
          ctx.fillText(valueText, x, y - 15);
        }
      });
      
      // Enhanced RR interval display
      const lastRRInterval = getLastRRInterval();
      if (lastRRInterval && peaksRef.current.length >= 2) {
        const lastPeaks = [...peaksRef.current].sort((a, b) => b.time - a.time).slice(0, 2);
        if (lastPeaks.length === 2) {
          const x1 = canvas.width - ((now - lastPeaks[0].time) * canvas.width / WINDOW_WIDTH_MS);
          const x2 = canvas.width - ((now - lastPeaks[1].time) * canvas.width / WINDOW_WIDTH_MS);
          const y = canvas.height / 2 - 100; // Position above signal
          
          // Connection line with better visibility
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(20, 184, 166, 0.9)'; // More visible line
          ctx.lineWidth = 3; // Thicker for better visibility
          ctx.setLineDash([5, 3]); // More visible pattern
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
          ctx.stroke();
          ctx.setLineDash([]); // Reset
          
          // Enhanced interval display
          const intervalText = formatRRInterval(lastRRInterval);
          const bpm = rrIntervalToBPM(lastRRInterval);
          const bpmText = bpm ? `~${bpm} BPM` : '';
          
          const midX = (x1 + x2) / 2;
          const textWidthRR = ctx.measureText(intervalText).width;
          const textWidthBPM = bpm ? ctx.measureText(bpmText).width : 0;
          const maxWidth = Math.max(textWidthRR, textWidthBPM);
          
          // Better looking background
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // More opaque for readability
          ctx.fillRect(midX - maxWidth/2 - 8, y - 48, maxWidth + 16, 46);
          ctx.strokeStyle = 'rgba(20, 184, 166, 0.6)';
          ctx.strokeRect(midX - maxWidth/2 - 8, y - 48, maxWidth + 16, 46);
          
          // Interval display
          ctx.font = '15px Inter';
          ctx.fillStyle = 'rgba(20, 184, 166, 1.0)';
          ctx.textAlign = 'center';
          ctx.fillText(intervalText, midX, y - 10);
          
          // BPM value with better emphasis
          if (bpm) {
            ctx.font = 'bold 18px Inter'; // Larger font
            ctx.fillStyle = 'rgba(20, 184, 166, 1.0)';
            ctx.fillText(bpmText, midX, y - 30);
          }
        }
      }
    }
    
    lastRenderTimeRef.current = currentTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [value, quality, isFingerDetected, rawArrhythmiaData, arrhythmiaStatus, drawGrid, detectPeaks, smoothValue, preserveResults, getLastRRInterval, verticalScale]);

  useEffect(() => {
    renderSignal();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (peakLockTimeoutRef.current) {
        clearTimeout(peakLockTimeoutRef.current);
      }
    };
  }, [renderSignal]);

  useEffect(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_WIDTH;
    offscreen.height = CANVAS_HEIGHT;
    const offCtx = offscreen.getContext('2d');
    
    if(offCtx){
      drawGrid(offCtx);
      gridCanvasRef.current = offscreen;
    }
  }, [drawGrid]);

  const handleReset = useCallback(() => {
    setShowArrhythmiaAlert(false);
    peaksRef.current = [];
    lastPeakLockRef.current = false;
    peakStatsRef.current = {
      maxPeak: 0,
      minPeak: Infinity,
      avgPeak: 0,
      totalPeaks: 0,
      lastRRInterval: null
    };
    // Reset finger detection and quality counters
    fingerDetectionCounterRef.current = 0;
    qualityStabilityCounterRef.current = 0;
    effectiveFingerDetectionRef.current = false;
    
    if (peakLockTimeoutRef.current) {
      clearTimeout(peakLockTimeoutRef.current);
    }
    onReset();
  }, [onReset]);

  const toggleStatsPanel = useCallback(() => {
    setShowStatsPanel(prev => !prev);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/5 backdrop-blur-[1px]">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-[100vh] absolute inset-0 z-0"
      />

      <div className="absolute top-0 left-0 right-0 p-1 flex justify-between items-center bg-transparent z-10 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-black/80">PPG</span>
          <div className="w-[180px]">
            <div className={`h-1 w-full rounded-full bg-gradient-to-r ${getQualityColor(quality)} transition-all duration-1000 ease-in-out`}>
              <div
                className="h-full rounded-full bg-white/20 animate-pulse transition-all duration-1000"
                style={{ width: `${effectiveFingerDetectionRef.current ? quality : 0}%` }}
              />
            </div>
            <span className="text-[8px] text-center mt-0.5 font-medium transition-colors duration-700 block" 
                  style={{ color: quality > 60 ? '#0EA5E9' : '#F59E0B' }}>
              {getQualityText(quality)}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <Fingerprint
            className={`h-8 w-8 transition-colors duration-300 ${
              !effectiveFingerDetectionRef.current ? 'text-gray-400' :
              quality > 75 ? 'text-green-500' :
              quality > 50 ? 'text-yellow-500' :
              'text-red-500'
            }`}
            strokeWidth={1.5}
          />
          <span className="text-[8px] text-center font-medium text-black/80">
            {effectiveFingerDetectionRef.current ? "Dedo detectado" : "Ubique su dedo"}
          </span>
        </div>
      </div>

      {/* Botón para mostrar/ocultar panel de estadísticas */}
      <button
        onClick={toggleStatsPanel}
        className="absolute top-3 right-3 bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors"
      >
        <BarChart2 size={20} className="text-gray-700" />
      </button>

      {/* Panel de estadísticas */}
      {showStatsPanel && (
        <div className="absolute top-16 right-3 bg-white/80 border border-gray-200 rounded-lg shadow-lg p-3 w-[240px] z-20">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-gray-800">Estadísticas de Picos</h3>
            <button onClick={toggleStatsPanel} className="text-gray-600 hover:text-gray-800">×</button>
          </div>
          
          <div className="space-y-2 mb-2">
            <div className="flex justify-between">
              <span className="text-xs text-gray-600">Picos detectados:</span>
              <span className="text-xs font-semibold">{peakStatsRef.current.totalPeaks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-600">Valor máximo:</span>
              <span className="text-xs font-semibold">{peakStatsRef.current.maxPeak.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-600">Valor mínimo:</span>
              <span className="text-xs font-semibold">
                {peakStatsRef.current.minPeak === Infinity ? '0.00' : peakStatsRef.current.minPeak.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-600">Valor promedio:</span>
              <span className="text-xs font-semibold">{peakStatsRef.current.avgPeak.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-600">Último RR:</span>
              <span className="text-xs font-semibold">
                {formatRRInterval(peakStatsRef.current.lastRRInterval)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-600">BPM estimado:</span>
              <span className="text-xs font-semibold">
                {peakStatsRef.current.lastRRInterval ? 
                  `~${rrIntervalToBPM(peakStatsRef.current.lastRRInterval)}` : '--'}
              </span>
            </div>
            
            {/* Debug information for finger detection */}
            <div className="mt-3 pt-2 border-t border-gray-200">
              <div className="flex justify-between">
                <span className="text-xs text-gray-600">Detección dedo:</span>
                <span className="text-xs font-semibold">
                  {effectiveFingerDetectionRef.current ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-600">Contador estabilidad:</span>
                <span className="text-xs font-semibold">
                  {qualityStabilityCounterRef.current.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Historial de picos como gráfico */}
          <PeakHistoryChart 
            peakValues={getPeakValues()}
            className="mt-2" 
          />
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 h-[60px] grid grid-cols-2 bg-transparent z-10">
        <button 
          onClick={onStartMeasurement}
          className="bg-transparent text-black/80 hover:bg-white/5 active:bg-white/10 transition-colors duration-200 text-sm font-semibold"
        >
          INICIAR
        </button>
        <button 
          onClick={handleReset}
          className="bg-transparent text-black/80 hover:bg-white/5 active:bg-white/10 transition-colors duration-200 text-sm font-semibold"
        >
          RESET
        </button>
      </div>
    </div>
  );
};

export default PPGSignalMeter;
