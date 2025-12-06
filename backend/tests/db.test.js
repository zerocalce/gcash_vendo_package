const db = require('../src/models/transactions.model');

describe('DB integrity', () => {
  test('create and fetch transaction', async () => {
    const id = 'T_' + Date.now();
    await db.createTransaction({ id, amount: 123, sessionId: 'S', status: 'PENDING' });
    const row = await db.getTransactionById(id);
    expect(row).toBeTruthy();
    expect(row.id).toBe(id);
    expect(row.amount).toBe(123);
    expect(row.status).toBe('PENDING');
  });

  test('update transaction status', async () => {
    const id = 'T_' + (Date.now() + 1);
    await db.createTransaction({ id, amount: 50, sessionId: '', status: 'PENDING' });
    await db.updateTransactionStatus(id, 'PAID');
    const row = await db.getTransactionById(id);
    expect(row.status).toBe('PAID');
  });

  test('insert banknote log increments count', async () => {
    const before = await db.getBanknoteLogsCount();
    await db.insertBanknoteLog({ denomination: 100, confidence: 0.95, sensorId: 'S', metadata: { t: 'test' } });
    const after = await db.getBanknoteLogsCount();
    expect(after).toBe(before + 1);
  });
});
