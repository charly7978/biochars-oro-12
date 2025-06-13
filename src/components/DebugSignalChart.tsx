import React, { useEffect, useRef, useState } from "react";

interface DebugSignalChartProps {
  signal: number[];
  peaks?: number[];
  label?: string;
  color?: string;
  maxPoints?: number;
  enabled?: boolean;
}

const DebugSignalChart: React.FC<DebugSignalChartProps> = ({
  signal,
  peaks = [],
  label = "Señal",
  color = "#0EA5E9",
  maxPoints = 200,
  enabled = true
}) => {
  const [displaySignal, setDisplaySignal] = useState<number[]>([]);
  const lastUpdate = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastUpdate.current > 300) {
      lastUpdate.current = now;
      setDisplaySignal(signal.slice(-maxPoints));
    }
    // eslint-disable-next-line
  }, [signal, enabled, maxPoints]);

  if (!enabled) return null;

  const width = 400;
  const height = 80;
  const margin = 10;
  const max = Math.max(...displaySignal, 1);
  const min = Math.min(...displaySignal, 0);
  const range = max - min || 1;

  return (
    <div style={{ background: "#222", borderRadius: 8, padding: 4, marginBottom: 8, width }}>
      <div style={{ color: "#fff", fontSize: 12, marginBottom: 2 }}>{label}</div>
      <svg width={width} height={height}>
        {/* Signal line */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth={2}
          points={displaySignal.map((v, i) => {
            const x = (i / (displaySignal.length - 1)) * (width - 2 * margin) + margin;
            const y = height - margin - ((v - min) / range) * (height - 2 * margin);
            return `${x},${y}`;
          }).join(" ")}
        />
        {/* Peaks */}
        {peaks.map((i) => {
          const x = (i / (signal.length - 1)) * (width - 2 * margin) + margin;
          const y = height - margin - ((signal[i] - min) / range) * (height - 2 * margin);
          return <circle key={i} cx={x} cy={y} r={4} fill="#ef4444" stroke="#fff" strokeWidth={1} />;
        })}
      </svg>
    </div>
  );
};

export default DebugSignalChart;
