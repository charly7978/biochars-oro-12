import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { processVitalSigns } from "@/modules/VitalSignsProcessor";

// Función que obtiene la señal real del hardware (reemplaza por tu integración real)
async function getRealSensorData(): Promise<number[]> {
  // Implementa aquí la adquisición real de datos del sensor
  // Por ejemplo: return await sensorAPI.getLatestSamples();
  return []; // ← Reemplaza esto por la integración real
}

function Main() {
  const [rawSignal, setRawSignal] = useState<number[]>([]);
  const [bloodPressure, setBloodPressure] = useState<{ systolic: number; diastolic: number } | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchSensorData() {
      try {
        const data = await getRealSensorData();
        if (isMounted && data.length) {
          setRawSignal((prev) => [...prev, ...data]);
        }
      } catch (error) {
        console.error("Error acquiring sensor data:", error);
      }
    }
    const interval = setInterval(fetchSensorData, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (rawSignal.length > 0) {
      const { bloodPressure } = processVitalSigns(rawSignal);
      setBloodPressure(bloodPressure);
    }
  }, [rawSignal]);

  return (
    <div>
      <App />
      {/* Ejemplo de display directo, reemplaza por tu integración real */}
      {bloodPressure && (
        <div className="fixed bottom-4 right-4 bg-white/80 rounded-lg shadow-lg p-4 text-black text-center z-50">
          <div className="font-bold text-lg">Presión Arterial</div>
          <div className="text-2xl font-mono">
            {bloodPressure.systolic}/{bloodPressure.diastolic} mmHg
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.render(<Main />, document.getElementById("root"));
