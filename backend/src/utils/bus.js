'use strict';
const EventEmitter = require('events');

// Central event bus for backend subsystems (controllers, serial, ws)
class Bus extends EventEmitter {}

module.exports = new Bus();
