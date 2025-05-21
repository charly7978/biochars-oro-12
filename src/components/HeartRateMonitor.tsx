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
  const MIN_PEAK_INTERVAL_MS = 300; // Intervalo mínimo entre picos para evitar duplicados
  
  // Control de animación para efecto látigo
  const animationRef = useRef<{
    isAnimating: boolean;
    startTime: number;
    duration: number;
    startValue: number;
    targetValue: number;
  }>({
    isAnimating: false,
    startTime: 0,
    duration: 180, // Animación más rápida para mejor sincronización
    startValue: 0,
    targetValue: 0
  });

  // Añadir nuevo valor al historial con mejor manejo de picos
  useEffect(() => {
    // Normalizar el valor entre 0-1 para facilitar escalado
    const normalizedValue = Math.max(0, Math.min(1, Math.abs(value) / 100));
    
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
    }
    
    // Aplicar amplificación para picos
    const amplifiedValue = validPeak 
      ? normalizedValue * 5.5 // Mayor amplificación para picos confirmados
      : normalizedValue * 0.5; // Reducir no-picos para mejor contraste
    
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
        duration: 180, // Más rápido para mejor sincronización
        startValue: amplifiedValue,
        targetValue: amplifiedValue * 0.1 // Caída más dramática
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
    ctx.lineWidth = 5; // Línea más gruesa para mejor visibilidad
    ctx.lineJoin = 'round';
    
    // Usar calidad para determinar color con mejor contraste
    let signalColor;
    if (quality >= 80) {
      signalColor = '#ef4444'; // Rojo brillante para buena calidad
    } else if (quality >= 50) {
      signalColor = '#f97316'; // Naranja para calidad media
    } else if (quality >= 20) {
      signalColor = '#eab308'; // Amarillo para calidad baja
    } else {
      signalColor = '#6b7280'; // Gris para calidad muy baja
    }
    
    ctx.strokeStyle = signalColor;
    
    // Calcular ancho para cada punto
    const pointWidth = canvas.width / maxHistoryLength;
    
    // Comenzar a dibujar desde la parte inferior del último punto
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    
    // Dibujar la señal como líneas verticales (picos) en lugar de una onda continua
    historyRef.current.forEach((point, index) => {
      const x = index * pointWidth;
      const isPeakPoint = peakMarkerRef.current[index];
      
      // Para puntos de pico, dibujar líneas más altas con posible efecto látigo
      if (isPeakPoint) {
        // Calcular altura de pico con potencial efecto látigo
        let peakHeight = canvas.height - (point * canvas.height * 0.98); // Picos más altos
        
        // Aplicar efecto látigo si estamos aún en animación para este pico
        if (animationRef.current.isAnimating) {
          const elapsed = Date.now() - animationRef.current.startTime;
          const progress = Math.min(1, elapsed / animationRef.current.duration);
          
          // Efecto no lineal para efecto látigo - movimiento inicial más rápido
          const easeOutQuint = 1 - Math.pow(1 - progress, 8); // Aumentado para efecto más dramático
          
          // Aplicar el efecto de animación
          const animatedPoint = animationRef.current.startValue - 
            (animationRef.current.startValue - animationRef.current.targetValue) * easeOutQuint;
          
          // Usar el valor animado para los últimos puntos
          if (index >= historyRef.current.length - 5) {
            peakHeight = canvas.height - (animatedPoint * canvas.height * 0.98);
          }
          
          // Finalizar animación cuando completa
          if (progress >= 1) {
            animationRef.current.isAnimating = false;
          }
        }
        
        // Dibujar línea vertical de pico
        ctx.lineTo(x, peakHeight);
        
        // Dibujar pico más afilado (meseta mínima)
        ctx.lineTo(x + pointWidth * 0.1, peakHeight); // Meseta más corta
        
        // Volver hacia abajo
        ctx.lineTo(x + pointWidth, canvas.height);
      } else {
        // Para puntos que no son picos, dibujar líneas verticales mucho más pequeñas
        const baselineHeight = canvas.height - (point * canvas.height * 0.15); // Línea base aún más plana
        
        // Dibujar línea vertical más pequeña
        ctx.lineTo(x, baselineHeight);
        ctx.lineTo(x + pointWidth, canvas.height);
      }
    });
    
    // Cerrar el trazado y trazar
    ctx.stroke();
    
    // Dibujar marcadores de pico con mejor visibilidad
    ctx.fillStyle = '#ef4444';
    peakMarkerRef.current.forEach((isPeakPoint, index) => {
      if (isPeakPoint) {
        const x = index * pointWidth;
        const point = historyRef.current[index];
        const dotSize = 9; // Puntos más grandes para mejor visibilidad
        const yPos = canvas.height - (point * canvas.height * 0.98);
        ctx.beginPath();
        ctx.arc(x, yPos, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  };

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={120}
      className={cn("w-full h-full bg-black/30 rounded-md", className)}
    />
  );
};

export default HeartRateMonitor;
