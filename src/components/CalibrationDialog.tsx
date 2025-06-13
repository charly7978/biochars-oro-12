import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";

interface CalibrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCalibrationStart: () => void;
  onCalibrationEnd: () => void;
  feedback: string;
}

const CalibrationDialog: React.FC<CalibrationDialogProps> = ({ 
  isOpen, 
  onClose,
  onCalibrationStart,
  onCalibrationEnd,
  feedback
}) => {
  const [systolic, setSystolic] = React.useState<string>("");
  const [diastolic, setDiastolic] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleCalibration = async () => {
    try {
      setIsSubmitting(true);
      onCalibrationStart();

      // Simulamos un pequeño delay para la calibración
      await new Promise(resolve => setTimeout(resolve, 1000));

      onCalibrationEnd();
      setTimeout(() => {
        onClose();
      }, 500);

    } catch (error) {
      console.error("Error durante la calibración:", error);
      onCalibrationEnd();
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
          </div>
        </motion.div>
      </DialogContent>

      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        zIndex: 1000, // se renderiza por encima
        pointerEvents: "none",
        textAlign: "center",
        padding: "1rem",
        background: "rgba(0, 0, 0, 0.3)",
        color: "white"
      }}>
        {feedback}
      </div>
    </Dialog>
  );
};

export default CalibrationDialog;
