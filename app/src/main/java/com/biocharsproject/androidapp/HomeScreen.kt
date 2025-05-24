package com.biocharsproject.androidapp

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun HomeScreen(
    onNavigateToMonitor: () -> Unit,
    onNavigateToHistory: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF101820))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Logo y cabecera
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(top = 48.dp)
            ) {
                // Logo o icono
                Image(
                    painter = painterResource(id = R.drawable.ic_launcher_foreground),
                    contentDescription = "Logo",
                    modifier = Modifier
                        .size(120.dp)
                        .background(
                            color = Color(0xFF303840),
                            shape = RoundedCornerShape(60.dp)
                        )
                        .padding(16.dp),
                    contentScale = ContentScale.Fit
                )
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // Nombre de la aplicación
                Text(
                    text = "BioChars Health",
                    style = MaterialTheme.typography.headlineLarge,
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF00FFB0)
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                // Eslogan o descripción
                Text(
                    text = "Medición avanzada de signos vitales",
                    style = MaterialTheme.typography.bodyLarge,
                    color = Color.White.copy(alpha = 0.8f),
                    textAlign = TextAlign.Center
                )
            }
            
            // Sección principal con botones
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 32.dp)
            ) {
                // Botón para iniciar monitoreo
                Button(
                    onClick = onNavigateToMonitor,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(60.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF00FFB0)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(
                        painter = painterResource(id = android.R.drawable.ic_media_play),
                        contentDescription = "Iniciar",
                        tint = Color(0xFF101820),
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "INICIAR MEDICIÓN",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF101820)
                    )
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                // Botón para historial
                OutlinedButton(
                    onClick = onNavigateToHistory,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(60.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = Color(0xFF00FFB0)
                    ),
                    border = ButtonDefaults.outlinedButtonBorder.copy(
                        width = 2.dp,
                        brush = androidx.compose.ui.graphics.SolidColor(Color(0xFF00FFB0))
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(
                        painter = painterResource(id = android.R.drawable.ic_menu_recent_history),
                        contentDescription = "Historial",
                        tint = Color(0xFF00FFB0),
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "VER HISTORIAL",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            
            // Footer con información adicional
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(bottom = 24.dp)
            ) {
                Text(
                    text = "Desarrollado por BioChars Project",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.5f),
                    textAlign = TextAlign.Center
                )
                
                Spacer(modifier = Modifier.height(4.dp))
                
                Text(
                    text = "v1.0.0",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.3f),
                    textAlign = TextAlign.Center
                )
            }
        }
    }
} 