
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
