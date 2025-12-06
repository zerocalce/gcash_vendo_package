const request = require('supertest');

// In-memory DB for tests and set callback token before loading app
process.env.DB_PATH = ':memory:';
process.env.XENDIT_CALLBACK_TOKEN = 'test_token';

const app = require('../src/app');
const db = require('../src/models/transactions.model');

describe('Webhook validation', () => {
  test('rejects missing token', async () => {
    const res = await request(app)
      .post('/api/webhook/xendit')
      .send({ data: { reference_id: 'CASHIN_1', status: 'SUCCEEDED' } });
    expect(res.status).toBe(401);
  });

  test('accepts valid token and updates status', async () => {
    const id = 'CASHIN_' + Date.now();
    await db.createTransaction({ id, amount: 100, sessionId: 'S', status: 'PENDING' });

    const res = await request(app)
      .post('/api/webhook/xendit')
      .set('x-callback-token', 'test_token')
      .send({ data: { reference_id: id, status: 'SUCCEEDED' } });

    expect(res.status).toBe(200);
    const row = await db.getTransactionById(id);
    expect(row.status).toBe('PAID');
  });
});
