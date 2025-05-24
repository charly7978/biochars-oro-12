package com.biocharsproject.shared.modules

import com.biocharsproject.shared.types.ProcessingError
import com.biocharsproject.shared.types.ProcessedSignal
import kotlinx.coroutines.launch

// Assuming CommonImageDataWrapper is defined in PPGSignalProcessor.kt or another common file
// For now, if PPGSignalProcessor.kt defines it as a public data class, it should be accessible.
// import com.biocharsproject.shared.modules.PPGSignalProcessor.CommonImageDataWrapper // If nested and public
// Or if it's top-level in that file or another:
// import com.biocharsproject.shared.utils.CommonImageDataWrapper // Example path

class SignalProcessor(
    onSignalReadyCallback: ((signal: ProcessedSignal) -> Unit)? = null,
    onErrorCallback: ((error: ProcessingError) -> Unit)? = null
) : PPGSignalProcessor(onSignalReadyCallback, onErrorCallback) {

    private var isInitializedWrapper: Boolean = false

    init {
        launch {
            try {
                super.initialize() 
                isInitializedWrapper = true
                println("Wrapper SignalProcessor initialized successfully.")
            } catch (e: Exception) {
                isInitializedWrapper = false
                val errorMsg = "Failed to initialize SignalProcessor wrapper: ${e.message}"
                println(errorMsg)
                onError?.invoke(ProcessingError("initialization_failed", errorMsg, System.currentTimeMillis()))
            }
        }
    }

    private fun checkInitialization() {
        if (!isInitializedWrapper) {
            val errorMessage = "SignalProcessor wrapper is not initialized."
            onError?.invoke(ProcessingError("not_initialized", errorMessage, System.currentTimeMillis()))
            println(errorMessage)
        }
    }

    // Override initialize from the SignalProcessor INTERFACE (not necessarily PPGSignalProcessor's one if different)
    // The SignalProcessor interface in shared.types has `suspend fun initialize()`
    // PPGSignalProcessor has `actual override suspend fun initialize()`. So this override is fine.
    override suspend fun initialize() { 
        if (isInitializedWrapper) {
            println("SignalProcessor (wrapper) already initialized.")
            return
        }
        try {
            super.initialize() // Call initialize of PPGSignalProcessor
            isInitializedWrapper = true
            println("Wrapper SignalProcessor initialize() called and marked as initialized.")
        } catch (e: Exception) {
            isInitializedWrapper = false
            val msg = "Error during SignalProcessor wrapper initialization: ${e.message}"
            onError?.invoke(ProcessingError("initialization_error", msg, System.currentTimeMillis()))
            println(msg)
            // In commonMain, we don't return JS Promise; suspend fun handles async.
            // Throwing an exception is a common way to signal suspend fun failure.
            throw e 
        }
    }

    // This overrides PPGSignalProcessor's `open fun processFrame(imageData: CommonImageDataWrapper)`
    override fun processFrame(imageData: CommonImageDataWrapper) { 
        checkInitialization()
        if (!isInitializedWrapper) { 
            println("Skipping processFrame as SignalProcessor (wrapper) is not initialized.")
            return
        }
        // isProcessing and isCalibrating are properties of the super class (PPGSignalProcessor)
        if (super.isProcessing || super.isCalibrating) { 
            super.processFrame(imageData)
        } else {
            // println("Wrapper: Processor is stopped. Skipping frame.")
        }
    }
    
    // Start, Stop, Calibrate are inherited from PPGSignalProcessor.
    // They already match the SignalProcessor interface defined in shared.types
    // No need to override them here unless additional wrapper-specific logic is needed.
} 