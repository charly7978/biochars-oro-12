
/**
 * Signal processing utilities for heart beat detection
 */

/**
 * Updates a sliding window with a new value and maintains maximum size
 * @param window The sliding window array
 * @param value The new value to add
 * @param maxSize Maximum size of the window
 * @returns Updated window
 */
export const updateSlidingWindow = <T>(window: T[], value: T, maxSize: number): T[] => {
  const newWindow = [...window, value];
  if (newWindow.length > maxSize) {
    return newWindow.slice(1);
  }
  return newWindow;
};

/**
 * Calculates the elapsed time since a reference point
 * @param referenceTime The reference time in milliseconds
 * @returns Time elapsed in milliseconds
 */
export const getTimeSince = (referenceTime: number): number => {
  return Date.now() - referenceTime;
};

/**
 * Determines if a peak is valid based on timing constraints
 * @param lastReportedPeakTime Last time a peak was reported
 * @param currentBPM Current BPM value for dynamic threshold calculation
 * @param minInterval Minimum acceptable interval
 * @returns Boolean indicating if the peak timing is valid
 */
export const isValidPeakTiming = (
  lastReportedPeakTime: number,
  currentBPM: number,
  minInterval: number = 400
): boolean => {
  const timeSinceLastReportedPeak = Date.now() - lastReportedPeakTime;
  
  // Adjust minimum interval based on current BPM
  const minAcceptablePeakInterval = currentBPM > 0 
    ? Math.max(180, Math.min(500, 60000 / (currentBPM * 1.8)))
    : minInterval;
  
  return timeSinceLastReportedPeak >= minAcceptablePeakInterval;
};
