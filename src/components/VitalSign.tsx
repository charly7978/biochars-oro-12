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
          <div className="flex flex-col items-center text-center">
              <span className={cn("text-display-small font-bold", textColorClass)}>
                  {statusText}
              </span>
              <span className="text-value-small text-gray-400">
                  ({minRange.toFixed(0)} - {maxRange.toFixed(0)} {unit})
              </span>
          </div>
      );
    }

    // Para otros signos vitales (HR, SpO2, etc.)
    if (typeof value === 'string' || typeof value === 'number') {
      return (
        <div className="flex flex-col items-center text-center">
          <span className="text-display-small font-bold text-gradient-soft animate-value-glow">
            {typeof value === 'number' ? value.toFixed(0) : String(value)}
          </span>
          {unit && <span className="text-value-small text-gray-400">{unit}</span>}
        </div>
      );
    }
    // Fallback si el valor no es un string o un number (e.g., GlucoseDetails para una etiqueta incorrecta)
    return (
      <div className="flex flex-col items-center text-center">
        <span className="text-display-small font-bold text-gradient-soft animate-value-glow">
          --
        </span>
        {unit && <span className="text-value-small text-gray-400">{unit}</span>}
      </div>
    );
  };

  const riskLabel = getRiskLabel(label, value);
  const riskColor = getRiskColor(riskLabel);
  const arrhythmiaDisplay =
    label === 'ARRITMIAS' && typeof value === 'string'
      ? getArrhythmiaDisplay(value)
      : null;
  const medianAndAverage = getMedianAndAverageInfo(label, value);

  return (
    <div
      className={cn(
        "relative flex flex-col justify-center items-center p-2 bg-transparent transition-all duration-500 text-center cursor-pointer",
        showDetails && "bg-gray-800/20 backdrop-blur-sm rounded-lg"
      )}
      onClick={handleClick}
    >
      {/* Título */}
      <div className="text-sm font-semibold uppercase tracking-wider text-gray-300 mb-1 text-center">
        {label}
      </div>

      {/* Valor principal */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {displayValue()}
      </div>

      {/* Etiqueta de Riesgo (si aplica) */}
      {riskLabel && riskLabel !== 'Normal' && riskLabel !== 'Calibrando' && riskLabel !== 'SIN ARRITMIAS' && (
        <div className={cn("text-sm font-medium mt-1", riskColor)}>
          {riskLabel}
        </div>
      )}

      {arrhythmiaDisplay}

      {/* Detalles para ARITMIAS */}
      {label === 'ARRITMIAS' && showDetails && medianAndAverage && (
        <div className="text-xs text-gray-400 mt-2 text-center">
          <p>{medianAndAverage.interpretation}</p>
        </div>
      )}

      {/* Detalles adicionales para la glucosa */}
      {label === 'GLUCOSA' && showDetails && typeof value === 'object' && value !== null && 'estimatedGlucose' in value && medianAndAverage && (
        <div className="text-xs text-gray-400 mt-2 text-center">
          <p>{medianAndAverage.median}</p>
          <p>{medianAndAverage.average}</p>
          <p>{medianAndAverage.interpretation}</p>
        </div>
      )}

      {calibrationProgress !== undefined && calibrationProgress < 100 && (
        <div className="absolute bottom-2 left-0 right-0 text-center text-xs text-blue-400">
          Calibrando: {calibrationProgress.toFixed(0)}%
        </div>
      )}
    </div>
  );
};

export default VitalSign;
