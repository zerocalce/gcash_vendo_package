const request = require('supertest');

// Ensure in-memory DB for tests before modules are loaded
process.env.DB_PATH = ':memory:';

// Mock Xendit service to avoid external calls
jest.mock('../src/services/xendit.service', () => ({
  createGCashCharge: jest.fn().mockResolvedValue({ data: { id: 'ewc_123', status: 'PENDING' } })
}));

const app = require('../src/app');
const db = require('../src/models/transactions.model');

describe('API endpoints', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('POST /api/bills/detected inserts banknote log', async () => {
    const before = await db.getBanknoteLogsCount();
    const res = await request(app)
      .post('/api/bills/detected')
      .send({ denomination: 100, confidence: 0.97, sensorId: 'S1', metadata: { test: true } });
    expect(res.status).toBe(200);
    const after = await db.getBanknoteLogsCount();
    expect(after).toBe(before + 1);
  });

  test('POST /api/payments/create creates charge (mocked)', async () => {
    const res = await request(app)
      .post('/api/payments/create')
      .send({ amount: 100, sessionId: 'S1', mobileNumber: '' });
    expect(res.status).toBe(200);
    expect(res.body.referenceId).toMatch(/^CASHIN_/);
    expect(res.body.charge).toBeTruthy();
  });

  test('POST /api/payments/create validates amount', async () => {
    const res = await request(app)
      .post('/api/payments/create')
      .send({ amount: 0, sessionId: 'S1' });
    expect(res.status).toBe(400);
  });
});
