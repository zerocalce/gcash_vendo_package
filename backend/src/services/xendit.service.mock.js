/**
 * xendit.service.mock.js
 * Mock Xendit service for testing without real API calls
 */
const bus = require('../utils/bus');

async function createGCashCharge(referenceId, amount, mobileNumber) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock successful response
  const charge = {
    data: {
      id: 'mock_charge_' + Date.now(),
      reference_id: referenceId,
      status: 'PENDING',
      amount: amount,
      currency: 'PHP',
      checkout_url: 'https://mock-checkout.xendit.co/' + referenceId,
      created: new Date().toISOString()
    }
  };

  // Simulate payment completion after 2 seconds
  setTimeout(() => {
    try {
      bus.emit('webhook.status', { 
        status: 'SUCCEEDED', 
        reference_id: referenceId,
        amount: amount 
      });
    } catch (e) {
      console.error('Mock webhook error:', e);
    }
  }, 2000);

  return charge;
}

module.exports = { createGCashCharge };
