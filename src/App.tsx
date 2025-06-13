import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { CalibrationDialog } from "./components/CalibrationDialog";
import { VitalSignsProcessor } from "./modules/vital-signs/VitalSignsProcessor.js"; // asegúrate de la ruta correcta

const App = () => {
  const [feedback, setFeedback] = useState("Sin información");
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    // Crear la instancia única del procesador de signos vitales
    const processor = new VitalSignsProcessor();
    // Conectar callback de depuración para recibir mensajes visuales
    processor.setDebugCallback((msg: string) => {
      setDebugInfo(msg);
    });
    // Simulamos una lectura de sensor real (en producción este evento vendría del hardware)
    const samplePPG = Math.random();
    const sampleRR = { intervals: [800, 750, 780], lastPeakTime: Date.now() };
    const result = processor.processSignal(samplePPG, sampleRR);
    setFeedback(result.arrhythmiaStatus);

    // Se podrían agregar listeners a eventos reales en lugar de esta simulación
  }, []);

  return (
    <Router>
      <div className="app-container">
        <CalibrationDialog feedback={feedback} debugInfo={debugInfo} />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
