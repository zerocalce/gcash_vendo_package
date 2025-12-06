# Deployment and Operations Guide

## Prerequisites

- Node.js LTS (>= 18)
- npm (>= 9)
- Windows, macOS, or Linux
- For diagram builds: Headless Chromium (downloaded automatically by mermaid-cli)

## Environment

Create backend/.env from backend/.env.example and set:

- PORT=3000
- XENDIT_SECRET_KEY=...
- XENDIT_CALLBACK_TOKEN=...
- DB_PATH=./data/transactions.db
- SERIAL_PORT=COM3 (or /dev/ttyUSB0)
- SERIAL_BAUD=115200
- SERIAL_AUTOCONNECT=0 (set 1 to auto-connect)

## Install and Run

```bash
# from backend/
npm install
npm start
```

- Static test UI: <http://localhost:3000/>
- Health: <http://localhost:3000/health>

## WebSockets

- WS endpoint: same origin as HTTP server
- Messages: JSON with fields `{ type, data, ts }`
- Event types emitted:
  - `bill.detected` — payload: `{ denomination, confidence, sensorId?, metadata? }`
  - `payment.created` — payload: `{ referenceId, amount, sessionId, charge }`
  - `webhook.status` — payload: `{ referenceId, status }`
  - `vend.ack` — payload: `{}`

## Serial Port

- Configure `SERIAL_PORT` and `SERIAL_BAUD` in .env
- Enable `SERIAL_AUTOCONNECT=1` to auto-open on server start
- Protocol (line-delimited):
  - From device: `BILL:<denomination>:<confidence>`
  - To device: `VEND:1`
  - Device ack: `ACK:VEND`

## Tests

Use in-memory DB for fast runs.

```bash
# from backend/
npm test
```
- Suites:
  - API: health, bills, payments (Xendit mocked)
  - Webhook: token validation and status updates
  - DB: integrity CRUD checks

## Diagrams

Build PNG/SVG from Mermaid sources in `/docs`:

```bash
# from backend/
npm run docs:build
```
- Outputs:
  - `docs/sequence.{png,svg}` from `docs/sequence.mmd`
  - `docs/wiring.{png,svg}` from `docs/wiring.mmd`

## Firmware (ESP32)

- Sketch: `firmware/firmware.ino`
- Includes TensorFlow Lite Micro hooks
- Optional model embedding: convert `model.tflite` to C array via `xxd -i` and include as `model_data.h`
- Without `model_data.h`: runs in fallback mode emitting simulated detections

## AI Notebook

- `ai/train_cnn.ipynb` contains:
  - Data pipeline (image_dataset_from_directory)
  - Model build/compile/train
  - Quantization options and TFLite conversion
  - TFLite verification (Interpreter)

## Production Hardening Checklist

- Configure CORS allowlist
- Set strong `XENDIT_CALLBACK_TOKEN` and validate per Xendit signature docs for production
- Rotate secrets and use a secrets manager in deployment
- Run behind a reverse proxy (Nginx/Caddy) with TLS
- Enable process supervision (PM2/systemd) and log rotation
