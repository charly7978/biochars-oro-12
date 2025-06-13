import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { processVitalSigns } from "@/modules/VitalSignsProcessor";

// Función real para obtener la señal del hardware
async function getRealSensorData(): Promise<number[]> {
  // ...implementación real...
  return [];
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
      <App bloodPressure={bloodPressure} />
      {/* Si quieres mostrarlo directamente aquí: */}
      {/* {bloodPressure && (
        <div>{bloodPressure.systolic}/{bloodPressure.diastolic} mmHg</div>
      )} */}
    </div>
  );
}

ReactDOM.render(<Main />, document.getElementById("root"));
      )}
    </div>
  );
}

ReactDOM.render(<Main />, document.getElementById("root"));
