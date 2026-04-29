// Singleton Socket.io client — shared across all hooks so only one connection
// is ever open per browser tab, regardless of how many components subscribe.
//
// Disconnect is debounced 300ms so ticker-change navigations (where both hook
// cleanups fire before new effects run) don't momentarily drop the socket.

let _socket          = null;
let _refCount        = 0;
let _disconnectTimer = null;

export function getSocket() {
  if (typeof window === 'undefined') return null;

  // Cancel any pending disconnect — a new subscriber arrived in time
  if (_disconnectTimer) { clearTimeout(_disconnectTimer); _disconnectTimer = null; }

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
  if (_refCount === 0) {
    // Debounce: give new subscribers 300ms to re-acquire before disconnecting.
    // Prevents the socket from dropping during ticker-change navigations where
    // both hook cleanups run before both new effects run.
    _disconnectTimer = setTimeout(() => {
      _disconnectTimer = null;
      if (_refCount === 0 && _socket) {
        _socket.disconnect();
        _socket = null;
      }
    }, 300);
  }
}
