import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface GlucoseDetails {
  estimatedGlucose: number;
  glucoseRange: [number, number];
  confidence: number;
  variability: number;
  features: {
    spectralGlucoseIndicator: number;
    vascularResistanceIndex: number;
    pulseMorphologyScore: number;
  };
}

interface VitalSignProps {
  label: string;
  value: string | number | GlucoseDetails;
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
  const [showDetails, setShowDetails] = useState(false);

  const getRiskLabel = (label: string, value: string | number | GlucoseDetails) => {
    if (label === 'GLUCOSA' && typeof value === 'object' && value !== null && 'estimatedGlucose' in value) {
      const glucoseValue = (value as GlucoseDetails).estimatedGlucose;
      if (glucoseValue < 70) return 'Hipoglucemia';
      if (glucoseValue > 125) return 'Hiperglucemia';
      return 'Normal';
    }

    if (typeof value === 'number') {
      switch(label) {
        case 'FRECUENCIA CARDÍACA':
          if (value > 100) return 'Taquicardia';
          if (value < 60) return 'Bradicardia';
          return '';
        case 'SPO2':
          if (value < 95) return 'Hipoxemia';
          return '';
        case 'HEMOGLOBINA':
          if (value < 12) return 'Anemia';
          if (value > 16) return 'Policitemia';
          return '';
        default:
          return '';
      }
    }
    
    if (typeof value === 'string') {
      switch(label) {
        case 'PRESIÓN ARTERIAL':
          const pressureParts = value.split('/');
          if (pressureParts.length === 2) {
            const systolic = parseInt(pressureParts[0], 10);
            const diastolic = parseInt(pressureParts[1], 10);
            if (!isNaN(systolic) && !isNaN(diastolic)) {
              if (systolic >= 140 || diastolic >= 90) return 'Hipertensión';
              if (systolic < 90 || diastolic < 60) return 'Hipotensión';
            }
          }
          return '';
        case 'COLESTEROL/TRIGL.':
          const lipidParts = value.split('/');
          if (lipidParts.length === 2) {
            const cholesterol = parseInt(lipidParts[0], 10);
            const triglycerides = parseInt(lipidParts[1], 10);
            if (!isNaN(cholesterol)) {
              if (cholesterol > 200) return 'Hipercolesterolemia';
            }
            if (!isNaN(triglycerides)) {
              if (triglycerides > 150) return 'Hipertrigliceridemia';
            }
          }
          return '';
        case 'ARRITMIAS':
          const arrhythmiaParts = value.split('|');
          if (arrhythmiaParts.length === 2) {
            const status = arrhythmiaParts[0];
            const count = arrhythmiaParts[1];
            
            if (status === "ARRITMIA DETECTADA" && parseInt(count) > 1) {
              return `Arritmias: ${count}`;
            } else if (status === "SIN ARRITMIAS") {
              return 'Normal';
            } else if (status === "CALIBRANDO...") {
              return 'Calibrando';
            }
          }
          return '';
        default:
          return '';
      }
    }
    
    return '';
  };

  const getRiskColor = (riskLabel: string) => {
    switch(riskLabel) {
      case 'Taquicardia':
      case 'Hipoxemia':
      case 'Hiperglucemia':
      case 'Hipertensión':
      case 'Hipercolesterolemia':
      case 'Hipertrigliceridemia':
        return 'text-[#ea384c]';
      case 'Bradicardia':
      case 'Hipoglucemia':
      case 'Hipotensión':
        return 'text-[#F97316]';
      case 'Anemia':
        return 'text-[#FEF7CD]';
      case 'Policitemia':
        return 'text-[#F2FCE2]';
      default:
        return '';
    }
  };

  const getArrhythmiaDisplay = (value: string | number) => {
    if (typeof value !== 'string') return null;
    
    const arrhythmiaData = value.split('|');
    if (arrhythmiaData.length !== 2) return null;
    
    const status = arrhythmiaData[0];
    const count = arrhythmiaData[1];
    
    if (status === "ARRITMIA DETECTADA" && parseInt(count) > 1) {
      return (
        <div className="text-xl font-medium mt-2 text-[#ea384c]">
          Arritmias: {count}
        </div>
      );
    } else if (status === "SIN ARRITMIAS") {
      return (
        <div className="text-sm font-medium mt-2 text-green-500">
          Normal
        </div>
      );
    } else if (status === "CALIBRANDO...") {
      return (
        <div className="text-sm font-medium mt-2 text-blue-400">
          Calibrando...
        </div>
      );
    }
    
    return null;
  };

