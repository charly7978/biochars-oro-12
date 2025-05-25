
import React from 'react';

interface SignalQualityIndicatorProps {
  quality: number;
  isMonitoring?: boolean;
}

const SignalQualityIndicator = ({ quality, isMonitoring = false }: SignalQualityIndicatorProps) => {
  const displayQuality = isMonitoring ? quality : 0;

  // Función mejorada para dar colores más precisos en 20 niveles
  const getQualityColor = (q: number) => {
    if (q === 0) return '#666666'; // Sin señal
    if (q >= 90) return '#00ff00'; // Excelente
    if (q >= 75) return '#80ff00'; // Muy buena
    if (q >= 60) return '#ccff00'; // Buena
    if (q >= 45) return '#ffff00'; // Aceptable
    if (q >= 30) return '#ffcc00'; // Regular
    if (q >= 15) return '#ff6600'; // Débil
    return '#ff0000';              // Muy débil
  };

  // Función mejorada para mostrar texto descriptivo más preciso
  const getQualityText = (q: number) => {
    if (q === 0) return 'Sin Dedo';
    if (q >= 90) return 'Excelente';
    if (q >= 75) return 'Muy Buena';
    if (q >= 60) return 'Buena';
    if (q >= 45) return 'Aceptable';
    if (q >= 30) return 'Regular';
    if (q >= 15) return 'Débil';
    return 'Muy Débil';
  };
  
  // Determinar si mostrar advertencia para calidad insuficiente
  const showWarning = displayQuality > 0 && displayQuality < 30;

  return (
    <div className="bg-black/30 backdrop-blur-md rounded p-2 w-full">
      <div className="flex items-center gap-2">
        <div 
          className="w-12 h-12 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300"
          style={{
            borderColor: getQualityColor(displayQuality),
            backgroundColor: `${getQualityColor(displayQuality)}33`
          }}
        >
          <span className="text-sm font-bold text-white">{displayQuality}%</span>
        </div>

        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-white/90">Calidad de Señal</span>
            <span 
              className="text-xs font-medium"
              style={{ color: getQualityColor(displayQuality) }}
            >
              {getQualityText(displayQuality)}
            </span>
          </div>

          <div className="w-full h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-300"
              style={{
                width: `${displayQuality}%`,
                backgroundColor: getQualityColor(displayQuality)
              }}
            />
          </div>
          
          {showWarning && (
            <div className="mt-1 flex items-center">
              <span className="text-[10px] text-amber-400">
                Ajuste la posición del dedo para mejorar la calidad
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignalQualityIndicator;
