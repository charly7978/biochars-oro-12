package modules

// Importar la clase base que acabamos de traducir
import modules.signal_processing.PPGSignalProcessor
import modules.signal_processing.ImageDataWrapper // Necesario para processFrame
import types.ProcessingError
import types.ProcessedSignal
import kotlinx.coroutines.launch // Para lanzar la inicialización

// El nombre OriginalPPGSignalProcessor se usó en el TS para referirse a la clase del archivo PPGSignalProcessor.ts
// En Kotlin, simplemente extendemos la clase PPGSignalProcessor que ya definimos en su propio archivo.

class SignalProcessor(
    onSignalReadyCallback: ((signal: ProcessedSignal) -> Unit)? = null,
    onErrorCallback: ((error: ProcessingError) -> Unit)? = null
) : PPGSignalProcessor(onSignalReadyCallback, onErrorCallback) {

    private var isInitialized: Boolean = false

    // El constructor de la clase base (PPGSignalProcessor) ya maneja los callbacks.
    // No es necesario re-declarar `onSignalReady` y `onError` aquí si solo se pasan.

    init {
        // El constructor de la superclase se llama implícitamente.
        // Lanzamos la inicialización en una corutina para no bloquear el hilo principal,
        // ya que `initialize()` es una función suspendida.
        // Usamos el `coroutineContext` heredado de PPGSignalProcessor (que es Dispatchers.Default + job)
        launch {
            try {
                super.initialize() // Llama al initialize de PPGSignalProcessor
                isInitialized = true
                println("Wrapper SignalProcessor initialized successfully.")
            } catch (e: Exception) {
                isInitialized = false
                // Usar el handleError de la clase base (PPGSignalProcessor) si está disponible y es apropiado,
                // o manejar el error de inicialización de una manera específica aquí.
                // super.handleError("initialization_failed", "Failed to initialize SignalProcessor wrapper: ${e.message}")
                println("Failed to initialize SignalProcessor wrapper: ${e.message}")
                onError?.invoke(ProcessingError("initialization_failed", "Failed to initialize SignalProcessor wrapper: ${e.message}", System.currentTimeMillis()))
            }
        }
    }

    private fun checkInitialization() {
        if (!isInitialized) {
            val errorMessage = "SignalProcessor is not initialized. Call initialize() and wait for completion."
            // Idealmente, esto debería lanzar una excepción más específica o usar el callback de error.
            // throw IllegalStateException(errorMessage)
            // Usar el callback de error si está disponible
            onError?.invoke(ProcessingError("not_initialized", errorMessage, System.currentTimeMillis()))
            // También podría ser útil un log
            println(errorMessage)
        }
    }

    // Override de initialize para asegurar que se marque nuestro flag isInitialized.
    // La interfaz SignalProcessor requiere `initialize(): Promise<void>`.
    // PPGSignalProcessor ya implementa esto. Aquí podemos envolverlo o simplemente confiar en el init block.
    // Si queremos mantener la firma exacta de la interfaz Promise<void> para este wrapper:
    override suspend fun initialize(): kotlin.js.Promise<Nothing?> { // Cumple la firma de PPGSignalProcessor
        if (isInitialized) {
            println("SignalProcessor (wrapper) already initialized.")
            return kotlin.js.Promise { resolve, _ -> resolve(null) } // Ya inicializado
        }
        try {
            // Llamar al initialize de la superclase
            // El resultado de super.initialize() ya es una Promise adecuada.
            val resultPromise = super.initialize()
            // Esperar a que la promesa de la superclase se resuelva
            // Esto es un poco redundante si el init{} block ya lo hace, pero asegura el estado.
            // En un contexto suspendido, podríamos querer `resultPromise.await()` si fuera una Deferred de Kotlin.
            // Como es una JS Promise, la forma de "esperarla" en un suspend context es más compleja
            // o simplemente confiamos que se complete.
            // Por ahora, asumimos que la llamada en init {} es suficiente y aquí solo marcamos.
            isInitialized = true // Marcar como inicializado después de la llamada (aunque se hace en init)
            println("Wrapper SignalProcessor initialize() called and marked as initialized.")
            return resultPromise 
        } catch (e: Exception) {
            isInitialized = false
            val msg = "Error during SignalProcessor wrapper initialization: ${e.message}"
            onError?.invoke(ProcessingError("initialization_error", msg, System.currentTimeMillis()))
            println(msg)
            return kotlin.js.Promise { _, reject -> reject(js("Error(msg)")) }
        }
    }

    // Override processFrame para añadir la verificación de inicialización.
    // La firma de `processFrame` en `PPGSignalProcessor` usa `ImageDataWrapper`.
    fun processFrame(imageData: ImageDataWrapper) { // No es override porque la firma no es de una interfaz
        checkInitialization()
        if (!isInitialized) { // Doble chequeo por si checkInitialization solo loguea
            println("Skipping processFrame as SignalProcessor (wrapper) is not initialized.")
            return
        }
        if (isProcessing || isCalibrating) { // Usar las propiedades de la superclase
            super.processFrame(imageData)
        } else {
            // println("Wrapper: Processor is stopped. Skipping frame.")
        }
    }
    
    // Start, Stop, Calibrate se heredan de PPGSignalProcessor.
    // Se pueden sobreescribir si se necesita lógica adicional específica del wrapper.
    // override fun start() {
    //     checkInitialization()
    //     if(isInitialized) super.start()
    // }

    // override suspend fun calibrate(): kotlin.js.Promise<Boolean> {
    //     checkInitialization()
    //     if(!isInitialized) return kotlin.js.Promise { _, reject -> reject(js("Error('Not initialized')")) }
    //     return super.calibrate()
    // }
} 