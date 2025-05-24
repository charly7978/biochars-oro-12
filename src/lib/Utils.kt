package lib

// El tipo ClassValue de 'clsx' puede ser: string | number | null | boolean | { [key: string]: any } | ClassValue[]
// En Kotlin, podemos representarlo como una mezcla de tipos o simplificarlo si el uso es más restringido.

/**
 * Una función simple para concatenar nombres de clases, similar a `clsx`.
 * Maneja Strings, y condicionalmente clases desde Maps o Pairs.
 * No maneja todas las complejidades de `clsx` o `tailwind-merge`.
 *
 * Ejemplos de uso:
 * cn("clase1", "clase2") // -> "clase1 clase2"
 * cn("clase1", if (cond) "clase2" else null) // -> "clase1 clase2" o "clase1"
 * cn(mapOf("clase-condicional" to true, "otra-clase" to false)) // -> "clase-condicional"
 * cn("base", listOf("adicional1", mapOf("condicional" to true)))
 */
fun cn(vararg inputs: Any?): String {
    val classes = mutableListOf<String>()

    inputs.forEach { input ->
        processInput(input, classes)
    }
    return classes.joinToString(" ")
}

private fun processInput(input: Any?, classes: MutableList<String>) {
    when (input) {
        is String -> if (input.isNotBlank()) classes.add(input.trim())
        is List<*> -> input.forEach { processInput(it, classes) } // Manejar listas de inputs
        is Array<*> -> input.forEach { processInput(it, classes) } // Manejar arrays de inputs
        is Map<*, *> -> {
            input.forEach { (key, value) ->
                if (key is String && value is Boolean && value) {
                    if (key.isNotBlank()) classes.add(key.trim())
                }
                // Podríamos añadir más lógica para manejar otros tipos de valores en el Map si es necesario
            }
        }
        // Podríamos añadir soporte para Pair<String, Boolean> si es un patrón común
        // is Pair<*,*> -> {
        //    if (input.first is String && input.second is Boolean && input.second as Boolean) {
        //        classes.add(input.first as String)
        //    }
        // }
        // Ignorar null, Booleanos directamente (a menos que estén en un Map), Numbers, etc.
        // La biblioteca clsx original tiene un manejo más complejo para estos.
    }
}

// Si se necesita integración con tailwind-merge, se requeriría una biblioteca Kotlin/JS
// que implemente esa lógica o interactúe con la biblioteca JS `tailwind-merge`.
// Por ejemplo, se podría definir una función `external` para `twMerge`:
// external fun twMerge(vararg classStrings: String): String
// Y luego `cn` podría ser:
// fun cnTw(vararg inputs: Any?): String {
//    val rawClasses = cn(*inputs) // Usa la función cn de arriba
//    return twMerge(rawClasses) // Luego la pasa por twMerge
// } 