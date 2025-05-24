package types

import kotlin.js.Promise // Para Promise<void>

// Declaraciones externas para las APIs de Screen Orientation

// La especificación de Screen Orientation API define OrientationType como una enum de strings.
// En Kotlin, podemos usar un String o un enum class si preferimos seguridad de tipos.
// Usar String directamente es más cercano al JS.

// typealias OrientationType = String // "any", "natural", etc.
// O un enum para más seguridad:
enum class OrientationType {
    any,
    natural,
    landscape,
    portrait,
    `portrait-primary`, // Los identificadores con guiones necesitan backticks
    `portrait-secondary`,
    `landscape-primary`,
    `landscape-secondary`;

    // Para convertir a string que espera la API JS:
    override fun toString(): String = name.replace("`", "") // Quita los backticks si los hay
}

external interface ScreenOrientation {
    val angle: Double // En TS es number, Double es apropiado
    var onchange: ((event: Any /* Event */) -> Unit)? // `this` se maneja diferente, el tipo de evento es `Any` o `org.w3c.dom.events.Event`
    val type: String // La API JS devuelve un string, así que mantenemos String aquí aunque tengamos el enum.
                    // Se podría tener un getter que convierta a OrientationType enum.
    
    fun lock(orientation: String): Promise<Unit> // La API espera un string.
    //fun lock(orientation: OrientationType): Promise<Unit> // Versión alternativa usando el enum
    fun unlock()
}

// Extender la interfaz estándar `Screen` del DOM si no está ya disponible con `orientation`
// en las definiciones de Kotlin/JS para el DOM.
// Las bibliotecas estándar de Kotlin/JS (`kotlin-stdlib-js`) ya pueden proveer esto.
// Si no, se definiría así:
/*
@JsName("Screen")
external interface Screen {
    val orientation: ScreenOrientation?
}
*/

// Extender HTMLElement para requestFullscreen si no está ya disponible.
// Esto también suele estar en las bibliotecas estándar del DOM para Kotlin/JS.
/*
external interface HTMLElement {
    fun requestFullscreen(): Promise<Unit>
}
*/

// Acceso global a screen.orientation
// external val screen: Screen // Ya debería estar disponible a través de kotlin.browser.window.screen 