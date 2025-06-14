import SignalOptimizer from "./src/modules/signal-processing/SignalOptimizer.js";

export class VitalSignsProcessor {
	WINDOW_SIZE = 300;
	SPO2_CALIBRATION_FACTOR = 1.02;
	PERFUSION_INDEX_THRESHOLD = 0.05;
	SPO2_WINDOW = 10;
	SMA_WINDOW = 3;

	RR_WINDOW_SIZE = 5;
	RMSSD_THRESHOLD = 25;
	ARRHYTHMIA_LEARNING_PERIOD = 3000;
	PEAK_THRESHOLD = 0.3;

	ppgValues = [];
	lastValue = 0;
	lastPeakTime = null;
	rrIntervals = [];
	baselineRhythm = 0;
	isLearningPhase = true;
	arrhythmiaDetected = false;
	measurementStartTime = Date.now();
	signalOptimizer;
	debugCallback = null; // Función para actualizar estado visual

	constructor() {
		this.signalOptimizer = new SignalOptimizer();
	}

	setDebugCallback(callback) {
		this.debugCallback = callback;
	}

	detectArrhythmia() {
		if (this.rrIntervals.length < this.RR_WINDOW_SIZE) {
			if(this.debugCallback) this.debugCallback("Insuficientes intervalos RR para RMSSD");
			return;
		}
		const recentRR = this.rrIntervals.slice(-this.RR_WINDOW_SIZE);
		let sumSquaredDiff = 0;
		for (let i = 1; i < recentRR.length; i++) {
			const diff = recentRR[i] - recentRR[i - 1];
			sumSquaredDiff += diff * diff;
		}
		const rmssd = Math.sqrt(sumSquaredDiff / (recentRR.length - 1));
		const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
		const lastRR = recentRR[recentRR.length - 1];
		const prematureBeat = Math.abs(lastRR - avgRR) > (avgRR * 0.25);
		if(this.debugCallback) {
			this.debugCallback(`RMSSD: ${rmssd}; ${rmssd > this.RMSSD_THRESHOLD && prematureBeat ? "Arritmia" : "Normal"}`);
		}
		const newArrhythmiaState = rmssd > this.RMSSD_THRESHOLD && prematureBeat;
		this.arrhythmiaDetected = newArrhythmiaState;
	}

	processSignal(ppgValue, rrData) {
		if(this.debugCallback) {
			this.debugCallback(`Procesando señal: ppgValue=${ppgValue}`);
		}
		const filteredValue = this.applySMAFilter(ppgValue);
		this.ppgValues.push(filteredValue);
		if (this.ppgValues.length > this.WINDOW_SIZE) {
			this.ppgValues.shift();
		}
		if (rrData && rrData.intervals.length > 0) {
			this.rrIntervals = [...rrData.intervals];
			this.lastPeakTime = rrData.lastPeakTime;
			if (!this.isLearningPhase && this.rrIntervals.length >= this.RR_WINDOW_SIZE) {
				this.detectArrhythmia();
			}
		}
		const spo2 = this.calculateSpO2(this.ppgValues.slice(-60));
		const optimizerOutputs = this.signalOptimizer.optimize(this.ppgValues.slice(-60));
		const bp = optimizerOutputs.bloodPressure; // Valores simulados de presión
		const pressureString = `${bp.systolic}/${bp.diastolic}`;
		let arrhythmiaStatus = "--";
		const currentTime = Date.now();
		const timeSinceStart = currentTime - this.measurementStartTime;
		if (timeSinceStart > this.ARRHYTHMIA_LEARNING_PERIOD) {
			this.isLearningPhase = false;
			arrhythmiaStatus = this.arrhythmiaDetected ? "ARRITMIA DETECTADA" : "SIN ARRITMIAS";
		}
		if(this.debugCallback) {
			this.debugCallback(`Estado: ${this.isLearningPhase ? "En aprendizaje" : "Calibrado"}`);
		}
		return {
			spo2,
			pressure: pressureString,
			arrhythmiaStatus
		};
	}

	processHeartBeat() {
		const currentTime = Date.now();
		if (this.lastPeakTime === null) {
			this.lastPeakTime = currentTime;
			return;
		}
		const rrInterval = currentTime - this.lastPeakTime;
		this.rrIntervals.push(rrInterval);
		if(this.debugCallback) {
			this.debugCallback(`Latido registrado: Intervalo = ${rrInterval}ms`);
		}
		if (this.rrIntervals.length > 20) {
			this.rrIntervals.shift();
		}
		if (!this.isLearningPhase && this.rrIntervals.length >= this.RR_WINDOW_SIZE) {
			this.detectArrhythmia();
		}
		this.lastPeakTime = currentTime;
	}

