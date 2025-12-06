/**
 * serial.js
 * Serial comms with Arduino or TCP simulator
 */
 'use strict';
 const { SerialPort } = require('serialport');
 const { ReadlineParser } = require('@serialport/parser-readline');
 const net = require('net');
 
 /**
  * SerialManager
  * Lightweight wrapper around serialport with:
  * - Basic connection setup
  * - Data handlers (line-delimited)
  * - Error handling and auto-reconnect
  * - Utilities: listPorts, send, disconnect, isConnected, setHandlers
  */
 const DEFAULTS = {
   path: process.env.SERIAL_PORT || 'COM3',
   baudRate: parseInt(process.env.SERIAL_BAUD || '115200', 10),
   autoReconnect: true,
   reconnectInterval: 3000,
   delimiter: '\n'
 };
 
 class SerialManager {
   constructor() {
     this.port = null;
     this.parser = null;
     this.socket = null;
     this.handlers = { onOpen: null, onClose: null, onError: null, onData: null, onReconnect: null };
     this.options = { ...DEFAULTS };
     this._reconnectTimer = null;
     this._isClosing = false;
     this._isTCP = false;
   }
 
   /**
    * List available serial ports
    * @returns {Promise<Array>} ports
    */
   async listPorts() {
     return SerialPort.list();
   }
 
   /**
    * Register event handlers
    * @param {{onOpen?:Function,onClose?:Function,onError?:Function,onData?:Function,onReconnect?:Function}} handlers
    */
   setHandlers(handlers = {}) {
     this.handlers = { ...this.handlers, ...handlers };
   }
 
   /**
    * Check if the port is currently open
    */
   isConnected() {
     if (this._isTCP) {
       return !!(this.socket && !this.socket.destroyed);
     }
     return !!(this.port && this.port.isOpen);
   }
 
   /**
    * Open the serial port
    * @param {{path?:string, baudRate?:number, autoReconnect?:boolean, reconnectInterval?:number, delimiter?:string}} options
    */
   connect(options = {}) {
     this.options = { ...DEFAULTS, ...options };
     const { path, baudRate, delimiter } = this.options;
     
     // Check if this is a TCP connection
     if (path.startsWith('tcp://')) {
       return this._connectTCP(path, delimiter);
     }
     
     // Serial connection
     return new Promise((resolve, reject) => {
       try {
         this._isTCP = false;
         this.port = new SerialPort({ path, baudRate, autoOpen: true });
         this.parser = this.port.pipe(new ReadlineParser({ delimiter }));

         this.port.on('open', () => {
           this._isClosing = false;
           if (typeof this.handlers.onOpen === 'function') this.handlers.onOpen();
           resolve();
         });

         this.parser.on('data', (line) => {
           if (typeof this.handlers.onData === 'function') {
             try { this.handlers.onData(line); } catch (err) { /* ignore handler errors */ }
           }
         });

         this.port.on('error', (err) => {
           if (typeof this.handlers.onError === 'function') this.handlers.onError(err);
         });

         this.port.on('close', () => {
           if (typeof this.handlers.onClose === 'function') this.handlers.onClose();
           if (!this._isClosing && this.options.autoReconnect) {
             if (typeof this.handlers.onReconnect === 'function') this.handlers.onReconnect();
             this._scheduleReconnect();
           }
         });
       } catch (e) {
         reject(e);
       }
     });
   }

   _connectTCP(tcpPath, delimiter) {
     return new Promise((resolve, reject) => {
       try {
         this._isTCP = true;
         const url = new URL(tcpPath);
         const host = url.hostname;
         const port = parseInt(url.port, 10);
         
         this.socket = new net.Socket();
         let buffer = '';

         this.socket.connect(port, host, () => {
           this._isClosing = false;
           if (typeof this.handlers.onOpen === 'function') this.handlers.onOpen();
           resolve();
         });

         this.socket.on('data', (data) => {
           buffer += data.toString();
           const lines = buffer.split(delimiter);
           buffer = lines.pop(); // Keep incomplete line in buffer
           
           lines.forEach(line => {
             if (line.trim() && typeof this.handlers.onData === 'function') {
               try { this.handlers.onData(line); } catch (err) { /* ignore handler errors */ }
             }
           });
         });

         this.socket.on('error', (err) => {
           if (typeof this.handlers.onError === 'function') this.handlers.onError(err);
         });

         this.socket.on('close', () => {
           if (typeof this.handlers.onClose === 'function') this.handlers.onClose();
           if (!this._isClosing && this.options.autoReconnect) {
             if (typeof this.handlers.onReconnect === 'function') this.handlers.onReconnect();
             this._scheduleReconnect();
           }
         });
       } catch (e) {
         reject(e);
       }
     });
   }
 
   _scheduleReconnect() {
     clearTimeout(this._reconnectTimer);
     this._reconnectTimer = setTimeout(() => {
       this.connect(this.options).catch(() => this._scheduleReconnect());
     }, this.options.reconnectInterval);
   }
 
   /**
    * Send a line (appends delimiter if missing)
    * @param {string} line
    */
   send(line) {
     return new Promise((resolve, reject) => {
       if (!this.isConnected()) return reject(new Error('Serial port is not open'));
       const payload = String(line).endsWith(this.options.delimiter) ? String(line) : String(line) + this.options.delimiter;
       
       if (this._isTCP && this.socket) {
         this.socket.write(payload, (err) => {
           if (err) return reject(err);
           resolve();
         });
       } else if (this.port) {
         this.port.write(payload, (err) => {
           if (err) return reject(err);
           this.port.drain((err2) => err2 ? reject(err2) : resolve());
         });
       } else {
         reject(new Error('No connection available'));
       }
     });
   }
 
   /**
    * Close the port
    */
   async disconnect() {
     this._isClosing = true;
     clearTimeout(this._reconnectTimer);
     
     if (this._isTCP && this.socket) {
       if (!this.socket.destroyed) {
         await new Promise((resolve) => this.socket.destroy(() => resolve()));
       }
       this.socket = null;
     } else if (this.port) {
       if (!this.port.isOpen) return;
       await new Promise((resolve) => this.port.close(() => resolve()));
       this.port = null;
       this.parser = null;
     }
   }
 }
 
 module.exports = new SerialManager();
