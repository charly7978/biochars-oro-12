
import React from 'react';

interface VitalSignProps {
  label: string;
  value: string | number;
  unit?: string;
  highlighted?: boolean;
  calibrationProgress?: number;
}

const VitalSign = ({ 
  label, 
  value, 
  unit, 
  highlighted = false,
  calibrationProgress 
}: VitalSignProps) => {
  return (
    <div className="relative flex flex-col justify-center items-center p-2 bg-transparent transition-all duration-500">
      <div className="text-[10px] font-medium uppercase tracking-wider text-black/60 mb-1">
        {label}
      </div>
      
      <div className={`font-bold text-lg sm:text-xl transition-all duration-300 ${highlighted ? 'text-value-medium text-black/90 shadow-sm animate-pulse' : 'text-black/80'}`}>
        <span className="relative inline-block after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/30 after:to-transparent after:animate-[progress_2s_linear_infinite] after:opacity-0 hover:after:opacity-100">
          {value}
        </span>
        {unit && <span className="text-xs text-black/50 ml-1">{unit}</span>}
      </div>
      
      {calibrationProgress !== undefined && (
        <div className="absolute inset-0 bg-transparent overflow-hidden pointer-events-none">
          <div 
            className="h-full bg-blue-500/5 transition-all duration-300 ease-out"
            style={{ width: `${calibrationProgress}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-black/70">
              {calibrationProgress < 100 ? `${Math.round(calibrationProgress)}%` : '✓'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VitalSign;