  const getMedianAndAverageInfo = (label: string, value: string | number | GlucoseDetails) => {
    if (label === 'SPO2') return null; // SPO2 still handled separately

    let median, average, interpretation;

    if (label === 'GLUCOSA' && typeof value === 'object' && value !== null && 'estimatedGlucose' in value) {
      const glucoseDetails = value as GlucoseDetails;
      
      // Formatear las estadísticas segmentadas de glucosa
      return {
        median: `Rango: ${glucoseDetails.glucoseRange[0].toFixed(0)}-${glucoseDetails.glucoseRange[1].toFixed(0)} mg/dL`,
        average: `Confianza: ${(glucoseDetails.confidence * 100).toFixed(0)}%`,
        interpretation: `Variabilidad: ${(glucoseDetails.variability * 100).toFixed(0)}%. Spectral: ${glucoseDetails.features.spectralGlucoseIndicator.toFixed(2)}, Vascular: ${glucoseDetails.features.vascularResistanceIndex.toFixed(2)}, Morfología: ${glucoseDetails.features.pulseMorphologyScore.toFixed(2)}`,
      };
    }

    if (typeof value === 'number') {
      switch(label) {
        case 'FRECUENCIA CARDÍACA':
          median = 75;
          average = 72;
          interpretation = value > 100 
            ? "Su frecuencia está por encima del rango normal (60-100 BPM)."
            : value < 60 
              ? "Su frecuencia está por debajo del rango normal (60-100 BPM)."
              : "Su frecuencia está dentro del rango normal (60-100 BPM).";
          break;
        case 'HEMOGLOBINA':
          median = 14;
          average = 14.5;
          interpretation = value < 12 
            ? "Su nivel está por debajo del rango normal (12-16 g/dL)."
            : value > 16 
              ? "Su nivel está por encima del rango normal (12-16 g/dL)."
              : "Su nivel está dentro del rango normal (12-16 g/dL).";
          break;
        default:
          return null;
      }
    } else if (typeof value === 'string') {
      switch(label) {
        case 'PRESIÓN ARTERIAL':
          median = "120/80";
          average = "118/78";
          const pressureData = value.split('/');
          if (pressureData.length === 2) {
            const systolic = parseInt(pressureData[0], 10);
            const diastolic = parseInt(pressureData[1], 10);
            interpretation = (systolic >= 140 || diastolic >= 90)
              ? "Su presión está por encima del rango normal (<140/90 mmHg)."
              : (systolic < 90 || diastolic < 60)
                ? "Su presión está por debajo del rango normal (>90/60 mmHg)."
                : "Su presión está dentro del rango normal (90/60 - 140/90 mmHg).";
          }
          break;
        case 'COLESTEROL/TRIGL.':
          median = "180/130";
          average = "175/120";
          const lipidParts = value.split('/');
          if (lipidParts.length === 2) {
            const cholesterol = parseInt(lipidParts[0], 10);
            const triglycerides = parseInt(lipidParts[1], 10);
            interpretation = 
              cholesterol > 200 
                ? "Su nivel de colesterol está elevado (>200 mg/dL)." 
                : "Su nivel de colesterol está dentro del rango normal (<200 mg/dL).";
            
            if (triglycerides > 150) {
              interpretation += " Sus triglicéridos están elevados (>150 mg/dL).";
            } else {
              interpretation += " Sus triglicéridos están dentro del rango normal (<150 mg/dL).";
            }
          }
          break;
        case 'ARRITMIAS':
          const arrhythmiaInfo = value.split('|');
          if (arrhythmiaInfo.length === 2) {
            const status = arrhythmiaInfo[0];
            const count = arrhythmiaInfo[1];
            
            if (status === "ARRITMIA DETECTADA") {
              median = "0";
              average = "0-1";
              interpretation = parseInt(count) > 3 
                ? "Ha tenido varias arritmias. Considere consultar a un especialista."
                : "Ha tenido algunas arritmias detectadas. Monitoree su condición.";
            } else {
              median = "0";
              average = "0";
              interpretation = "No se detectaron arritmias, lo cual es normal.";
            }
          }
          break;
        default:
          return null;
      }
    }

    return { median, average, interpretation };
  };

