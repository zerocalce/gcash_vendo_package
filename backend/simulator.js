/**
 * Arduino Simulator - Sends BILL messages for testing
 * Run this to simulate Arduino hardware sending serial data
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const net = require('net');

// Create a virtual serial port server
class ArduinoSimulator {
  constructor() {
    this.clients = [];
    this.interval = null;
    this.server = null;
  }

  start(port = 9999) {
    // Create a TCP server that acts like a serial port
    this.server = net.createServer((socket) => {
      console.log('Arduino simulator connected');
      
      // Send initial message
      socket.write('Firmware (Uno) started\r\n');
      
      // Send BILL messages every 30 seconds
      this.interval = setInterval(() => {
        const denom = 100;
        const conf = 0.90;
        const message = `BILL:${denom}:${conf.toFixed(3)}\r\n`;
        socket.write(message);
        console.log(`Sent: ${message.trim()}`);
      }, 30000);

      // Handle commands from backend
      socket.on('data', (data) => {
        const command = data.toString().trim();
        console.log(`Received: ${command}`);
        
        if (command.startsWith('VEND:')) {
          // Simulate vend response
          setTimeout(() => {
            socket.write('ACK:VEND\r\n');
            console.log('Sent: ACK:VEND');
          }, 100);
        }
      });

      socket.on('close', () => {
        console.log('Arduino simulator disconnected');
        if (this.interval) {
          clearInterval(this.interval);
          this.interval = null;
        }
      });

      socket.on('error', (err) => {
        console.error('Simulator error:', err);
      });
    });

    this.server.listen(port, () => {
      console.log(`Arduino simulator listening on port ${port}`);
      console.log('Update your .env file to use SERIAL_PORT=tcp://localhost:' + port);
    });
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

// Start simulator if run directly
if (require.main === module) {
  const simulator = new ArduinoSimulator();
  simulator.start(9999);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down simulator...');
    simulator.stop();
    process.exit(0);
  });
}

module.exports = ArduinoSimulator;
