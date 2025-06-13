import * as tf from '@tensorflow/tfjs';

export class TensorFlowProcessor {
  private model: tf.LayersModel | null = null;
  private modelLoaded: Promise<void>;

  constructor() {
    this.modelLoaded = this.loadModel();
  }

  private async loadModel(): Promise<void> {
    try {
      // En una aplicación real, aquí cargarías tu modelo entrenado.
      // Por ejemplo: this.model = await tf.loadLayersModel('indexeddb://my-vital-signs-model');
      // O desde una URL: this.model = await tf.loadLayersModel('./path/to/your/model.json');

      // Para esta demostración, crearemos un modelo simple como placeholder.
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({ units: 10, activation: 'relu', inputShape: [1] }),
          tf.layers.dense({ units: 1, activation: 'linear' })
        ]
      });
      this.model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
      console.log("TensorFlowProcessor: Modelo de placeholder cargado.");

      // Seleccionar el backend WebGL para rendimiento en el navegador
      if (tf.getBackend() !== 'webgl') {
        await tf.setBackend('webgl');
        console.log("TensorFlowProcessor: Backend cambiado a WebGL.");
      }

    } catch (error) {
      console.error("TensorFlowProcessor: Error al cargar el modelo", error);
      this.model = null;
    }
  }

  public async processData(data: number[]): Promise<number[]> {
    await this.modelLoaded;

    if (!this.model) {
      console.warn("TensorFlowProcessor: Modelo no cargado, devolviendo datos sin procesar.");
      return data; // Devolver los datos originales si el modelo no está disponible
    }

    try {
      // Convertir el array de números a un tensor de TensorFlow
      const inputTensor = tf.tensor2d(data, [data.length, 1]);
      
      // Realizar la inferencia
      const outputTensor = this.model.predict(inputTensor) as tf.Tensor;
      
      // Convertir el tensor de salida de nuevo a un array de números
      const outputData = await outputTensor.array() as number[][];
      
      // Limpiar los tensores de la memoria de la GPU
      inputTensor.dispose();
      outputTensor.dispose();

      // Flatten the 2D array to 1D if necessary
      return outputData.flat();
    } catch (error) {
      console.error("TensorFlowProcessor: Error durante la inferencia del modelo", error);
      return data; // Devolver los datos originales en caso de error
    }
  }

  public async dispose(): Promise<void> {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      console.log("TensorFlowProcessor: Modelo TensorFlow liberado.");
    }
  }
} 