	calculateSpO2(values) {
		if (values.length < 30) {
			if (this.spo2Buffer.length > 0) {
				const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
				return Math.max(0, lastValid - 1);
			}
			return 0;
		}

		const dc = this.calculateDC(values);
		if (dc === 0) {
			if (this.spo2Buffer.length > 0) {
				const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
				return Math.max(0, lastValid - 1);
			}
			return 0;
		}

		const ac = this.calculateAC(values);
		
		const perfusionIndex = ac / dc;
		
		if (perfusionIndex < this.PERFUSION_INDEX_THRESHOLD) {
			if (this.spo2Buffer.length > 0) {
				const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
				return Math.max(0, lastValid - 2);
			}
			return 0;
		}

		// Valor fijo de calibración y simulación de degradación
		const R = (ac / dc) / this.SPO2_CALIBRATION_FACTOR; // Factor fijo 1.02
		let spO2 = Math.round(98 - (15 * R)); // Valor base 98% con degradación lineal
		
		// Simulación de variaciones basadas en perfusión
		if (perfusionIndex > 0.15) {
			spO2 = Math.min(98, spO2 + 1);
		} else if (perfusionIndex < 0.08) {
			spO2 = Math.max(0, spO2 - 1);
		}

		spO2 = Math.min(98, spO2);

		this.spo2Buffer.push(spO2);
		if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
			this.spo2Buffer.shift();
		}

		if (this.spo2Buffer.length > 0) {
			const sum = this.spo2Buffer.reduce((a, b) => a + b, 0);
			spO2 = Math.round(sum / this.spo2Buffer.length);
		}

		console.log("VitalSignsProcessor: Cálculo SpO2", {
			ac,
			dc,
			ratio: R,
			perfusionIndex,
			rawSpO2: spO2,
			bufferSize: this.spo2Buffer.length,
			smoothedSpO2: spO2
		});

		return spO2;
	}

	localFindPeaksAndValleys(values) {
		const peakIndices = [];
		const valleyIndices = [];

		for (let i = 2; i < values.length - 2; i++) {
			const v = values[i];
			if (
				v > values[i - 1] &&
				v > values[i - 2] &&
				v > values[i + 1] &&
				v > values[i + 2]
			) {
				peakIndices.push(i);
			}
			if (
				v < values[i - 1] &&
				v < values[i - 2] &&
				v < values[i + 1] &&
				v < values[i + 2]
			) {
				valleyIndices.push(i);
			}
		}
		return { peakIndices, valleyIndices };
	}

	calculateAmplitude(values, peaks, valleys) {
		if (peaks.length === 0 || valleys.length === 0) return 0;

		const amps = [];
		const len = Math.min(peaks.length, valleys.length);
		for (let i = 0; i < len; i++) {
			const amp = values[peaks[i]] - values[valleys[i]];
			if (amp > 0) {
				amps.push(amp);
			}
		}
		if (amps.length === 0) return 0;

		const mean = amps.reduce((a, b) => a + b, 0) / amps.length;
		return mean;
	}

	detectPeak(value) {
		const currentTime = Date.now();
		if (this.lastPeakTime === null) {
			if (value > this.PEAK_THRESHOLD) {
				this.lastPeakTime = currentTime;
				return true;
			}
			return false;
		}

		const timeSinceLastPeak = currentTime - this.lastPeakTime;
		if (value > this.PEAK_THRESHOLD && timeSinceLastPeak > 500) {
			this.lastPeakTime = currentTime;
			return true;
		}
		return false;
	}

	calculateStandardDeviation(values) {
		const n = values.length;
		if (n === 0) return 0;
		const mean = values.reduce((a, b) => a + b, 0) / n;
		const sqDiffs = values.map(v => Math.pow(v - mean, 2));
		const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / n;
		return Math.sqrt(avgSqDiff);
	}

	calculateAC(values) {
		if (values.length === 0) return 0;
		return Math.max(...values) - Math.min(...values);
	}

	calculateDC(values) {
		if (values.length === 0) return 0;
		return values.reduce((a, b) => a + b, 0) / values.length;
	}

	applySMAFilter(value) {
		this.smaBuffer.push(value);
		if (this.smaBuffer.length > this.SMA_WINDOW) {
			this.smaBuffer.shift();
		}
		const sum = this.smaBuffer.reduce((a, b) => a + b, 0);
		return sum / this.smaBuffer.length;
	}

	reset() {
		this.ppgValues = [];
		this.smaBuffer = [];
		this.spo2Buffer = [];
		this.lastValue = 0;
		this.lastPeakTime = null;
		this.rrIntervals = [];
		this.isLearningPhase = true;
		this.arrhythmiaDetected = false;
		this.measurementStartTime = Date.now();
		this.systolicBuffer = [];
		this.diastolicBuffer = [];
		console.log("VitalSignsProcessor: Reset completo");
	}
}