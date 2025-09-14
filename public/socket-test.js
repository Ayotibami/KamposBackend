let socket = null;
const logEl = document.getElementById('log');
const log = (...args) => { logEl.textContent += args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') + "\n"; logEl.scrollTop = logEl.scrollHeight; };

document.getElementById('connect').onclick = () => {
  if (socket && socket.connected) return;
  const url = document.getElementById('server').value.trim();
  const jwt = document.getElementById('jwt').value.trim();
  socket = io(url, {
    path: '/socket.io',
    // Let Socket.IO negotiate (polling then upgrade) for better compatibility
    // transports: ['websocket'],
    extraHeaders: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
    auth: jwt ? { token: jwt } : undefined,
    query: jwt ? { token: jwt } : undefined,
  });
  socket.on('connect', () => log('connected', { id: socket.id, transport: socket.io.engine.transport.name }));
  socket.io.on('upgrade', () => log('upgraded', { transport: socket.io.engine.transport.name }));
  socket.io.on('reconnect_attempt', (n) => log('reconnect_attempt', n));
  socket.io.on('reconnect', (n) => log('reconnect', n));
  socket.on('disconnect', (reason) => log('disconnected', reason));
  socket.on('connect_error', (err) => log('connect_error', err.message));
  socket.on('broadcast', (msg) => log('broadcast', msg));
  socket.on('broadcast_all', (msg) => log('broadcast_all', msg));
};

document.getElementById('disconnect').onclick = () => {
  if (socket) socket.disconnect();
};

document.getElementById('subscribe').onclick = () => {
  if (!socket || !socket.connected) return log('not connected');
  const topic = document.getElementById('topic').value.trim();
  socket.emit('subscribe', { topic });
  log('subscribed', topic);
};

document.getElementById('unsubscribe').onclick = () => {
  if (!socket || !socket.connected) return log('not connected');
  const topic = document.getElementById('topic').value.trim();
  socket.emit('unsubscribe', { topic });
  log('unsubscribed', topic);
};
