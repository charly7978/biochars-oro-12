import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { processVitalSigns } from "@/modules/VitalSignsProcessor"; // Integración completa

function Main() {
  const [rawSignal, setRawSignal] = useState<number[]>([]);

  // Simula la llegada de datos del sensor (más tarde se usará la señal real)
  useEffect(() => {
    const interval = setInterval(() => {
      // Genera un valor aleatorio para simular la señal cruda (0 a 100, por ejemplo)
      const newValue = Math.random() * 100;
      setRawSignal((prev) => [...prev, newValue]);
    }, 1000); // cada 1 segundo
    return () => clearInterval(interval);
  }, []);

  // Cada vez que se actualiza la señal, se procesa mediante el optimizador y el algoritmo de presión arterial
  useEffect(() => {
    if (rawSignal.length > 0) {
      const bpResult = processVitalSigns(rawSignal);
      console.log("Presión arterial estimada:", bpResult);
      // Aquí podrías también actualizar el estado global o la UI directamente
    }
  }, [rawSignal]);

  return (
    <div>
      <App />
      {/* Se pueden incluir componentes que muestren bpResult en la interfaz */}
    </div>
  );
}

ReactDOM.render(<Main />, document.getElementById("root"));
}

ReactDOM.render(<Main />, document.getElementById("root"));
