package com.biocharsproject.androidapp

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.biocharsproject.shared.types.VitalSignsMeasurement
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun MeasurementHistoryScreen(
    onBackPressed: () -> Unit,
    onMeasurementSelected: (Long) -> Unit
) {
    // Para esta implementación de demostración, usamos datos de ejemplo
    // En una implementación real, se cargarían de una base de datos o API
    val measurements = remember { generateSampleMeasurements() }
    
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
                        "Historial de Mediciones",
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
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF101820)
                )
            )
            
            // Lista de mediciones
            if (measurements.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No hay mediciones guardadas",
                        color = Color.White,
                        textAlign = TextAlign.Center
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    items(measurements) { measurement ->
                        MeasurementCard(
                            measurement = measurement,
                            onClick = { onMeasurementSelected(measurement.timestamp) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun MeasurementCard(
    measurement: VitalSignsMeasurement,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
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
            // Fecha y hora
            Text(
                text = formatTimestamp(measurement.timestamp),
                style = MaterialTheme.typography.titleMedium,
                color = Color(0xFF00FFB0),
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Métricas principales en una fila
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Ritmo cardíaco
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${measurement.heartRate}",
                        style = MaterialTheme.typography.headlineSmall,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "BPM",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.7f)
                    )
                }
                
                // SpO2
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${measurement.spo2}%",
                        style = MaterialTheme.typography.headlineSmall,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "SpO2",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.7f)
                    )
                }
                
                // Presión arterial
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = if (measurement.systolic != null && measurement.diastolic != null)
                                "${measurement.systolic}/${measurement.diastolic}"
                              else "--/--",
                        style = MaterialTheme.typography.headlineSmall,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "mmHg",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.7f)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Calidad y arritmias
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Calidad: ${(measurement.signalQuality * 100).toInt()}%",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.8f)
                )
                
                if (measurement.arrhythmiaCount > 0) {
                    Chip(
                        onClick = { },
                        colors = ChipDefaults.chipColors(
                            containerColor = Color.Red.copy(alpha = 0.2f),
                            labelColor = Color.Red.copy(alpha = 0.8f)
                        ),
                        label = {
                            Text("${measurement.arrhythmiaCount} arritmias")
                        }
                    )
                }
            }
        }
    }
}

// Función auxiliar para formatear timestamps
private fun formatTimestamp(timestamp: Long): String {
    val date = Date(timestamp)
    val formatter = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
    return formatter.format(date)
}

// Función para generar datos de ejemplo
private fun generateSampleMeasurements(): List<VitalSignsMeasurement> {
    val now = System.currentTimeMillis()
    val hour = 60 * 60 * 1000L
    val day = 24 * hour
    
    return listOf(
        VitalSignsMeasurement(
            timestamp = now - hour,
            heartRate = 72,
            spo2 = 98,
            systolic = 120,
            diastolic = 80,
            perfusionIndex = 2.4,
            signalQuality = 0.92,
            arrhythmiaCount = 0
        ),
        VitalSignsMeasurement(
            timestamp = now - 2 * day,
            heartRate = 85,
            spo2 = 96,
            systolic = 130,
            diastolic = 85,
            perfusionIndex = 1.8,
            signalQuality = 0.86,
            arrhythmiaCount = 2
        ),
        VitalSignsMeasurement(
            timestamp = now - 5 * day,
            heartRate = 68,
            spo2 = 99,
            systolic = 118,
            diastolic = 78,
            perfusionIndex = 2.2,
            signalQuality = 0.95,
            arrhythmiaCount = 0
        ),
        VitalSignsMeasurement(
            timestamp = now - 7 * day,
            heartRate = 78,
            spo2 = 97,
            systolic = 125,
            diastolic = 82,
            perfusionIndex = 2.0,
            signalQuality = 0.89,
            arrhythmiaCount = 1
        )
    )
} 