package com.biocharsproject.shared.integrations.supabase

import kotlinx.serialization.Serializable

@Serializable
sealed interface JsonElement {
    @Serializable
    data class JsonString(val value: String) : JsonElement
    @Serializable
    data class JsonNumber(val value: Double) : JsonElement
    @Serializable
    data class JsonBoolean(val value: Boolean) : JsonElement
    @Serializable
    object JsonNull : JsonElement
    @Serializable
    data class JsonObject(val fields: Map<String, JsonElement?>) : JsonElement
    @Serializable
    data class JsonArray(val elements: List<JsonElement?>) : JsonElement
}

@Serializable
enum class CalibrationStatus {
    pending,
    in_progress,
    completed,
    failed
}

object Database {
    object Public {
        object Tables {
            @Serializable
            data class CalibrationSettingsRow(
                val created_at: String,
                val diastolic_reference: Double? = null,
                val id: String,
                val is_active: Boolean? = null,
                val last_calibration_date: String? = null,
                val perfusion_index: Double? = null,
                val quality_threshold: Double? = null,
                val red_threshold_max: Double? = null,
                val red_threshold_min: Double? = null,
                val stability_threshold: Double? = null,
                val status: CalibrationStatus? = null,
                val systolic_reference: Double? = null,
                val updated_at: String,
                val user_id: String
            )

            @Serializable
            data class CalibrationSettingsInsert(
                val created_at: String? = null,
                val diastolic_reference: Double? = null,
                val id: String? = null,
                val is_active: Boolean? = null,
                val last_calibration_date: String? = null,
                val perfusion_index: Double? = null,
                val quality_threshold: Double? = null,
                val red_threshold_max: Double? = null,
                val red_threshold_min: Double? = null,
                val stability_threshold: Double? = null,
                val status: CalibrationStatus? = null,
                val systolic_reference: Double? = null,
                val updated_at: String? = null,
                val user_id: String
            )

            @Serializable
            data class CalibrationSettingsUpdate(
                val created_at: String? = null,
                val diastolic_reference: Double? = null,
                val id: String? = null,
                val is_active: Boolean? = null,
                val last_calibration_date: String? = null,
                val perfusion_index: Double? = null,
                val quality_threshold: Double? = null,
                val red_threshold_max: Double? = null,
                val red_threshold_min: Double? = null,
                val stability_threshold: Double? = null,
                val status: CalibrationStatus? = null,
                val systolic_reference: Double? = null,
                val updated_at: String? = null,
                val user_id: String? = null
            )

            @Serializable
            data class MeasurementsRow(
                val arrhythmia_count: Int,
                val created_at: String,
                val diastolic: Double,
                val heart_rate: Double,
                val id: String,
                val measured_at: String,
                val quality: Double,
                val spo2: Double,
                val systolic: Double,
                val user_id: String
            )

            @Serializable
            data class MeasurementsInsert(
                val arrhythmia_count: Int,
                val created_at: String? = null,
                val diastolic: Double,
                val heart_rate: Double,
                val id: String? = null,
                val measured_at: String? = null,
                val quality: Double,
                val spo2: Double,
                val systolic: Double,
                val user_id: String
            )

            @Serializable
            data class MeasurementsUpdate(
                val arrhythmia_count: Int? = null,
                val created_at: String? = null,
                val diastolic: Double? = null,
                val heart_rate: Double? = null,
                val id: String? = null,
                val measured_at: String? = null,
                val quality: Double? = null,
                val spo2: Double? = null,
                val systolic: Double? = null,
                val user_id: String? = null
            )

            @Serializable
            data class ProfilesRow(
                val created_at: String,
                val full_name: String? = null,
                val id: String,
                val updated_at: String
            )

            @Serializable
            data class ProfilesInsert(
                val created_at: String? = null,
                val full_name: String? = null,
                val id: String,
                val updated_at: String? = null
            )

            @Serializable
            data class ProfilesUpdate(
                val created_at: String? = null,
                val full_name: String? = null,
                val id: String? = null,
                val updated_at: String? = null
            )
        }

        object Views { /* ... */ }
        object Functions { /* ... */ }
        object Enums {
            val calibration_status: CalibrationStatus? = null
        }
        object CompositeTypes { /* ... */ }
    }
} 