'use strict';
const SerialPort = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const bus = require('./bus');
const axios = require('axios');

let port = null;
let parser = null;

// Hybrid classification state
const hybridState = {
  mode: 'hybrid',
  geminiThreshold: 0.7,
  failedAttempts: 0,
  maxFailures: 3,
  lastClassification: null
};

function init() {
  const portPath = process.env.SERIAL_PORT;
  const baudRate = parseInt(process.env.SERIAL_BAUD) || 115200;
  const autoconnect = process.env.SERIAL_AUTOCONNECT === '1';

  if (!portPath || !autoconnect) {
    console.log('[SERIAL-HYBRID] Serial disabled (no port or autoconnect=0)');
    return;
  }

  try {
    port = new SerialPort({
      path: portPath,
      baudRate: baudRate,
      autoOpen: false
    });

    parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    port.open((err) => {
      if (err) {
        console.error('[SERIAL-HYBRID] Failed to open port:', err.message);
        return;
      }
      console.log(`[SERIAL-HYBRID] Connected to ${portPath} at ${baudRate}`);
    });

    parser.on('data', handleSerialData);

    port.on('error', (err) => {
      console.error('[SERIAL-HYBRID] Port error:', err.message);
    });

    port.on('close', () => {
      console.log('[SERIAL-HYBRID] Port closed');
    });

  } catch (err) {
    console.error('[SERIAL-HYBRID] Init error:', err.message);
  }
}

async function handleSerialData(data) {
  const line = data.toString().trim();
  if (!line) return;

  console.log('[SERIAL-HYBRID] Received:', line);

  // Handle different message types
  if (line.startsWith('BILL:')) {
    handleBillMessage(line);
  } else if (line.startsWith('CLASSIFY:GEMINI')) {
    await handleGeminiRequest();
  } else if (line.startsWith('SET_MODE:')) {
    handleModeCommand(line);
  } else if (line.startsWith('SET_THRESHOLD:')) {
    handleThresholdCommand(line);
  } else if (line.startsWith('ACK:')) {
    handleAckMessage(line);
  } else if (line === 'READY') {
    console.log('[SERIAL-HYBRID] Firmware ready');
  }
}

function handleBillMessage(line) {
  // Parse: BILL:<denom>:<confidence>
  const parts = line.split(':');
  if (parts.length >= 3) {
    const denom = parseInt(parts[1]);
    const confidence = parseFloat(parts[2]);

    if (!isNaN(denom) && !isNaN(confidence)) {
      // Emit bill detected event
      bus.emit('bill.detected', { denomination: denom, confidence });
      
      // Store last classification
      hybridState.lastClassification = {
        denomination,
        confidence,
        timestamp: Date.now(),
        source: 'firmware'
      };

      console.log(`[SERIAL-HYBRID] Bill detected: ${denom} (conf: ${confidence.toFixed(3)})`);
    }
  }
}

async function handleGeminiRequest() {
  try {
    console.log('[SERIAL-HYBRID] Processing Gemini classification request...');
    
    // Call hybrid classification endpoint
    const response = await axios.post('http://localhost:3000/api/hybrid/classify', {
      emit: true
    }, {
      timeout: 10000
    });

    const result = response.data.result;
    
    // Send result back to firmware
    const geminiResponse = `GEMINI:${result.denomination}:${result.confidence}`;
    port.write(geminiResponse + '\n');
    
    console.log(`[SERIAL-HYBRID] Gemini result sent: ${geminiResponse}`);

  } catch (error) {
    console.error('[SERIAL-HYBRID] Gemini request failed:', error.message);
    
    // Send failure response
    port.write('GEMINI:0:0\n');
  }
}

function handleModeCommand(line) {
  const mode = line.substring(9);
  if (['gemini', 'tflite', 'hybrid'].includes(mode)) {
    hybridState.mode = mode;
    hybridState.failedAttempts = 0;
    console.log(`[SERIAL-HYBRID] Mode changed to: ${mode}`);
  }
}

function handleThresholdCommand(line) {
  const threshold = parseFloat(line.substring(14));
  if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
    hybridState.geminiThreshold = threshold;
    console.log(`[SERIAL-HYBRID] Gemini threshold set to: ${threshold}`);
  }
}

function handleAckMessage(line) {
  const command = line.substring(4);
  console.log(`[SERIAL-HYBRID] ACK received for: ${command}`);
}

function sendCommand(cmd) {
  if (port && port.isOpen) {
    port.write(cmd + '\n');
    console.log('[SERIAL-HYBRID] Sent:', cmd);
    return true;
  } else {
    console.log('[SERIAL-HYBRID] Port not available for command:', cmd);
    return false;
  }
}

function vend() {
  return sendCommand('VEND:1');
}

function setMode(mode) {
  if (['gemini', 'tflite', 'hybrid'].includes(mode)) {
    return sendCommand(`SET_MODE:${mode}`);
  }
  return false;
}

function setThreshold(threshold) {
  if (typeof threshold === 'number' && threshold >= 0 && threshold <= 1) {
    return sendCommand(`SET_THRESHOLD:${threshold}`);
  }
  return false;
}

function getState() {
  return {
    ...hybridState,
    connected: port && port.isOpen
  };
}

// Initialize on module load
if (process.env.SERIAL_AUTOCONNECT === '1') {
  init();
}

module.exports = {
  init,
  sendCommand,
  vend,
  setMode,
  setThreshold,
  getState
};
