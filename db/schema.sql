-- SQLite schema for transactions and logs

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  amount INTEGER NOT NULL,
  sessionId TEXT,
  status TEXT NOT NULL,
  provider TEXT,
  createdAt INTEGER,
  updatedAt INTEGER
);

CREATE TABLE banknote_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  denomination INTEGER,
  confidence REAL,
  sensorId TEXT,
  metadata TEXT,
  createdAt INTEGER
);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transactionId TEXT,
  eventType TEXT,
  payload TEXT,
  createdAt INTEGER
);
