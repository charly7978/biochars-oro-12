
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
  const maxHistoryLength = 100; // Puntos a mostrar
  const peakMarkerRef = useRef<boolean[]>([]);
  const lastPeakTimeRef = useRef<number | null>(null);
  const MIN_PEAK_INTERVAL_MS = 300; // Reducido para captar latidos más rápidos (antes 350)
  
  // Control de animación para efecto látigo mejorado
  const animationRef = useRef<{
    isAnimating: boolean;
    startTime: number;
    duration: number;
    startValue: number;
    targetValue: number;
  }>({
    isAnimating: false,
    startTime: 0,
    duration: 120, // Animación más rápida (antes 150)
    startValue: 0,
    targetValue: 0
  });

  // Añadir nuevo valor al historial con mejor manejo de picos
  useEffect(() => {
    // Normalizar el valor entre 0-1 para facilitar escalado
    const normalizedValue = Math.max(0, Math.min(1, Math.abs(value) / 80)); // Normalización ajustada para mejor visualización
    
    // Verificar si este es un pico válido (evitar picos muy cercanos)
    const now = Date.now();
    let validPeak = isPeak;
    
    if (isPeak && lastPeakTimeRef.current) {
      const timeSinceLastPeak = now - lastPeakTimeRef.current;
      if (timeSinceLastPeak < MIN_PEAK_INTERVAL_MS) {
        // Ignorar picos demasiado cercanos
        validPeak = false;
      }
    }
    
    if (validPeak) {
      lastPeakTimeRef.current = now;
      console.log("HeartRateMonitor: Pico visual confirmado", { 
        time: new Date(now).toISOString().substr(11, 12),
        value: normalizedValue.toFixed(3)
      });
    }
    
    // Aplicar amplificación para picos - más contraste para mejor visibilidad
    const amplifiedValue = validPeak 
      ? normalizedValue * 10.0 // Mayor amplificación para picos confirmados (aumentado significativamente)
      : normalizedValue * 0.3; // Reducir más no-picos para mejor contraste
    
    // Añadir al historial
    historyRef.current.push(amplifiedValue);
    peakMarkerRef.current.push(validPeak);
    
    // Mantener historial en longitud deseada
    if (historyRef.current.length > maxHistoryLength) {
      historyRef.current.shift();
      peakMarkerRef.current.shift();
    }
    
    // Iniciar efecto látigo si es un pico válido
    if (validPeak && showWhipEffect) {
      animationRef.current = {
        isAnimating: true,
        startTime: Date.now(),
        duration: 120, // Más rápido para mejor sincronización
        startValue: amplifiedValue,
        targetValue: amplifiedValue * 0.1 // Caída más dramática (antes 0.15)
      };
    }
    
    // Dibujar la señal actualizada
    drawSignal();
    
  }, [value, isPeak, showWhipEffect]);

  const drawSignal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Establecer estilos
    ctx.lineWidth = 6; // Línea más gruesa para mejor visibilidad (antes 5)
    ctx.lineJoin = 'round';
    
    // Usar calidad para determinar color con mejor contraste
    let signalColor;
    if (quality >= 70) { // Umbral reducido (antes 80)
      signalColor = '#ef4444'; // Rojo brillante para buena calidad
    } else if (quality >= 40) { // Umbral reducido (antes 50)
      signalColor = '#f97316'; // Naranja para calidad media
    } else if (quality >= 15) { // Umbral reducido (antes 20)
      signalColor = '#eab308'; // Amarillo para calidad baja
    } else {
      signalColor = '#a1a1aa'; // Gris para muy baja calidad
    }

    // Dibujar la línea base para referencia
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(100,100,100,0.2)';
    ctx.lineWidth = 1;
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    
    // Si no hay suficientes puntos, salir
    if (historyRef.current.length < 2) return;
    
    // Dibujar línea principal con mejor visibilidad y grosor variable
    ctx.beginPath();
    ctx.strokeStyle = signalColor;
    
    const history = [...historyRef.current];
    const peakMarkers = [...peakMarkerRef.current];
    
    for (let i = 0; i < history.length; i++) {
      const x = (i / (maxHistoryLength - 1)) * canvas.width;
      let y = canvas.height - (history[i] * canvas.height * 0.9);
      
      // Valores de altura limitados entre 5% y 95% del canvas para mayor rango visual
      y = Math.min(Math.max(y, canvas.height * 0.05), canvas.height * 0.95);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        // Si el punto actual o el anterior es un pico, usar línea curva para suavizar
        const isPeakPoint = peakMarkers[i] || (i > 0 && peakMarkers[i-1]);
        
        if (isPeakPoint) {
          // Aumentar grosor en los picos para mejor visibilidad
          ctx.lineWidth = 8; // Aumentado para mayor visibilidad (antes 6)
          
          // Calcular el punto de control para curva más natural
          const prevX = ((i-1) / (maxHistoryLength - 1)) * canvas.width;
          const prevY = canvas.height - (history[i-1] * canvas.height * 0.9);
          
          // Calcular punto de control para la curva
          const cpX = (prevX + x) / 2;
          const cpY = (prevY + y) / 2;
          
          // Usar curvas para suavizar los picos
          ctx.quadraticCurveTo(cpX, cpY, x, y);
        } else {
          // Para puntos no pico, usar línea recta con grosor normal
          ctx.lineWidth = 3; // No cambiar para mantener contraste
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();
    
    // Dibujar puntos destacados para los picos
    for (let i = 0; i < history.length; i++) {
      if (peakMarkers[i]) {
        const x = (i / (maxHistoryLength - 1)) * canvas.width;
        const y = canvas.height - (history[i] * canvas.height * 0.9);
        
        // Dibujar círculo para el pico
        ctx.beginPath();
        ctx.fillStyle = '#fef08a'; // Amarillo para mejor visibilidad
        ctx.arc(x, y, 10, 0, Math.PI * 2); // Aumentado tamaño del círculo (antes 8)
        ctx.fill();
        
        // Añadir borde para contraste
        ctx.beginPath();
        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = 3;
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.stroke();
        
        // Mostrar valor del pico con más precisión
        const displayValue = Math.round(history[i] * 12); // Amplificado para mejor lectura (antes *10)
        ctx.font = 'bold 16px sans-serif'; // Fuente más grande (antes 14px)
        ctx.fillStyle = '#ffffff'; 
        ctx.textAlign = 'center';
        ctx.fillText(displayValue.toString(), x, y - 15);
        
        // Agregar círculo de "halo" pulsante para destacar más el pico
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(225, 29, 72, 0.5)'; // Más opaco para mejor visibilidad (antes 0.4)
        ctx.lineWidth = 2;
        ctx.arc(x, y, 15, 0, Math.PI * 2); // Círculo más grande (antes 12)
        ctx.stroke();
      }
    }
  };

  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      <canvas 
        ref={canvasRef}
        width={400} 
        height={200}
        className="w-full h-full"
      />
      {isPeak && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white/90 text-sm font-bold animate-pulse bg-red-500/30 px-2 py-1 rounded-md">
          LATIDO
        </div>
      )}
    </div>
  );
};

export default HeartRateMonitor;
