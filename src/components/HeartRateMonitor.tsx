
import React, { useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";

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
    duration: 200, // Faster whip animation (was 250ms)
    startValue: 0,
    targetValue: 0
  });

  // Add the new value to history with improved peak handling
  useEffect(() => {
    // Normalize the value between 0-1 for easier scaling
    const normalizedValue = Math.max(0, Math.min(1, Math.abs(value) / 100));
    
    // Apply amplification for peaks to make them more prominent and more consistent
    const amplifiedValue = isPeak 
      ? normalizedValue * 4.5 // Increased amplification for peaks (was 3.5)
      : normalizedValue * 0.6; // Reduce non-peaks more for better contrast (was 0.8)
    
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
        duration: 200, // Faster animation for more responsive feel
        startValue: amplifiedValue,
        targetValue: amplifiedValue * 0.2 // Even more dramatic drop (was 0.3)
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
    ctx.lineWidth = 4; // Thicker line for better visibility (was 3)
    ctx.lineJoin = 'round';
    
    // Use quality to determine color with improved contrast
    let signalColor;
    if (quality >= 80) {
      signalColor = '#ef4444'; // Bright red for good quality
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
        let peakHeight = canvas.height - (point * canvas.height * 0.98); // Higher peaks (was 0.95)
        
        // Apply whip effect if we're still in animation for this peak
        if (animationRef.current.isAnimating) {
          const elapsed = Date.now() - animationRef.current.startTime;
          const progress = Math.min(1, elapsed / animationRef.current.duration);
          
          // Non-linear easing for whip effect - even faster initial movement
          const easeOutQuint = 1 - Math.pow(1 - progress, 8); // Increased power for more dramatic whip (was 6)
          
          // Apply the animation effect
          const animatedPoint = animationRef.current.startValue - 
            (animationRef.current.startValue - animationRef.current.targetValue) * easeOutQuint;
          
          // Use the animated value for the latest points
          if (index >= historyRef.current.length - 5) {
            peakHeight = canvas.height - (animatedPoint * canvas.height * 0.98);
          }
          
          // End animation when complete
          if (progress >= 1) {
            animationRef.current.isAnimating = false;
          }
        }
        
        // Draw vertical peak line
        ctx.lineTo(x, peakHeight);
        
        // Draw even sharper peak (minimal plateau)
        ctx.lineTo(x + pointWidth * 0.1, peakHeight); // Shorter plateau (was 0.15)
        
        // Return back down
        ctx.lineTo(x + pointWidth, canvas.height);
      } else {
        // For non-peak points, draw much smaller vertical lines
        const baselineHeight = canvas.height - (point * canvas.height * 0.2); // Even flatter baseline (was 0.25)
        
        // Draw smaller vertical line
        ctx.lineTo(x, baselineHeight);
        ctx.lineTo(x + pointWidth, canvas.height);
      }
    });
    
    // Close the path and stroke
    ctx.stroke();
    
    // Draw peak markers with improved visibility
    ctx.fillStyle = '#ef4444';
    peakMarkerRef.current.forEach((isPeakPoint, index) => {
      if (isPeakPoint) {
        const x = index * pointWidth;
        const point = historyRef.current[index];
        const dotSize = 8; // Larger dots for better visibility (was 6)
        const yPos = canvas.height - (point * canvas.height * 0.98);
        ctx.beginPath();
        ctx.arc(x, yPos, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  };

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={120}
      className={cn("w-full h-full bg-black/30 rounded-md", className)}
    />
  );
};

export default HeartRateMonitor;
