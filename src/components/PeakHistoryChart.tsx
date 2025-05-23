
import React from 'react';
import { cn } from "@/lib/utils";

interface PeakHistoryChartProps {
  peakValues: number[];
  className?: string;
}

const PeakHistoryChart: React.FC<PeakHistoryChartProps> = ({ 
  peakValues, 
  className 
}) => {
  // No data to show
  if (!peakValues.length) {
    return (
      <div className={cn("bg-gray-900/30 rounded-md p-2 text-center text-xs text-gray-400", className)}>
        No peak data
      </div>
    );
  }

  // Find max value for scaling
  const maxValue = Math.max(...peakValues, 1);
  
  return (
    <div className={cn("bg-gray-900/30 rounded-md p-2", className)}>
      <div className="text-xs text-gray-400 mb-1">Peak History</div>
      <div className="flex items-end h-12 gap-0.5">
        {peakValues.map((value, index) => {
          const heightPercent = (value / maxValue) * 100;
          let barColor = 'bg-yellow-500';
          
          if (value > maxValue * 0.7) barColor = 'bg-red-500';
          else if (value > maxValue * 0.4) barColor = 'bg-orange-500';
          
          return (
            <div 
              key={index} 
              className={`${barColor} rounded-t-sm w-full`}
              style={{ 
                height: `${Math.max(5, heightPercent)}%`,
                opacity: 0.7 + (index / peakValues.length) * 0.3
              }}
              title={`Peak: ${value.toFixed(1)}`}
            />
          );
        })}
      </div>
    </div>
  );
};

export default PeakHistoryChart;
