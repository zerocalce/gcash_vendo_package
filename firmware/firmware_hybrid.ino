/*
  firmware_hybrid.ino
  Hybrid firmware with dual classification: Gemini (server-side) + TFLite (local fallback)
  
  - Primary: Uses server-side Gemini vision classification
  - Secondary: Local TFLite model when Gemini fails or confidence is low
  - Automatic switching based on confidence thresholds
  - Maintains performance and resource efficiency
*/

#include <Arduino.h>
#include <TensorFlowLite.h>
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include "tensorflow/lite/version.h"

#define SERIAL_BAUD 115200
#define MOTOR_PIN 2
#define IR_SENSOR_PIN 4  // IR sensor for bill detection

// Tensor arena for TFLite model
#define TENSOR_ARENA_SIZE (40 * 1024)
static uint8_t tensor_arena[TENSOR_ARENA_SIZE];

// Classification modes
enum ClassificationMode {
  MODE_GEMINI = 0,
  MODE_TFLITE = 1,
  MODE_HYBRID = 2
};

// Model configuration
static const int CLASSES = 6;
static const int DENOMS[CLASSES] = { 20, 50, 100, 200, 500, 1000 };

// TFLite model setup
#if __has_include("model_data.h")
#include "model_data.h"
#define HAVE_TFLITE_MODEL 1
extern const unsigned char g_model_data[];
extern const int g_model_data_len;
#else
#define HAVE_TFLITE_MODEL 0
#endif

static tflite::MicroInterpreter* interpreter = nullptr;
static TfLiteTensor* input = nullptr;
static TfLiteTensor* output = nullptr;
static bool tflite_ready = false;

// Hybrid classification state
static ClassificationMode current_mode = MODE_HYBRID;
static float gemini_confidence_threshold = 0.7f;
static int failed_gemini_attempts = 0;
static const int MAX_FAILED_ATTEMPTS = 3;

// Timing
static unsigned long last_inference_time = 0;
static const unsigned long INFERENCE_INTERVAL = 5000; // 5 seconds for demo

void init_tflite_model() {
#if HAVE_TFLITE_MODEL
  Serial.println("[HYBRID] Initializing TFLite model...");
  
  const tflite::Model* model = tflite::GetModel(g_model_data);
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    Serial.println("[HYBRID] Model schema mismatch");
    tflite_ready = false;
    return;
  }

  static tflite::AllOpsResolver resolver;
  static tflite::MicroInterpreter static_interpreter(model, resolver, tensor_arena, TENSOR_ARENA_SIZE);
  interpreter = &static_interpreter;

  if (interpreter->AllocateTensors() != kTfLiteOk) {
    Serial.println("[HYBRID] TFLite AllocateTensors failed");
    tflite_ready = false;
    return;
  }

  input = interpreter->input(0);
  output = interpreter->output(0);
  tflite_ready = true;
  
  Serial.print("[HYBRID] TFLite model ready - Input shape: [");
  Serial.print(input->dims->data[0]);
  for (int i = 1; i < input->dims->size; ++i) {
    Serial.print(", ");
    Serial.print(input->dims->data[i]);
  }
  Serial.println("]");
  Serial.print("[HYBRID] Model size: ");
  Serial.print(g_model_data_len);
  Serial.println(" bytes");
#else
  Serial.println("[HYBRID] No TFLite model available");
  tflite_ready = false;
#endif
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(IR_SENSOR_PIN, INPUT_PULLUP);
  digitalWrite(MOTOR_PIN, LOW);
  
  Serial.println("=== Hybrid Bill Classifier Firmware ===");
  Serial.println("Primary: Gemini Vision (server-side)");
  Serial.println("Secondary: TFLite Model (local fallback)");
  
  init_tflite_model();
  
  // Request server-side classification setup
  Serial.println("READY");
}

void handleVendCommand() {
  Serial.println("ACK:VEND");
  digitalWrite(MOTOR_PIN, HIGH);
  delay(300);
  digitalWrite(MOTOR_PIN, LOW);
  Serial.println("[HYBRID] Vend completed");
}

void requestGeminiClassification() {
  // Trigger server-side Gemini classification
  Serial.println("CLASSIFY:GEMINI");
  Serial.println("[HYBRID] Requesting Gemini classification...");
}

