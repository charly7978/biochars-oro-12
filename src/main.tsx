import React from "react";
import ReactDOM from "react-dom";
import App from "./App";

// Importamos la función que conecta todo el procesamiento de los signos vitales.
import { processVitalSigns } from "@/modules/VitalSignsProcessor";

function Main() {
  // Simulación de recepción de señal bruta: en producción, se recibirá desde el sensor.
  const [rawSignal, setRawSignal] = React.useState<number[]>([]);

  // Simula la llegada de nuevas muestras cada segundo.
  React.useEffect(() => {
    const interval = setInterval(() => {
      // Genera un valor aleatorio, reemplazar por datos reales de hardware.
      const newValue = Math.random() * 100;
      setRawSignal((prev) => [...prev, newValue]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cada vez que rawSignal cambie, se procesa la señal.
  React.useEffect(() => {
    if (rawSignal.length > 0) {
      const bpResult = processVitalSigns(rawSignal);
      console.log("Resultado de presión arterial:", bpResult);
      // Aquí podrías actualizar el estado global o enviar la información a la UI.
    }
  }, [rawSignal]);

  return (
    <div>
      {/* ...existing layout, App's components, etc... */}
      <App />
    </div>
  );
}

ReactDOM.render(<Main />, document.getElementById("root"));
