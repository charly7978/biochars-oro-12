import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { useSignalProcessor } from '../hooks/useSignalProcessor';

interface CalibrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCalibrationStart: () => void;
  onCalibrationEnd: () => void;
}

const CalibrationDialog: React.FC<CalibrationDialogProps> = ({ 
  isOpen, 
  onClose,
  onCalibrationStart,
  onCalibrationEnd
}) => {
  const { isCalibrating, calibrationStatus, startCalibration, endCalibration } = useSignalProcessor();
  const [systolic, setSystolic] = React.useState<string>("");
  const [diastolic, setDiastolic] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleCalibration = async () => {
    try {
      setIsSubmitting(true);
      startCalibration();
    } catch (error) {
      console.error("Error durante la calibración:", error);
      endCalibration();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {
      if (!isSubmitting) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-md perspective-1000">
        <motion.div
          initial={{ rotateY: -90 }}
          animate={{ rotateY: 0 }}
          exit={{ rotateY: 90 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ transformStyle: "preserve-3d" }}
          className="bg-background p-6 rounded-lg shadow-lg"
        >
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (!isSubmitting) {
                  onClose();
                }
              }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold">Calibración Manual</h2>
            <div className="w-9" />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Presión Sistólica</label>
              <Input
                type="number"
                placeholder="120"
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Presión Diastólica</label>
              <Input
                type="number"
                placeholder="80"
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                className="w-full"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleCalibration}
              disabled={!systolic || !diastolic || isSubmitting}
            >
              {isSubmitting ? "Calibrando..." : "Calibrar"}
            </Button>

            <p className="text-sm text-gray-500 text-center">
              Ingrese los valores de su última medición de presión arterial para calibrar el sistema
            </p>

            <div className="my-4">
              {isCalibrating && calibrationStatus && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-blue-700">
                    {calibrationStatus.instructions}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${calibrationStatus.progress}%` }}></div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Progreso: {calibrationStatus.progress}%
                  </div>
                  {calibrationStatus.isComplete && (
                    <div className={`mt-2 text-sm font-semibold ${calibrationStatus.succeeded ? 'text-green-600' : 'text-red-600'}`}>
                      {calibrationStatus.succeeded ? '¡Calibración exitosa!' : 'Calibración fallida'}
                      {calibrationStatus.recommendations && (
                        <ul className="mt-1 list-disc list-inside text-xs text-gray-700">
                          {calibrationStatus.recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default CalibrationDialog;
