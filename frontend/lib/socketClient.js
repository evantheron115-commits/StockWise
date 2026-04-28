// Singleton Socket.io client — shared across all hooks so only one connection
// is ever open per browser tab, regardless of how many components subscribe.

let _socket   = null;
let _refCount = 0;

export function getSocket() {
  if (typeof window === 'undefined') return null;
  if (_socket) { _refCount++; return _socket; }

  const { io } = require('socket.io-client');
  _socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', {
    transports:           ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay:    2000,
    autoConnect:          true,
  });
  _refCount = 1;
  return _socket;
}

export function releaseSocket() {
  _refCount = Math.max(0, _refCount - 1);
  if (_refCount === 0 && _socket) {
    _socket.disconnect();
    _socket = null;
  }
}