bool runTFLiteInference(int& denom, float& confidence) {
  if (!tflite_ready) {
    Serial.println("[HYBRID] TFLite model not ready");
    return false;
  }

  // Simulate image preprocessing (replace with actual camera capture)
  const int input_h = input->dims->data[1];
  const int input_w = input->dims->data[2];
  const int input_c = input->dims->data[3];
  uint8_t* input_buf = input->data.uint8;

  // Generate test pattern (replace with real image preprocessing)
  for (int h = 0; h < input_h; ++h) {
    for (int w = 0; w < input_w; ++w) {
      for (int c = 0; c < input_c; ++c) {
        int idx = (h * input_w + w) * input_c + c;
        // Create a pattern that varies by position (simulating bill features)
        input_buf[idx] = (uint8_t)(((h + w + c * 85) * 255) / (input_h + input_w));
      }
    }
  }

  // Run inference
  unsigned long start_ms = millis();
  TfLiteStatus invoke_status = interpreter->Invoke();
  unsigned long elapsed_ms = millis() - start_ms;

  if (invoke_status != kTfLiteOk) {
    Serial.println("[HYBRID] TFLite inference failed");
    return false;
  }

  // Process output
  int best_idx = -1;
  float best_score = -1.0f;

  if (output->type == kTfLiteUInt8) {
    uint8_t* output_buf = output->data.uint8;
    for (int i = 0; i < CLASSES && i < output->bytes; ++i) {
      float score = output_buf[i] / 255.0f;
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
    Serial.println("[HYBRID] Unsupported TFLite output type");
    return false;
  }

  denom = (best_idx >= 0 && best_idx < CLASSES) ? DENOMS[best_idx] : 0;
  confidence = best_score;

  Serial.print("[HYBRID] TFLite inference took ");
  Serial.print(elapsed_ms);
  Serial.print(" ms - Result: ");
  Serial.print(denom);
  Serial.print(" (conf: ");
  Serial.print(confidence, 3);
  Serial.println(")");

  return true;
}

void processClassificationResult(int denom, float confidence, const String& source) {
  // Emit standardized result
  Serial.print("BILL:");
  Serial.print(denom);
  Serial.print(":");
  Serial.println(confidence, 3);
  
  Serial.print("[HYBRID] Classification from ");
  Serial.print(source);
  Serial.print(": ");
  Serial.print(denom);
  Serial.print(" pesos (confidence: ");
  Serial.print(confidence, 3);
  Serial.println(")");
  
  // Reset failed attempts on success
  failed_gemini_attempts = 0;
}

void handleGeminiResponse(const String& response) {
  // Parse Gemini response: "GEMINI:<denom>:<confidence>"
  int firstColon = response.indexOf(':');
  int secondColon = response.indexOf(':', firstColon + 1);
  
  if (firstColon == -1 || secondColon == -1) {
    Serial.println("[HYBRID] Invalid Gemini response format");
    failed_gemini_attempts++;
    return;
  }
  
  String denomStr = response.substring(firstColon + 1, secondColon);
  String confStr = response.substring(secondColon + 1);
  
  int denom = denomStr.toInt();
  float confidence = confStr.toFloat();
  
  // Check if Gemini confidence is sufficient
  if (confidence < gemini_confidence_threshold) {
    Serial.print("[HYBRID] Gemini confidence too low (");
    Serial.print(confidence, 3);
    Serial.print(" < ");
    Serial.print(gemini_confidence_threshold, 3);
    Serial.println("), falling back to TFLite");
    
    failed_gemini_attempts++;
    runTFLiteFallback();
    return;
  }
  
  processClassificationResult(denom, confidence, "Gemini");
}

void runTFLiteFallback() {
  if (!tflite_ready) {
    Serial.println("[HYBRID] TFLite fallback not available, using default");
    processClassificationResult(100, 0.5f, "Default");
    return;
  }
  
  int denom;
  float confidence;
  
  if (runTFLiteInference(denom, confidence)) {
    processClassificationResult(denom, confidence, "TFLite");
  } else {
    Serial.println("[HYBRID] TFLite inference failed");
    processClassificationResult(100, 0.3f, "Default");
  }
}

void handleSerialCommand(const String& cmd) {
  if (cmd.startsWith("VEND:")) {
    handleVendCommand();
  } else if (cmd.startsWith("GEMINI:")) {
    handleGeminiResponse(cmd);
  } else if (cmd.startsWith("SET_MODE:")) {
    String modeStr = cmd.substring(9);
    if (modeStr == "GEMINI") current_mode = MODE_GEMINI;
    else if (modeStr == "TFLITE") current_mode = MODE_TFLITE;
    else if (modeStr == "HYBRID") current_mode = MODE_HYBRID;
    
    Serial.print("[HYBRID] Mode set to: ");
    Serial.println(modeStr);
  } else if (cmd.startsWith("SET_THRESHOLD:")) {
    String threshStr = cmd.substring(14);
    gemini_confidence_threshold = threshStr.toFloat();
    Serial.print("[HYBRID] Gemini threshold set to: ");
    Serial.println(gemini_confidence_threshold, 3);
  }
}

void checkBillDetection() {
  // Check IR sensor for bill presence
  bool bill_detected = (digitalRead(IR_SENSOR_PIN) == LOW);
  
  if (bill_detected && (millis() - last_inference_time > INFERENCE_INTERVAL)) {
    last_inference_time = millis();
    
    Serial.println("[HYBRID] Bill detected, starting classification...");
    
    switch (current_mode) {
      case MODE_GEMINI:
        requestGeminiClassification();
        break;
        
      case MODE_TFLITE:
        runTFLiteFallback();
        break;
        
      case MODE_HYBRID:
        // Try Gemini first, fallback to TFLite if needed
        if (failed_gemini_attempts < MAX_FAILED_ATTEMPTS) {
          requestGeminiClassification();
        } else {
          Serial.print("[HYBRID] Too many Gemini failures (");
          Serial.print(failed_gemini_attempts);
          Serial.println("), switching to TFLite");
          runTFLiteFallback();
        }
        break;
    }
  }
}

void loop() {
  // Handle incoming commands
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    handleSerialCommand(cmd);
  }
  
  // Check for bill detection
  checkBillDetection();
  
  delay(50);
}
