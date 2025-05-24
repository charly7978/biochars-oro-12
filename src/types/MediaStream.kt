package types

import kotlin.js.Promise // Para Promise<void>

// Declaraciones externas para las APIs de MediaStream y relacionadas con ImageCapture
// Estas interfaces permiten a Kotlin interactuar con objetos y APIs existentes de JavaScript del navegador.

external interface MediaTrackCapabilities {
    var torch: Boolean? // Las propiedades opcionales en TS (?:) se vuelven nulables en Kotlin (Type?)
    var exposureMode: dynamic // String o Array de Strings, `dynamic` es flexible aquí o usar `Any?`
    var exposureTime: MediaSettingsRange?
    var focusMode: dynamic // String o Array de Strings
    var whiteBalanceMode: dynamic // String o Array de Strings
    var focusDistance: MediaSettingsRange?
    // Añadir otros campos si son necesarios y están definidos en el estándar o uso.
}

external interface MediaSettingsRange {
    var max: Double?
    var min: Double?
    var step: Double?
}

// ConstrainDOMString puede ser un String o un array de Strings, o un objeto con exact/ideal.
// Usar `dynamic` o `Any?` para flexibilidad, o definir estructuras más específicas si se prefiere.
typealias ConstrainDOMString = Any? // Simplificación, podría ser `String` o `Array<String>` o `ConstrainDOMStringParameters`
/*
external interface ConstrainDOMStringParameters {
    var exact: dynamic // String or Array<String>
    var ideal: dynamic // String or Array<String>
}
*/
typealias ConstrainDouble = Any? // number o DoubleRange
/*
external interface ConstrainDoubleRange : MediaSettingsRange { // Extiende MediaSettingsRange
    var exact: Double?
    var ideal: Double?
}
*/

external interface MediaTrackConstraintSet {
    var torch: Boolean?
    var exposureMode: ConstrainDOMString?
    var exposureTime: ConstrainDouble? // Podría ser ConstrainDoubleRange
    var focusMode: ConstrainDOMString?
    var whiteBalanceMode: ConstrainDOMString?
    var focusDistance: ConstrainDouble? // Podría ser ConstrainDoubleRange
    // Añadir otros campos de constraints
}

// MediaStreamTrack ya es una interfaz estándar del navegador.
// Se puede extender si hay propiedades/métodos específicos que se usan y no están en la definición estándar de Kotlin/JS.
/*
external interface MediaStreamTrack {
    // ... propiedades y métodos estándar ...
    fun getCapabilities(): MediaTrackCapabilities? // Estándar
    fun getConstraints(): MediaTrackConstraintSet? // Estándar
    fun applyConstraints(constraints: MediaTrackConstraintSet?): Promise<Unit> // Estándar
}
*/

// ImageCapture es una API experimental/navegador específico.
@JsName("ImageCapture") // Asegurar que el nombre JS sea correcto
external class ImageCapture(videoTrack: Any /* MediaStreamTrack */) {
    fun takePhoto(photoSettings: dynamic = definedExternally): Promise<Any /* Blob */>
    fun getPhotoCapabilities(): Promise<dynamic /* PhotoCapabilities */>
    fun getPhotoSettings(): dynamic /* PhotoSettings */
    fun grabFrame(): Promise<Any /* ImageBitmap */>
    val track: Any /* MediaStreamTrack */
}

// Definiciones adicionales para PhotoCapabilities, PhotoSettings si son necesarias
/*
external interface PhotoCapabilities {
    // ... campos ...
}
external interface PhotoSettings {
    // ... campos ...
}
*/ 