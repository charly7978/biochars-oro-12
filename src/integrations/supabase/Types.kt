package integrations.supabase

import kotlinx.serialization.Serializable // Necesitaremos kotlinx.serialization para JSON

// Equivalente al tipo Json de TypeScript
@Serializable
sealed interface JsonElement {
    @Serializable
    data class JsonString(val value: String) : JsonElement
    @Serializable
    data class JsonNumber(val value: Double) : JsonElement // Usar Double para números en JSON
    @Serializable
    data class JsonBoolean(val value: Boolean) : JsonElement
    @Serializable
    object JsonNull : JsonElement
    @Serializable
    data class JsonObject(val fields: Map<String, JsonElement?>) : JsonElement
    @Serializable
    data class JsonArray(val elements: List<JsonElement?>) : JsonElement
}

// Enum para calibration_status
@Serializable
enum class CalibrationStatus {
    pending,
    in_progress,
    completed,
    failed
}

// Definición de la estructura de la base deatos
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
            // Relationships podrían modelarse si se usa un ORM específico o para referencia
            // val relationships: List<Relationship> = listOf(
            //     Relationship("calibration_settings_user_id_fkey", listOf("user_id"), false, "profiles", listOf("id"))
            // )

            @Serializable
            data class MeasurementsRow(
                val arrhythmia_count: Int, // Asumiendo Int para conteo
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

        object Views {
            // No hay vistas definidas en el esquema proporcionado
        }

        object Functions {
            // No hay funciones definidas en el esquema proporcionado
        }

        object Enums {
            val calibration_status: CalibrationStatus? = null // Referencia al enum class
        }

        object CompositeTypes {
            // No hay tipos compuestos definidos
        }
    }
}

/*
  Nota sobre los tipos genéricos (Tables, TablesInsert, TablesUpdate, Enums, CompositeTypes):
  Estos son tipos de utilidad en TypeScript que ayudan con la inferencia de tipos para el cliente de Supabase JS.
  En Kotlin, la forma de interactuar con Supabase (ya sea a través de un cliente Kotlin específico para Supabase
  o interoperando con el cliente JS) dictará cómo se manejan estos tipos.
  Podrían no ser necesarios o podrían ser reemplazados por funcionalidades del cliente Kotlin.
  Por ahora, los omito ya que su traducción directa es compleja y podría no ser útil
  sin un contexto de cliente Supabase en Kotlin.
*/ 