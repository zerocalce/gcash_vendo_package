/*
  firmware_uno.ino
  Minimal firmware for AVR/Arduino boards (no TFLite).
  Sends simulated BILL messages over serial for testing.
*/

#define SERIAL_BAUD 115200
#define MOTOR_PIN 2

void setup() {
  Serial.begin(SERIAL_BAUD);
  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);
  Serial.println("Firmware (Uno) started");
}

void handleVendCommand() {
  Serial.println("ACK:VEND");
  digitalWrite(MOTOR_PIN, HIGH);
  delay(300);
  digitalWrite(MOTOR_PIN, LOW);
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

  // Simulate bill detection every 30 seconds
  static unsigned long last = 0;
  if (millis() - last > 30000) {
    last = millis();
    int denom = 100;
    float conf = 0.90;
    Serial.print("BILL:"); Serial.print(denom); Serial.print(":"); Serial.println(conf, 3);
  }

  delay(50);
}
