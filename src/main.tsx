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
  const [bloodPressure, setBloodPressure] = useState<any>(null);

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
      // Aquí puedes actualizar la UI o el estado global con bloodPressure
      // Ejemplo: mostrar en consola
      console.log("Presión arterial estimada:", bloodPressure);
    }
  }, [rawSignal]);

  return (
    <div>
      <App />
      {/* Puedes mostrar bloodPressure en la UI aquí si lo deseas */}
    </div>
  );
}

ReactDOM.render(<Main />, document.getElementById("root"));
ReactDOM.render(<Main />, document.getElementById("root"));
