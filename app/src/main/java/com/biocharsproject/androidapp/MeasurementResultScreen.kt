package com.biocharsproject.androidapp

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.biocharsproject.shared.types.VitalSignsMeasurement
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.sin

@Composable
fun MeasurementResultScreen(
    measurementId: Long?,
    onBackPressed: () -> Unit
) {
    // En una implementación real, cargaríamos los datos desde una base de datos
    // usando el measurementId proporcionado
    val measurement = remember { getMeasurementById(measurementId) }
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF101820))
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // Barra superior
            TopAppBar(
                title = { 
                    Text(
                        "Resultado de Medición",
                        color = Color.White
                    ) 
                },
                navigationIcon = {
                    IconButton(onClick = onBackPressed) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Volver",
                            tint = Color.White
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { /* Compartir resultado */ }) {
                        Icon(
                            imageVector = Icons.Default.Share,
                            contentDescription = "Compartir",
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF101820)
                )
            )
            
            // Contenido
            if (measurement == null) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Medición no encontrada",
                        color = Color.White,
                        textAlign = TextAlign.Center
                    )
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp)
                        .verticalScroll(rememberScrollState()),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Fecha y hora
                    Text(
                        text = formatTimestamp(measurement.timestamp),
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White,
                        textAlign = TextAlign.Center
                    )
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    // Ritmo cardíaco
                    HeartRateCard(measurement.heartRate)
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Otras métricas
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // SpO2
                        MetricCard(
                            title = "SpO2",
                            value = "${measurement.spo2}%",
                            description = getSpO2Description(measurement.spo2),
                            modifier = Modifier.weight(1f)
                        )
                        
                        // Presión arterial
                        MetricCard(
                            title = "Presión Arterial",
                            value = if (measurement.systolic != null && measurement.diastolic != null)
                                     "${measurement.systolic}/${measurement.diastolic} mmHg"
                                   else "--/-- mmHg",
                            description = getBPDescription(measurement.systolic, measurement.diastolic),
                            modifier = Modifier.weight(1f)
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Perfusión
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Índice de perfusión
                        MetricCard(
                            title = "Índice de Perfusión",
                            value = measurement.perfusionIndex?.let { String.format("%.2f", it) } ?: "--",
                            description = "Flujo sanguíneo periférico",
                            modifier = Modifier.weight(1f)
                        )
                        
                        // Calidad
                        MetricCard(
                            title = "Calidad de Señal",
                            value = "${(measurement.signalQuality * 100).toInt()}%",
                            description = getQualityDescription(measurement.signalQuality),
                            modifier = Modifier.weight(1f)
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Análisis de arritmia
                    ArrhythmiaAnalysisCard(measurement.arrhythmiaCount)
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    // Simulación de gráfico PPG
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = Color(0xFF1A2530)
                        )
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(16.dp)
                        ) {
                            Text(
                                text = "Señal PPG",
                                style = MaterialTheme.typography.titleSmall,
                                color = Color.White,
                                modifier = Modifier.align(Alignment.TopStart)
                            )
                            
                            // Gráfico simulado
                            PPGWaveformSimulation(heartRate = measurement.heartRate)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun HeartRateCard(heartRate: Int) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF1A2530)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "RITMO CARDÍACO",
                style = MaterialTheme.typography.titleSmall,
                color = Color(0xFF00FFB0),
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Text(
                text = "$heartRate",
                style = MaterialTheme.typography.displayLarge,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 64.sp
            )
            
            Text(
                text = "BPM",
                style = MaterialTheme.typography.titleMedium,
                color = Color.White.copy(alpha = 0.7f)
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Clasificación del ritmo cardíaco
            Chip(
                onClick = { },
                colors = ChipDefaults.chipColors(
                    containerColor = getHeartRateColor(heartRate).copy(alpha = 0.2f),
                    labelColor = getHeartRateColor(heartRate)
                ),
                label = {
                    Text(getHeartRateCategory(heartRate))
                }
            )
        }
    }
}

