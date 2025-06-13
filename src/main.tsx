import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { processVitalSigns } from "@/modules/VitalSignsProcessor";

// Función que debe retornar los datos reales del sensor.
// Reemplazá este placeholder con la implementación real (por ej. suscripción a eventos, API, etc.).
async function getRealSensorData(): Promise<number[]> {
  // ...existing code... (implementación real)
  // Ejemplo: return await sensorAPI.getLatestSamples();
  return []; // Devuelve un array de números reales adquiridos del sensor.
}

function Main() {
  const [rawSignal, setRawSignal] = useState<number[]>([]);

  // Reemplazamos la simulación: se subscriben a datos reales del sensor.
  useEffect(() => {
    let isMounted = true;
    async function subscribeToSensor() {
      try {
        const data = await getRealSensorData();
        if (isMounted && data.length) {
          setRawSignal((prev) => [...prev, ...data]);
        }
      } catch (error) {
        console.error("Error acquiring sensor data:", error);
      }
    }
    // Se invoca la función según la frecuencia necesaria (por ejemplo, cada 1s).
    const interval = setInterval(subscribeToSensor, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Procesa la señal real adquirida
  useEffect(() => {
    if (rawSignal.length > 0) {
      const bpResult = processVitalSigns(rawSignal);
      console.log("Presión arterial estimada:", bpResult);
      // ...existing code to update UI or state...
    }
  }, [rawSignal]);

  return (
    <div>
      <App />
      {/* Agregar componente(s) de UI para mostrar resultados si es necesario */}
    </div>
  );
}

ReactDOM.render(<Main />, document.getElementById("root"));
