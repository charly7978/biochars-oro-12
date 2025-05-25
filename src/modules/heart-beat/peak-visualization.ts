
/**
 * Utility functions for peak visualization
 */

/**
 * Format a peak value for display
 * @param value Raw peak value
 * @returns Formatted value as string
 */
export const formatPeakValue = (value: number): string => {
  return value.toFixed(1);
};

/**
 * Determine color based on peak intensity
 * @param value Peak value
 * @param threshold Threshold for determining intensity
 * @returns CSS color string
 */
export const getPeakColor = (value: number, threshold: number = 0.5): string => {
  if (value > threshold * 1.5) {
    return '#ef4444'; // Strong peak - red
  } else if (value > threshold) {
    return '#f97316'; // Medium peak - orange
  } else {
    return '#eab308'; // Weak peak - yellow
  }
};

/**
 * Calculate the relative height of a peak for visualization
 * @param value Peak value
 * @param canvasHeight Height of the canvas
 * @returns Pixel position for drawing
 */
export const calculatePeakHeight = (value: number, canvasHeight: number): number => {
  // Ensure the peak is visible within canvas bounds
  const normalizedValue = Math.min(Math.max(value, 0), 1);
  const maxHeight = canvasHeight * 0.8; // Use 80% of canvas height
  return maxHeight * normalizedValue;
};

/**
 * Format RR interval for display
 * @param interval Interval in milliseconds
 * @returns Formatted interval as string
 */
export const formatRRInterval = (interval: number | null): string => {
  if (interval === null || interval <= 0) {
    return "--";
  }
  return `${Math.round(interval)}ms`;
};

/**
 * Convert RR interval to BPM
 * @param interval Interval in milliseconds
 * @returns BPM value or null
 */
export const rrIntervalToBPM = (interval: number | null): number | null => {
  if (interval === null || interval <= 0) {
    return null;
  }
  return Math.round(60000 / interval);
};

/**
 * Evaluate peak quality based on value and surrounding context
 * @param value Peak value 
 * @param average Average of recent peaks
 * @param maxPeak Maximum peak value observed
 * @returns Quality score (0-100)
 */
export const evaluatePeakQuality = (value: number, average: number, maxPeak: number): number => {
  if (maxPeak <= 0) return 0;
  
  // Normalize value against maximum
  const normalizedValue = value / maxPeak;
  
  // Calculate deviation from average
  const avgRatio = average > 0 ? value / average : 0;
  
  // Penalize peaks that deviate too much from average (outliers)
  const stabilityFactor = avgRatio > 0.5 && avgRatio < 1.5 ? 1.0 : 0.7;
  
  // Calculate final quality score
  return Math.min(100, Math.round(normalizedValue * 80 * stabilityFactor));
};

/**
 * Generate a descriptive label for a peak based on its characteristics
 * @param value Peak value
 * @param isArrhythmia Whether this peak is associated with arrhythmia
 * @returns Descriptive string
 */
export const getPeakLabel = (value: number, isArrhythmia: boolean): string => {
  if (isArrhythmia) return "Arrítmico";
  
  if (value > 8) return "Muy fuerte";
  if (value > 6) return "Fuerte";
  if (value > 4) return "Medio";
  if (value > 2) return "Débil";
  return "Muy débil";
};
