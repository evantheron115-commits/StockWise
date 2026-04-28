import { useState, useEffect, useRef } from 'react';

// Singleton socket — shared across all hook instances so we don't open
// multiple connections when multiple components subscribe simultaneously.
let _socket   = null;
let _refCount = 0;

function getSocket() {
  if (typeof window === 'undefined') return null; // SSR guard
  if (_socket) { _refCount++; return _socket; }

  // Dynamic import keeps socket.io-client out of the SSR bundle
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

function releaseSocket() {
  _refCount = Math.max(0, _refCount - 1);
  if (_refCount === 0 && _socket) {
    _socket.disconnect();
    _socket = null;
  }
}

// Returns live price data pushed from the backend via Socket.io.
// Falls back gracefully if the WebSocket connection is unavailable —
// components should still show the last HTTP-fetched price from props.
export function useRealTimePrice(ticker) {
  const [price,         setPrice]         = useState(null);
  const [change,        setChange]        = useState(null);
  const [changePercent, setChangePercent] = useState(null);
  const [connected,     setConnected]     = useState(false);
  const tickerRef = useRef(ticker);

  useEffect(() => {
    tickerRef.current = ticker;
  }, [ticker]);

  useEffect(() => {
    if (!ticker || typeof window === 'undefined') return;
    const t    = ticker.toUpperCase();
    const sock = getSocket();
    if (!sock) return;

    function subscribe() {
      sock.emit('subscribe', t);
      setConnected(true);
    }

    function onPriceUpdate(data) {
      if (data.ticker !== tickerRef.current?.toUpperCase()) return;
      if (data.price         != null) setPrice(data.price);
      if (data.change        != null) setChange(data.change);
      if (data.changePercent != null) setChangePercent(data.changePercent);
    }

    function onConnect()    { subscribe(); }
    function onDisconnect() { setConnected(false); }

    sock.on('price:update', onPriceUpdate);
    sock.on('connect',      onConnect);
    sock.on('disconnect',   onDisconnect);

    // Subscribe immediately if already connected
    if (sock.connected) subscribe();

    return () => {
      sock.emit('unsubscribe', t);
      sock.off('price:update', onPriceUpdate);
      sock.off('connect',      onConnect);
      sock.off('disconnect',   onDisconnect);
      releaseSocket();
    };
  }, [ticker]);

  return { price, change, changePercent, connected };
}
