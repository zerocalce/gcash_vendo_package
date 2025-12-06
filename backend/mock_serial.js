const net = require('net');

// Create a simple TCP server to mock the serial device
const server = net.createServer((socket) => {
  console.log('Mock serial device connected');
  
  // Send some mock data periodically to simulate device responses
  let counter = 0;
  const interval = setInterval(() => {
    const mockData = {
      type: 'sensor',
      value: Math.random() * 100,
      timestamp: Date.now(),
      counter: counter++
    };
    socket.write(JSON.stringify(mockData) + '\n');
  }, 2000);

  socket.on('data', (data) => {
    console.log('Received from client:', data.toString());
    // Echo back or send response
    const response = {
      type: 'response',
      status: 'ok',
      received: data.toString().trim()
    };
    socket.write(JSON.stringify(response) + '\n');
  });

  socket.on('end', () => {
    console.log('Mock serial device disconnected');
    clearInterval(interval);
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
    clearInterval(interval);
  });
});

server.listen(9999, 'localhost', () => {
  console.log('Mock serial server listening on localhost:9999');
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
});
