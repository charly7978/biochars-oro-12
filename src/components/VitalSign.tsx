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
  vascularStiffnessIndex?: number;
}

const VitalSign = ({ 
  label, 
  value, 
  unit, 
  highlighted = false,
  calibrationProgress,
  vascularStiffnessIndex
}: VitalSignProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const getRiskLabel = (label: string, value: string | number | GlucoseDetails) => {
    if (label === 'GLUCOSA' && typeof value === 'object' && value !== null && 'estimatedGlucose' in value) {
      const glucoseValue = (value as GlucoseDetails).estimatedGlucose;
      if (glucoseValue > 126) return 'Hiperglucemia';
      if (glucoseValue < 70) return 'Hipoglucemia';
      return '';
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
        case 'RIGIDEZ VASCULAR':
          if (value > 70) return 'Alta Rigidez';
          if (value < 30 && value > 0) return 'Baja Rigidez';
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
            if (systolic === 0 && diastolic === 0) return '';
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
      case 'Alta Rigidez':
        return 'text-[#ea384c]';
      case 'Bradicardia':
      case 'Hipoglucemia':
      case 'Hipotensión':
      case 'Baja Rigidez':
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
    if (label === 'SPO2') return null;

    let median, average, interpretation;

    if (label === 'GLUCOSA' && typeof value === 'object' && value !== null && 'estimatedGlucose' in value) {
      const glucoseDetails = value as GlucoseDetails;
      
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

  const displayValue = (): React.ReactNode => {
    if (label === 'GLUCOSA' && typeof value === 'object' && value !== null && 'estimatedGlucose' in value) {
      return `${(value as GlucoseDetails).estimatedGlucose.toFixed(0)}`;
    }
    if (label === 'RIGIDEZ VASCULAR') {
      return vascularStiffnessIndex !== undefined && vascularStiffnessIndex !== 0
        ? `${vascularStiffnessIndex.toFixed(0)}`
        : 'N/D';
    }
    if (typeof value === 'number') {
      return value.toFixed(0);
    }
    if (typeof value === 'string') {
      const arrhythmiaDisplay = getArrhythmiaDisplay(value);
      if (label === 'ARRITMIAS' && arrhythmiaDisplay) {
        return arrhythmiaDisplay;
      } else if (label === 'PRESIÓN ARTERIAL' && value === '0/0') {
        return 'N/D';
      }
      return value;
    }
    if (typeof value === 'object' && value !== null) {
      return '';
    }
    return '';
  };

  const displayUnit = () => {
    if (label === 'RIGIDEZ VASCULAR') return '';
    if (label === 'GLUCOSA') return 'mg/dL';
    return unit;
  };

  return (
    <div 
      className={cn(
        "relative p-4 rounded-xl shadow-lg flex flex-col items-center justify-center min-h-[120px] transition-all duration-300 ease-in-out cursor-pointer",
        highlighted ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-xl scale-105" : "bg-zinc-800 text-white",
        "hover:scale-[1.02] hover:shadow-2xl",
        showDetails ? "ring-2 ring-blue-400" : ""
      )}
      onClick={handleClick}
    >
      {calibrationProgress !== undefined && calibrationProgress < 100 && (
        <div className="absolute top-0 left-0 w-full bg-blue-500" style={{ height: '4px', width: `${calibrationProgress}%` }}></div>
      )}
      <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-display-small font-bold text-gradient-soft">{displayValue()}<span className="text-base font-normal ml-1">{displayUnit()}</span></div>
      {riskLabel && (riskLabel !== 'Normal' && riskLabel.indexOf('Arritmias') === -1) && (
        <div className={cn("text-sm font-medium mt-1", riskColor)}>{riskLabel}</div>
      )}
      {label === 'ARRITMIAS' && getArrhythmiaDisplay(value)}

      {showDetails && medianAndAverage && (
        <div className="absolute inset-0 bg-zinc-900 bg-opacity-95 p-4 rounded-xl flex flex-col justify-center items-center text-center transition-opacity duration-300 ease-in-out opacity-0" 
             style={{ opacity: showDetails ? 1 : 0, pointerEvents: showDetails ? 'auto' : 'none' }}>
          <p className="text-xs text-zinc-400 mb-1">Mediana esperada: {medianAndAverage.median}</p>
          <p className="text-xs text-zinc-400 mb-1">Promedio esperado: {medianAndAverage.average}</p>
          <p className="text-xs text-zinc-300">{medianAndAverage.interpretation}</p>
        </div>
      )}
    </div>
  );
};

export default VitalSign;
