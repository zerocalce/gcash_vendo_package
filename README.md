# GCash Vendo Machine — Integrated Package (Prototype)

**Contents**
- Node.js backend (skeleton, documented)
- Arduino firmware (ESP32-compatible sketch with TFLite Micro hooks)
- AI training notebook (Keras CNN skeleton)
- Frontend integration snippets for GCash-vendo UI
- Xendit webhook validation example
- Database schema (SQL)
- Documentation: sequence diagrams (Mermaid), flowcharts, wiring diagram (ASCII)
- .env.example and deployment notes

**Security & Safety**
- This package is a prototype skeleton. It intentionally omits sensitive keys, real model binaries, and any instructions that could facilitate counterfeiting.
- Replace all placeholder values in `.env.example` with your production credentials and secure them.

**How to use**
1. Inspect files under `/src` for backend.
2. Fill `.env` from `.env.example`.
3. Install backend dependencies: `npm install`
4. Start backend: `npm start`
5. Use the Arduino sketch in `/firmware/firmware.ino` adapted to your board.
6. Train model using `ai/train_cnn.ipynb`. Export to TFLite and add to firmware.