@Composable
fun MetricCard(
    title: String,
    value: String,
    description: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF1A2530)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                color = Color(0xFF00FFB0),
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = value,
                style = MaterialTheme.typography.headlineMedium,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.height(4.dp))
            
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.7f),
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
fun ArrhythmiaAnalysisCard(arrhythmiaCount: Int) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF1A2530)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "Análisis de Arritmia",
                style = MaterialTheme.typography.titleSmall,
                color = Color(0xFF00FFB0),
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                val arrhythmiaColor = when {
                    arrhythmiaCount > 2 -> Color.Red
                    arrhythmiaCount > 0 -> Color(0xFFFF9800) // Naranja
                    else -> Color(0xFF4CAF50) // Verde
                }
                
                Text(
                    text = if (arrhythmiaCount > 0) 
                             "Se detectaron $arrhythmiaCount irregularidades" 
                           else 
                             "No se detectaron irregularidades",
                    style = MaterialTheme.typography.bodyLarge,
                    color = arrhythmiaColor,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )
                
                Chip(
                    onClick = { },
                    colors = ChipDefaults.chipColors(
                        containerColor = arrhythmiaColor.copy(alpha = 0.2f),
                        labelColor = arrhythmiaColor
                    ),
                    label = {
                        Text(
                            text = when {
                                arrhythmiaCount > 2 -> "Alto"
                                arrhythmiaCount > 0 -> "Moderado"
                                else -> "Normal"
                            }
                        )
                    }
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = when {
                    arrhythmiaCount > 2 -> "Se recomienda consultar a un médico para una evaluación más detallada de su ritmo cardíaco."
                    arrhythmiaCount > 0 -> "Se detectaron algunas irregularidades leves. Considere monitorear su ritmo cardíaco con regularidad."
                    else -> "Su ritmo cardíaco muestra un patrón regular y saludable."
                },
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.7f)
            )
        }
    }
}

@Composable
fun PPGWaveformSimulation(heartRate: Int) {
    // Simulación de una forma de onda PPG basada en el ritmo cardíaco
    val primaryColor = Color(0xFF00FFB0)
    
    Canvas(modifier = Modifier
        .fillMaxSize()
        .padding(top = 24.dp)
    ) {
        val width = size.width
        val height = size.height
        val midY = height / 2
        
        // Simulación de onda PPG
        val path = Path()
        val segmentWidth = width / 20
        
        // Factor de tiempo basado en BPM (para ajustar la frecuencia de la onda)
        val frequency = heartRate / 60.0
        
        path.moveTo(0f, midY)
        
        for (i in 0..20) {
            val x = i * segmentWidth
            
            // Forma de onda de PPG simulada (combinación de senos)
            val t = i / 20.0
            val y = midY - (
                sin(t * Math.PI * 2 * frequency) * 30 + 
                sin(t * Math.PI * 4 * frequency) * 15 +
                sin(t * Math.PI * 8 * frequency) * 5
            ).toFloat()
            
            path.lineTo(x, y)
        }
        
        // Dibujar la línea principal
        drawPath(
            path = path,
            color = primaryColor,
            style = Stroke(width = 4f, cap = StrokeCap.Round)
        )
        
        // Dibujar línea de referencia
        drawLine(
            start = Offset(0f, midY),
            end = Offset(width, midY),
            color = Color.White.copy(alpha = 0.2f),
            strokeWidth = 1f
        )
    }
}

// Funciones auxiliares para clasificaciones
private fun getHeartRateCategory(heartRate: Int): String {
    return when {
        heartRate < 60 -> "Bradicardia"
        heartRate > 100 -> "Taquicardia"
        else -> "Normal"
    }
}

private fun getHeartRateColor(heartRate: Int): Color {
    return when {
        heartRate < 50 || heartRate > 120 -> Color.Red
        heartRate < 60 || heartRate > 100 -> Color(0xFFFF9800) // Naranja
        else -> Color(0xFF4CAF50) // Verde
    }
}

private fun getSpO2Description(spo2: Int): String {
    return when {
        spo2 >= 95 -> "Normal"
        spo2 >= 90 -> "Leve hipoxemia"
        else -> "Hipoxemia"
    }
}

private fun getBPDescription(systolic: Int?, diastolic: Int?): String {
    if (systolic == null || diastolic == null) return "Sin datos"
    
    return when {
        systolic > 140 || diastolic > 90 -> "Hipertensión"
        systolic < 90 || diastolic < 60 -> "Hipotensión"
        else -> "Normal"
    }
}

private fun getQualityDescription(quality: Double): String {
    return when {
        quality > 0.9 -> "Excelente"
        quality > 0.7 -> "Buena"
        quality > 0.5 -> "Aceptable"
        else -> "Baja"
    }
}

// Función de formateo de timestamp
private fun formatTimestamp(timestamp: Long): String {
    val date = Date(timestamp)
    val formatter = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
    return formatter.format(date)
}

// Función para obtener una medición por ID (simulada)
private fun getMeasurementById(measurementId: Long?): VitalSignsMeasurement? {
    if (measurementId == null) return null
    
    // En una implementación real, cargaríamos de una base de datos
    // Para demostración, creamos un resultado de ejemplo
    return VitalSignsMeasurement(
        timestamp = measurementId,
        heartRate = 72,
        spo2 = 98,
        systolic = 120,
        diastolic = 80,
        perfusionIndex = 2.4,
        signalQuality = 0.92,
        arrhythmiaCount = 0
    )
} 