/*
  firmware.ino
  ESP32 / Arduino sketch (skeleton)

  - Reads sensors (placeholder)
  - Runs a mock prediction routine (replace with TFLite Micro model code)
  - Sends serial message to host when bill detected:
      FORMAT: BILL:<denom>:<confidence>\n
  - Listens for host commands:
      VEND:1 -> trigger stack motor
*/

#include <Arduino.h>
#include <TensorFlowLite.h>
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include "tensorflow/lite/version.h"

#define SERIAL_BAUD 115200
#define MOTOR_PIN 2

// Tensor arena ~40KB for small CNNs (adjust as needed)
#define TENSOR_ARENA_SIZE (40 * 1024)
static uint8_t tensor_arena[TENSOR_ARENA_SIZE];

// Provide your model via model_data.h (generated from model.tflite using xxd -i)
#if __has_include("model_data.h")
#include "model_data.h"  // expected: g_model_data, g_model_data_len
#define HAVE_MODEL 1
extern const unsigned char g_model_data[];
extern const int g_model_data_len;
#else
#define HAVE_MODEL 0
#endif

static tflite::MicroInterpreter* interpreter = nullptr;
static TfLiteTensor* input = nullptr;
static TfLiteTensor* output = nullptr;
static bool model_ready = false;

// Example mapping from class index to denomination
static const int CLASSES = 6;  // adjust to your model
static const int DENOMS[CLASSES] = { 20, 50, 100, 200, 500, 1000 };

void init_model() {
#if HAVE_MODEL
  const tflite::Model* model = tflite::GetModel(g_model_data);
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    Serial.println("[ML] Model schema mismatch");
    model_ready = false;
    return;
  }

  static tflite::AllOpsResolver resolver;
  static tflite::MicroInterpreter static_interpreter(model, resolver, tensor_arena, TENSOR_ARENA_SIZE);
  interpreter = &static_interpreter;

  if (interpreter->AllocateTensors() != kTfLiteOk) {
    Serial.println("[ML] AllocateTensors failed");
    model_ready = false;
    return;
  }

  input = interpreter->input(0);
  output = interpreter->output(0);
  model_ready = true;
  Serial.println("[ML] TFLite Micro ready");
#else
  Serial.println("[ML] No model_data.h linked. Running in fallback mode.");
  model_ready = false;
#endif
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);
  Serial.println("Firmware started");
  init_model();
}

void handleVendCommand() {
  Serial.println("ACK:VEND");
  digitalWrite(MOTOR_PIN, HIGH);
  delay(300);
  digitalWrite(MOTOR_PIN, LOW);
}

void runInferenceOnce() {
  if (!model_ready) return;

  // --- Real preprocessing placeholder ---
  // Replace with actual sensor/camera capture and preprocessing
  // Expected input shape: (H, W, C) where H=W=64, C=3 for uint8 model
  // For demonstration, we fill with a pattern; in production:
  // - Capture image from camera module
  // - Resize to model input size (e.g., 64x64)
  // - Normalize to [0, 255] (uint8 models) or [-1, 1] (float models)

  // Example: fill with a gradient pattern (replace with real data)
  const int input_h = input->dims->data[1];
  const int input_w = input->dims->data[2];
  const int input_c = input->dims->data[3];
  uint8_t* input_buf = input->data.uint8;

  // Simulate a simple pattern (replace with real image preprocessing)
  for (int h = 0; h < input_h; ++h) {
    for (int w = 0; w < input_w; ++w) {
      for (int c = 0; c < input_c; ++c) {
        int idx = (h * input_w + w) * input_c + c;
        // Create a horizontal gradient per channel (demo only)
        input_buf[idx] = (uint8_t)((w * 255) / input_w);
      }
    }
  }

  // --- Inference ---
  unsigned long start_ms = millis();
  TfLiteStatus invoke_status = interpreter->Invoke();
  unsigned long elapsed_ms = millis() - start_ms;

  if (invoke_status != kTfLiteOk) {
    Serial.println("[ML] Invoke failed");
    return;
  }

  // --- Post-processing ---
  // Assuming output is a classification vector of length CLASSES
  // Determine output type (uint8 or float) and handle accordingly
  int best_idx = -1;
  float best_score = -1.0f;

  if (output->type == kTfLiteUInt8) {
    uint8_t* output_buf = output->data.uint8;
    for (int i = 0; i < CLASSES && i < output->bytes; ++i) {
      float score = output_buf[i] / 255.0f;  // normalize to [0,1]
      if (score > best_score) {
        best_score = score;
        best_idx = i;
      }
    }
  } else if (output->type == kTfLiteFloat32) {
    float* output_buf = output->data.f;
    for (int i = 0; i < CLASSES && i < (output->bytes / sizeof(float)); ++i) {
      float score = output_buf[i];
      if (score > best_score) {
        best_score = score;
        best_idx = i;
      }
    }
  } else {
    Serial.println("[ML] Unsupported output type");
    return;
  }

  // Map class index to denomination
  int denom = (best_idx >= 0 && best_idx < CLASSES) ? DENOMS[best_idx] : 0;
  float conf = best_score;

  // Emit result to backend
  Serial.print("BILL:");
  Serial.print(denom);
  Serial.print(":");
  Serial.println(conf, 3);
  Serial.print("[ML] Inference took ");
  Serial.print(elapsed_ms);
  Serial.println(" ms");
}

void loop() {
  // Serial command handling
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.startsWith("VEND:")) {
      handleVendCommand();
    }
  }

  static unsigned long last = 0;
  if (millis() - last > 30000) {  // every 30s
    last = millis();
    if (model_ready) {
      runInferenceOnce();
    } else {
      // Fallback simulation
      int denom = 100;
      float conf = 0.90;
      Serial.print("BILL:");
      Serial.print(denom);
      Serial.print(":");
      Serial.println(conf, 3);
    }
  }

  delay(50);
}
