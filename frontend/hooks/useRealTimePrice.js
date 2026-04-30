import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket, releaseSocket } from '../lib/socketClient';
import { triggerMarketHaptic } from '../lib/haptics';

const POLL_INTERVAL_MS = 30 * 1000; // HTTP fallback polls every 30s when socket is down

// Returns live price data from Socket.io with automatic HTTP polling fallback.
//
// isLive === true  → socket is connected, price updates arrive in real time (~20s)
// isLive === false → socket disconnected, polling HTTP every 30s until reconnect
//
// Use the `isLive` boolean to show/hide the bioluminescent green dot in the UI.
export function useRealTimePrice(ticker) {
  const [price,         setPrice]         = useState(null);
  const [change,        setChange]        = useState(null);
  const [changePercent, setChangePercent] = useState(null);
  const [isLive,        setIsLive]        = useState(false);

  const tickerRef  = useRef(ticker);
  const pollRef    = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => { tickerRef.current = ticker; }, [ticker]);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // HTTP fallback — polls the backend quote endpoint when socket is offline
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const t = tickerRef.current;
      if (!t || !mountedRef.current) return;
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const res  = await fetch(`${API}/api/company/${t.toUpperCase()}`);
        if (!res.ok) return;
        const json = await res.json();
        const c    = json?.data;
        if (!mountedRef.current) return;
        if (c?.price         != null) setPrice(c.price);
        if (c?.change        != null) setChange(c.change);
        if (c?.changePercent != null) setChangePercent(c.changePercent);
      } catch { /* network down — next poll will retry */ }
    }, POLL_INTERVAL_MS);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => {
    if (!ticker || typeof window === 'undefined') return;
    const t    = ticker.toUpperCase();
    const sock = getSocket();
    if (!sock) return;

    function subscribe() {
      sock.emit('subscribe', t);
      setIsLive(true);
      stopPolling(); // socket is up — silence the HTTP fallback
    }

    function onPriceUpdate(data) {
      if (data.ticker !== tickerRef.current?.toUpperCase()) return;
      if (data.price         != null) setPrice(data.price);
      if (data.change        != null) setChange(data.change);
      if (data.changePercent != null) {
        setChangePercent(data.changePercent);
        triggerMarketHaptic(data.changePercent);
      }
    }

    function onConnect()    { subscribe(); }

    function onDisconnect() {
      setIsLive(false);
      startPolling(); // snap-back: begin HTTP polling until socket returns
    }

    sock.on('price:update', onPriceUpdate);
    sock.on('connect',      onConnect);
    sock.on('disconnect',   onDisconnect);

    if (sock.connected) {
      subscribe();
    } else {
      startPolling(); // not yet connected — poll while socket handshakes
    }

    return () => {
      sock.emit('unsubscribe', t);
      sock.off('price:update', onPriceUpdate);
      sock.off('connect',      onConnect);
      sock.off('disconnect',   onDisconnect);
      stopPolling();
      releaseSocket();
    };
  }, [ticker, startPolling, stopPolling]);

  return { price, change, changePercent, isLive };
}
