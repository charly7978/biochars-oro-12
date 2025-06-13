import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { CalibrationDialog } from "./components/CalibrationDialog";
import { useVitalSignsProcessor } from "./hooks/useVitalSignsProcessor";

const App = () => {
  const { calibrationFeedback } = useVitalSignsProcessor();

  return (
    <Router>
      <div className="app-container">
        <CalibrationDialog feedback={calibrationFeedback} />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
          <Route path="/" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
