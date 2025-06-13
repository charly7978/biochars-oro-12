import React, { useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";
import CameraView from "./CameraView";

interface HeartRateMonitorProps {
  value: number;
  isPeak: boolean;
  className?: string;
  quality?: number;
  showWhipEffect?: boolean;
}

const HeartRateMonitor = ({ 
  value, 
  isPeak, 
  className, 
  quality = 0,
  showWhipEffect = true
}: HeartRateMonitorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>([]);
  const maxHistoryLength = 100; // Points to display
  const peakMarkerRef = useRef<boolean[]>([]);
  
  // Track the animation state for whip effect
  const animationRef = useRef<{
    isAnimating: boolean;
    startTime: number;
    duration: number;
    startValue: number;
    targetValue: number;
  }>({
    isAnimating: false,
    startTime: 0,
    duration: 300, // Duration of whip animation in ms
    startValue: 0,
    targetValue: 0
  });

  // Add the new value to history
  useEffect(() => {
    // Normalize the value between 0-1 for easier scaling
    const normalizedValue = Math.max(0, Math.min(1, Math.abs(value) / 100));
    
    // Apply amplification for peaks to make them more prominent
    const amplifiedValue = isPeak 
      ? normalizedValue * 2.5 // More amplification for peaks
      : normalizedValue * 0.8; // Slightly reduce non-peaks for contrast
    
    // Add to history
    historyRef.current.push(amplifiedValue);
    peakMarkerRef.current.push(isPeak);
    
    // Keep history at desired length
    if (historyRef.current.length > maxHistoryLength) {
      historyRef.current.shift();
      peakMarkerRef.current.shift();
    }
    
    // Start whip effect animation if this is a peak
    if (isPeak && showWhipEffect) {
      animationRef.current = {
        isAnimating: true,
        startTime: Date.now(),
        duration: 300, // ms
        startValue: amplifiedValue,
        targetValue: amplifiedValue * 0.4 // Target is lower to create the whip effect
      };
    }
    
    // Draw the updated signal
    drawSignal();
    
  }, [value, isPeak, showWhipEffect]);

  const drawSignal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set up styles
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    
    // Use quality to determine color - red for good quality, orange/yellow for medium, gray for poor
    let signalColor;
    if (quality >= 80) {
      signalColor = '#ef4444'; // Red for good quality
    } else if (quality >= 50) {
      signalColor = '#f97316'; // Orange for medium quality
    } else if (quality >= 20) {
      signalColor = '#eab308'; // Yellow for low quality
    } else {
      signalColor = '#6b7280'; // Gray for very poor quality
    }
    
    ctx.strokeStyle = signalColor;
    
    // Calculate width for each point
    const pointWidth = canvas.width / maxHistoryLength;
    
    // Start drawing from bottom of last point
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    
    // Draw the signal as vertical lines (peaks) rather than a continuous wave
    historyRef.current.forEach((point, index) => {
      const x = index * pointWidth;
      const isPeakPoint = peakMarkerRef.current[index];
      
      // For peak points, draw taller lines with potential whip effect
      if (isPeakPoint) {
        // Calculate peak height with potential whip effect animation
        let peakHeight = canvas.height - (point * canvas.height * 0.9); // Use 90% of canvas height
        
        // Apply whip effect if we're still in animation for this peak
        if (animationRef.current.isAnimating) {
          const elapsed = Date.now() - animationRef.current.startTime;
          const progress = Math.min(1, elapsed / animationRef.current.duration);
          
          // Non-linear easing for whip effect - fast initial movement, slower at the end
          const easeOutQuint = 1 - Math.pow(1 - progress, 5);
          
          // Apply the animation effect
          const animatedPoint = animationRef.current.startValue - 
            (animationRef.current.startValue - animationRef.current.targetValue) * easeOutQuint;
          
          // Use the animated value for the latest points
          if (index >= historyRef.current.length - 5) {
            peakHeight = canvas.height - (animatedPoint * canvas.height * 0.9);
          }
          
          // End animation when complete
          if (progress >= 1) {
            animationRef.current.isAnimating = false;
          }
        }
        
        // Draw vertical peak line
        ctx.lineTo(x, peakHeight);
        
        // Draw mini plateau at peak top
        ctx.lineTo(x + pointWidth * 0.3, peakHeight);
        
        // Return back down
        ctx.lineTo(x + pointWidth, canvas.height);
      } else {
        // For non-peak points, draw much smaller vertical lines
        const baselineHeight = canvas.height - (point * canvas.height * 0.3); // Only 30% height for non-peaks
        
        // Draw smaller vertical line
        ctx.lineTo(x, baselineHeight);
        ctx.lineTo(x + pointWidth, canvas.height);
      }
    });
    
    // Close the path and stroke
    ctx.stroke();
    
    // Draw peak markers for better visibility
    ctx.fillStyle = '#ef4444';
    peakMarkerRef.current.forEach((isPeakPoint, index) => {
      if (isPeakPoint) {
        const x = index * pointWidth;
        const point = historyRef.current[index];
        const dotSize = 4;
        const yPos = canvas.height - (point * canvas.height * 0.9);
        ctx.beginPath();
        ctx.arc(x, yPos, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  };

  return (
    <div>
      <h2>Monitor de Frecuencia Cardíaca</h2>
      <CameraView />
      <canvas
        ref={canvasRef}
        width={400}
        height={120}
        className={cn("w-full h-full bg-black/30 rounded-md", className)}
      />
    </div>
  );
};

export default HeartRateMonitor;
