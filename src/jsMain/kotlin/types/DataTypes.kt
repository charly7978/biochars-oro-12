package types

import kotlinx.serialization.Serializable

@Serializable
data class Lipids(val totalCholesterol: Int = 0, val triglycerides: Int = 0)

@Serializable
data class VitalSignsData(
    val spo2: Int = 0,
    val pressure: String = "--/--",
    val arrhythmiaStatus: String = "--", 
    val glucose: Int = 0,
    val lipids: Lipids = Lipids(),
    val hemoglobin: Int = 0,
    // Added from original VitalSignsResult in TS for calibration and lastArrhythmiaData
    val calibration: CalibrationProgressData? = null, 
    val lastArrhythmiaData: ArrhythmiaData? = null 
)

@Serializable
data class ArrhythmiaData(
    val timestamp: Double = 0.0,
    val rmssd: Double = 0.0,
    val rrVariation: Double = 0.0
)

@Serializable // Make sure this is serializable if passed around or stored
data class CalibrationProgressDetails(
    val heartRate: Int = 0,
    val spo2: Int = 0,
    val pressure: Int = 0,
    val arrhythmia: Int = 0,
    val glucose: Int = 0,
    val lipids: Int = 0,
    val hemoglobin: Int = 0
)

@Serializable // Make sure this is serializable
data class CalibrationProgressData(
    val isCalibrating: Boolean = false,
    val progress: CalibrationProgressDetails = CalibrationProgressDetails()
) 