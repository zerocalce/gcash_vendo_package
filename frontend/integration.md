# Frontend Integration Snippets

## Create payment (fetch)
```js
async function createPayment(amount, sessionId, mobileNumber){
  const res = await fetch('/api/payments/create', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ amount, sessionId, mobileNumber })
  });
  return res.json();
}
```

## Handle webhook update via WebSocket (simple)
- Backend should emit websocket event `payment_confirmed` when receiving Xendit webhook.
- Frontend listens and updates UI to call Arduino via backend to `VEND`.

```
socket.on('payment_confirmed', (data) => {
  // show success UI
  fetch('/api/hardware/command', { method: 'POST', body: JSON.stringify({ cmd: 'VEND:1', ref: data.referenceId }) });
});
```
