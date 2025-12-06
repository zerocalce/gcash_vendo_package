/**
 * transactions.model.js
 * Lightweight SQLite helper for prototype.
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Allow overriding DB location for production/tests
// Use ':memory:' for ephemeral DB in tests
const DEFAULT_PATH = path.join(__dirname, '../../data/transactions.db');
const DB_PATH = process.env.DB_PATH || DEFAULT_PATH;
const isMemory = DB_PATH === ':memory:';

if (!isMemory) {
  const dir = path.dirname(DB_PATH);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) { /* ignore */ }
}

const db = new sqlite3.Database(DB_PATH);

// Create tables if not exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    amount INTEGER,
    sessionId TEXT,
    status TEXT,
    provider TEXT,
    createdAt INTEGER,
    updatedAt INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS banknote_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    denomination INTEGER,
    confidence REAL,
    sensorId TEXT,
    metadata TEXT,
    createdAt INTEGER
  )`);
});

function createTransaction(tx) {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO transactions (id, amount, sessionId, status, provider, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?,?)`, [tx.id, tx.amount, tx.sessionId || '', tx.status || 'PENDING', tx.provider || 'XENDIT', now, now],
      function(err){
        if(err) return reject(err);
        resolve();
      });
  });
}

function updateTransactionStatus(id, status) {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    db.run(`UPDATE transactions SET status=?, updatedAt=? WHERE id=?`, [status, now, id], function(err){
      if(err) return reject(err);
      resolve();
    });
  });
}

function insertBanknoteLog(rec) {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO banknote_logs (denomination, confidence, sensorId, metadata, createdAt)
      VALUES (?,?,?,?,?)`, [rec.denomination, rec.confidence, rec.sensorId || '', JSON.stringify(rec.metadata||{}), now],
      function(err){
        if(err) return reject(err);
        resolve();
      });
  });
}

function getTransactionById(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM transactions WHERE id=?`, [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function getBanknoteLogsCount() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) AS cnt FROM banknote_logs`, [], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.cnt : 0);
    });
  });
}

module.exports = { createTransaction, updateTransactionStatus, insertBanknoteLog, getTransactionById, getBanknoteLogsCount };
