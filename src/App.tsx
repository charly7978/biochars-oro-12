import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import HeartRateMonitor from "./components/HeartRateMonitor";

const App = () => {
  return (
    <Router>
      <div className="App">
        <HeartRateMonitor />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
