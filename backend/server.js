/**
 * GCash Vendo Machine - Backend Skeleton
 * - Express server
 * - Serial bridge placeholder (talks to Arduino)
 * - Xendit integration points (requires env keys)
 *
 * NOTE: Replace placeholders and secure secrets before production.
 */
require('dotenv').config();
const http = require('http');
const { WebSocketServer } = require('ws');
const app = require('./src/app');
const bus = require('./src/utils/bus');
const serial = require('./src/utils/serial');
const camera = require('./src/utils/camera');
const { classifyBill } = require('./src/utils/gemini');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

function wsBroadcast(type, data) {
  const msg = JSON.stringify({ type, data, ts: Date.now() });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}

async function maybeClassifyFromCamera() {
  try {
    const { buffer, mimeType } = await camera.snapshot();
    const result = await classifyBill(buffer, mimeType);
    const confMin = parseFloat(process.env.GEMINI_CONF_MIN || '0.85');
    const genMin = parseFloat(process.env.GEMINI_GENUINE_MIN || '0.80');
    if (
      result &&
      result.denomination &&
      typeof result.confidence === 'number' &&
      typeof result.is_genuine === 'number' &&
      result.confidence >= confMin &&
      result.is_genuine >= genMin
    ) {
      bus.emit('bill.detected', { denomination: result.denomination, confidence: result.confidence });
      wsBroadcast('vision.result', { ok: true, accepted: true, result });
    } else {
      wsBroadcast('vision.result', { ok: true, accepted: false, result });
    }
  } catch (e) {
    console.error('vision classify error', e);
    wsBroadcast('vision.result', { ok: false, error: e.message });
  }
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'welcome', data: { message: 'connected' }, ts: Date.now() }));
});

// Bridge bus events to WS
bus.on('bill.detected', (payload) => wsBroadcast('bill.detected', payload));
bus.on('payment.created', (payload) => wsBroadcast('payment.created', payload));
bus.on('webhook.status', (payload) => {
  wsBroadcast('webhook.status', payload);
  try {
    const st = (payload && payload.status) || '';
    if (st === 'SUCCEEDED' || st === 'COMPLETED' || st === 'PAID') {
      serial.send('VEND:1').catch((e) => console.error('vend send error', e));
    }
  } catch (_) { /* ignore */ }
});
bus.on('serial.status', (payload) => wsBroadcast('serial.status', payload));

// Serial wiring
serial.setHandlers({
  onOpen: () => {
    console.log('Serial open');
    bus.emit('serial.status', { connected: true, port: serial.options.path });
  },
  onClose: () => {
    console.log('Serial closed');
    bus.emit('serial.status', { connected: false, port: serial.options.path });
  },
  onData: (line) => {
    try {
      const s = String(line).trim();
      if (s.startsWith('BILL:')) {
        const [, denom, conf] = s.split(':');
        const denomination = parseInt(denom, 10);
        const confidence = parseFloat(conf);
        if (!Number.isNaN(denomination)) {
          bus.emit('bill.detected', { denomination, confidence });
        }
      } else if (s.startsWith('IR:')) {
        // IR beam broken or sensor trigger -> capture + classify via Gemini
        maybeClassifyFromCamera();
      } else if (s.startsWith('ACK:VEND')) {
        wsBroadcast('vend.ack', {});
      }
    } catch (e) {
      console.error('serial parse error', e);
    }
  },
  onError: (err) => {
    console.error('serial error', err);
    bus.emit('serial.status', { connected: false, port: serial.options.path, error: err.message });
  },
  onReconnect: () => {
    console.log('serial reconnecting...');
    bus.emit('serial.status', { connected: false, port: serial.options.path, reconnecting: true });
  }
});

// Auto-connect serial if env present
if (process.env.SERIAL_AUTOCONNECT === '1') {
  serial.connect().catch((e) => console.error('serial connect failed', e));
}

server.listen(PORT, () => {
  console.log(`Backend started on port ${PORT}`);
});
