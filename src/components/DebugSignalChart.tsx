import React from "react";

interface DebugSignalChartProps {
  signal: number[];
  peaks?: number[];
  label?: string;
  color?: string;
}

const DebugSignalChart: React.FC<DebugSignalChartProps> = ({ signal, peaks = [], label = "Señal", color = "#0EA5E9" }) => {
  const width = 400;
  const height = 80;
  const margin = 10;
  const max = Math.max(...signal, 1);
  const min = Math.min(...signal, 0);
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
          points={signal.map((v, i) => {
            const x = (i / (signal.length - 1)) * (width - 2 * margin) + margin;
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
