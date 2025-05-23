import React, { useEffect, useRef, useState } from 'react';
import { cn } from "@/lib/utils";
import { formatPeakValue, formatRRInterval, getPeakColor, rrIntervalToBPM } from '@/modules/heart-beat/peak-visualization';
import PeakHistoryChart from './PeakHistoryChart';

interface HeartRateMonitorProps {
  value: number;
  isPeak: boolean;
  className?: string;
  quality?: number;
  showWhipEffect?: boolean;
  rrData?: { intervals: number[], lastPeakTime: number | null };
}

const HeartRateMonitor = ({ 
  value, 
  isPeak, 
  className, 
  quality = 0,
  showWhipEffect = true,
  rrData
}: HeartRateMonitorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>([]);
  const peakHistoryRef = useRef<number[]>([]);
  const maxHistoryLength = 100; // Points to show
  const peakMarkerRef = useRef<boolean[]>([]);
  const lastPeakTimeRef = useRef<number | null>(null);
  const MIN_PEAK_INTERVAL_MS = 280; // Reduced for capturing faster heartbeats
  
  // Reference scale values
  const [peakStats, setPeakStats] = useState({
    lastValue: 0,
    maxValue: 1,
    minValue: 0,
    avgValue: 0
  });

  // Peak history tracking
  const [peakHistory, setPeakHistory] = useState<number[]>([]);
  
  // Last RR interval for display
  const [lastRRInterval, setLastRRInterval] = useState<number | null>(null);
  
  // Control animation for whip effect
  const animationRef = useRef<{
    isAnimating: boolean;
    startTime: number;
    duration: number;
    startValue: number;
    targetValue: number;
  }>({
    isAnimating: false,
    startTime: 0,
    duration: 100, // Much faster animation
    startValue: 0,
    targetValue: 0
  });

  // Add new value to history with better peak handling
  useEffect(() => {
    // Normalize value between 0-1 with greater amplification
    const normalizedValue = Math.max(0, Math.min(1, Math.abs(value) / 70)); // Increased amplification
    
    // Verify if this is a valid peak (avoid peaks that are too close)
    const now = Date.now();
    let validPeak = isPeak;
    
    if (isPeak && lastPeakTimeRef.current) {
      const timeSinceLastPeak = now - lastPeakTimeRef.current;
      if (timeSinceLastPeak < MIN_PEAK_INTERVAL_MS) {
        // Ignore peaks that are too close
        validPeak = false;
      }
    }
    
    if (validPeak) {
      lastPeakTimeRef.current = now;
      
      // Update lastRRInterval if we have RR data
      if (rrData && rrData.intervals.length > 0) {
        const latestInterval = rrData.intervals[rrData.intervals.length - 1];
        setLastRRInterval(latestInterval);
      }
      
      // Save peak value to history
      peakHistoryRef.current.push(normalizedValue);
      if (peakHistoryRef.current.length > 10) {
        peakHistoryRef.current.shift();
      }
      
      // Update peak history state for component
      const newHistory = [...peakHistoryRef.current];
      setPeakHistory(newHistory);
      
      // Update peak statistics
      const values = peakHistoryRef.current;
      if (values.length > 0) {
        setPeakStats({
          lastValue: normalizedValue,
          maxValue: Math.max(...values),
          minValue: Math.min(...values),
          avgValue: values.reduce((sum, v) => sum + v, 0) / values.length
        });
      }
    }
    
    // Apply amplification for peaks - much more contrast
    const amplifiedValue = validPeak 
      ? normalizedValue * 15.0 // Extreme amplification for confirmed peaks
      : normalizedValue * 0.25; // Reduce non-peaks for dramatic contrast
    
    // Add to history
    historyRef.current.push(amplifiedValue);
    peakMarkerRef.current.push(validPeak);
    
    // Keep history at desired length
    if (historyRef.current.length > maxHistoryLength) {
      historyRef.current.shift();
      peakMarkerRef.current.shift();
    }
    
    // Start whip effect if it's a valid peak
    if (validPeak && showWhipEffect) {
      animationRef.current = {
        isAnimating: true,
        startTime: Date.now(),
        duration: 100, // Much faster for better synchronization
        startValue: amplifiedValue,
        targetValue: amplifiedValue * 0.05 // More dramatic drop
      };
    }
    
    // Draw updated signal
    drawSignal();
    
  }, [value, isPeak, showWhipEffect, rrData]);

  const drawSignal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set styles
    ctx.lineWidth = 8; // Much thicker line
    ctx.lineJoin = 'round';
    
    // Use quality to determine color with better contrast
    let signalColor;
    if (quality >= 60) { // Reduced threshold
      signalColor = '#dc2626'; // Intense red for good quality
    } else if (quality >= 30) { // Reduced threshold
      signalColor = '#ea580c'; // Intense orange for medium quality
    } else if (quality >= 10) { // Reduced threshold
      signalColor = '#d97706'; // Intense yellow for low quality
    } else {
      signalColor = '#71717a'; // Dark grey for very low quality
    }

    // Draw reference scale on the left side (new)
    drawReferenceScale(ctx, canvas.height, canvas.width);

    // Draw the baseline for reference
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(100,100,100,0.2)';
    ctx.lineWidth = 1;
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    
    // If not enough points, exit
    if (historyRef.current.length < 2) return;
    
    // Draw main line with better visibility and variable thickness
    ctx.beginPath();
    ctx.strokeStyle = signalColor;
    
    const history = [...historyRef.current];
    const peakMarkers = [...peakMarkerRef.current];
    
    for (let i = 0; i < history.length; i++) {
      const x = (i / (maxHistoryLength - 1)) * canvas.width;
      let y = canvas.height - (history[i] * canvas.height * 0.95); // Greater vertical range
      
      // Height values limited between 2% and 98% of canvas for greater visual range
      y = Math.min(Math.max(y, canvas.height * 0.02), canvas.height * 0.98);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        // If current point or previous point is a peak, use curved line to smooth
        const isPeakPoint = peakMarkers[i] || (i > 0 && peakMarkers[i-1]);
        
        if (isPeakPoint) {
          // Increase thickness at peaks for better visibility
          ctx.lineWidth = 12; // Increased much more
          
          // Calculate control point for more natural curve
          const prevX = ((i-1) / (maxHistoryLength - 1)) * canvas.width;
          const prevY = canvas.height - (history[i-1] * canvas.height * 0.95);
          
          // Calculate control point for curve
          const cpX = (prevX + x) / 2;
          const cpY = (prevY + y) / 2;
          
          // Use curves to smooth peaks
          ctx.quadraticCurveTo(cpX, cpY, x, y);
        } else {
          // For non-peak points, use straight line with normal thickness
          ctx.lineWidth = 3; // Don't change to maintain contrast
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();
    
    // Draw highlight points for peaks
    for (let i = 0; i < history.length; i++) {
      if (peakMarkers[i]) {
        const x = (i / (maxHistoryLength - 1)) * canvas.width;
        const y = canvas.height - (history[i] * canvas.height * 0.95);
        
        // Draw circle for peak
        ctx.beginPath();
        ctx.fillStyle = '#fcd34d'; // More intense yellow
        ctx.arc(x, y, 14, 0, Math.PI * 2); // Increased circle size much more
        ctx.fill();
        
        // Add border for contrast
        ctx.beginPath();
        ctx.strokeStyle = '#be123c';
        ctx.lineWidth = 4; // Thicker border
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.stroke();
        
        // Show peak value with more precision and size
        const displayValue = Math.round(history[i] * 15); // Amplified more
        ctx.font = 'bold 18px sans-serif'; // Even larger font
        ctx.fillStyle = '#ffffff'; 
        ctx.textAlign = 'center';
        ctx.fillText(displayValue.toString(), x, y - 20); // Greater distance
        
        // Add "halo" pulsing circle to highlight peak more
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(225, 29, 72, 0.6)'; // More opaque
        ctx.lineWidth = 3; // Thicker
        ctx.arc(x, y, 20, 0, Math.PI * 2); // Much larger circle
        ctx.stroke();
      }
    }

    // Add heartbeat indicator (more visible)
    if (isPeak) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)'; // Semi-transparent red
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.fill();
    }
  };

  // Draw reference scale on the left side
  const drawReferenceScale = (ctx: CanvasRenderingContext2D, height: number, width: number) => {
    const scaleWidth = 30;
    const steps = 5;
    
    // Draw scale background
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 0, scaleWidth, height);
    
    // Draw scale lines
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#eee';
    ctx.font = '10px sans-serif';
    
    for (let i = 0; i <= steps; i++) {
      const y = height - (i / steps) * height;
      
      // Draw line
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(scaleWidth, y);
      ctx.stroke();
      
      // Draw value
      const value = Math.round((i / steps) * 15);
      ctx.fillText(value.toString(), 5, y - 3);
    }
  };

  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      <canvas 
        ref={canvasRef}
        width={400} 
        height={200}
        className="w-full h-full"
      />
      
      {/* Improved heartbeat detection indicator */}
      {isPeak && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white font-bold animate-pulse bg-red-500/60 px-3 py-1.5 rounded-md text-base">
          LATIDO DETECTADO
        </div>
      )}
      
      {/* Peak Stats Panel - New */}
      <div className="absolute bottom-2 right-2 bg-black/50 text-white rounded p-2 text-xs">
        <div className="font-semibold mb-1">Peak Info</div>
        <div className="grid grid-cols-2 gap-x-4">
          <div>Last: <span className="font-bold text-yellow-400">{formatPeakValue(peakStats.lastValue * 15)}</span></div>
          <div>Max: <span className="font-bold text-red-400">{formatPeakValue(peakStats.maxValue * 15)}</span></div>
          <div>Min: <span className="font-bold text-blue-400">{formatPeakValue(peakStats.minValue * 15)}</span></div>
          <div>Avg: <span className="font-bold text-green-400">{formatPeakValue(peakStats.avgValue * 15)}</span></div>
        </div>
      </div>
      
      {/* RR Interval Display - New */}
      {lastRRInterval && (
        <div className="absolute top-2 right-2 bg-black/50 text-white rounded p-2 text-xs">
          <div>RR: <span className="font-bold text-cyan-400">{formatRRInterval(lastRRInterval)}</span></div>
          <div>≈ <span className="font-bold text-green-400">
            {rrIntervalToBPM(lastRRInterval) || '--'} BPM
          </span></div>
        </div>
      )}
      
      {/* Signal Quality Indicator - New */}
      <div className="absolute top-2 left-2 bg-black/50 rounded p-2 flex items-center">
        <div className="w-3 h-3 rounded-full mr-1.5" 
          style={{
            backgroundColor: quality > 60 ? '#10b981' : 
                           quality > 30 ? '#f59e0b' : '#ef4444'
          }}
        />
        <div className="text-white text-xs">
          Signal: {quality}%
        </div>
      </div>
      
      {/* Peak History Chart - New */}
      <div className="absolute bottom-[90px] right-2 w-32">
        <PeakHistoryChart peakValues={peakHistory.map(v => v * 15)} />
      </div>
    </div>
  );
};

export default HeartRateMonitor;