  const riskLabel = getRiskLabel(label, value);
  const riskColor = getRiskColor(riskLabel);
  const isArrhytmia = label === 'ARRITMIAS';
  const medianAndAverage = getMedianAndAverageInfo(label, value);

  const handleClick = () => {
    setShowDetails(!showDetails);
  };

  const displayValue = () => {
    if (label === 'GLUCOSA' && typeof value === 'object' && value !== null && 'estimatedGlucose' in value) {
      const glucoseDetails = value as GlucoseDetails;
      const glucose = glucoseDetails.estimatedGlucose;
      const [minRange, maxRange] = glucoseDetails.glucoseRange;

      let statusText = '';
      let textColorClass = '';

      if (glucose < 70) {
          statusText = 'Bajo';
          textColorClass = 'text-[#F97316]'; // Naranja para bajo
      } else if (glucose >= 70 && glucose <= 125) { // Rango general considerado normal
          statusText = 'Normal';
          textColorClass = 'text-green-500'; // Verde para normal
      } else { // glucose > 125
          statusText = 'Elevado';
          textColorClass = 'text-[#ea384c]'; // Rojo para elevado
      }

      return (
          <div className="flex flex-col items-center">
              <span className={cn("text-display-small font-bold", textColorClass)}>
                  {statusText}
              </span>
              <span className="text-value-small text-gray-400">
                  ({minRange.toFixed(0)} - {maxRange.toFixed(0)} {unit})
              </span>
          </div>
      );
    }
    if (typeof value === 'object' && value !== null) {
      // Si llega aquí, es un objeto que no es GlucoseDetails (ej. lipids)
      // o un caso no manejado, se mostrará el valor estimado si existe
      return String((value as any).estimatedGlucose || (value as any).totalCholesterol || '--');
    }
    return `${value}${unit ? ` ${unit}` : ''}`;
  };

  return (
    <div 
      className={cn(
        "relative flex flex-col justify-center items-center p-2 bg-transparent transition-all duration-500 text-center cursor-pointer",
        showDetails && "bg-gray-800/20 backdrop-blur-sm rounded-lg"
      )}
      onClick={handleClick}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-black/70 mb-1">
        {label}
      </div>
      
      <div className="font-bold text-xl sm:text-2xl transition-all duration-300">
        <span className="text-gradient-soft animate-value-glow">
          {isArrhytmia && typeof value === 'string' ? value.split('|')[0] : displayValue()}
        </span>
        {unit && <span className="text-xs text-white/70 ml-1">{unit}</span>}
      </div>

      {!isArrhytmia && riskLabel && (
        <div className={`text-sm font-medium mt-1 ${riskColor}`}>
          {riskLabel}
        </div>
      )}
      
      {isArrhytmia && getArrhythmiaDisplay(value as string)}
      
      {calibrationProgress !== undefined && (
        <div className="absolute inset-0 bg-transparent overflow-hidden pointer-events-none border-0">
          <div 
            className="h-full bg-blue-500/5 transition-all duration-300 ease-out"
            style={{ width: `${calibrationProgress}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-white/80">
              {calibrationProgress < 100 ? `${Math.round(calibrationProgress)}%` : '✓'}
            </span>
          </div>
        </div>
      )}

      {showDetails && medianAndAverage && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 p-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg text-left">
          <div className="text-sm font-medium text-gray-900 mb-2">Información adicional:</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="text-xs">
              <span className="font-medium">Mediana:</span> {medianAndAverage.median} {unit}
            </div>
            <div className="text-xs">
              <span className="font-medium">Promedio ponderado:</span> {medianAndAverage.average} {unit}
            </div>
          </div>
          <div className="text-xs mt-1 text-gray-800">
            {medianAndAverage.interpretation}
          </div>
        </div>
      )}
    </div>
  );
};

export default VitalSign;
