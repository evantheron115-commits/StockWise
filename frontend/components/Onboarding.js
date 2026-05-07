import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { IS_NATIVE, authFetch } from '../lib/mobileAuth';
import { storageSet } from '../lib/storageProvider';

const PUSH_TOKEN_KEY = 'valubull_push_token';

const ONBOARDED_KEY = 'valubull_onboarded_v1';

const STEPS = [
  {
    id: 'welcome',
    icon: (
      <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center shadow-glow">
        <svg width="28" height="28" viewBox="0 0 14 14" fill="none">
          <polyline points="1,10 4,6 7,8 10,3 13,5"
            stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    ),
    title: 'Welcome to ValuBull',
    body:  'Institutional-grade equity intelligence, built for the independent investor. Everything Wall Street uses — in your hands.',
  },
  {
    id: 'search',
    icon: (
      <div className="w-16 h-16 rounded-2xl bg-surface-800 border border-white/10 flex items-center justify-center">
        <span className="font-mono text-brand-400 text-xl font-bold">⌘K</span>
      </div>
    ),
    title: 'Neural Alpha Search',
    body:  'Type any ticker or company name. The engine ranks results by market capitalization — Apple surfaces before any obscure "A" stock. The market knows what you mean.',
  },
  ...(IS_NATIVE ? [{
    id: 'haptics',
    icon: (
      <div className="w-16 h-16 rounded-2xl bg-surface-800 border border-white/10 flex items-center justify-center">
        <span className="text-3xl">📳</span>
      </div>
    ),
    title: 'Bio-Digital Market Sync',
    body:  'Your device physically feels market magnitude. A 3%+ move triggers a distinct pulse. A quiet market is a quiet phone. You can feel a crash without looking at the screen.',
  }] : []),
  {
    id: 'notifications',
    icon: (
      <div className="w-16 h-16 rounded-2xl bg-surface-800 border border-white/10 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand-400">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>
    ),
    title: 'Enable Market Alerts',
    body:  'Get notified of major moves in your watchlist. Never miss a 5% day or a breaking earnings surprise.',
    action: 'Enable Notifications',
  },
];

async function requestNotificationPermission() {
  if (IS_NATIVE) {
    try {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      const { receive } = await FirebaseMessaging.requestPermissions();
      if (receive !== 'granted') return 'denied';
      const { token } = await FirebaseMessaging.getToken();
      if (token) {
        try {
          const r = await authFetch('/api/push/register', {
            method: 'POST',
            body:   JSON.stringify({ deviceToken: token, platform: 'ios' }),
          });
          if (r.ok) await storageSet(PUSH_TOKEN_KEY, token);
        } catch {}
      }
      return 'granted';
    } catch {
      return 'denied';
    }
  }
  // Web — standard Notifications API
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.requestPermission();
}

const variants = {
  enter:  { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0  },
  exit:   { opacity: 0, x: -40 },
};

export default function Onboarding() {
  const [show,    setShow]    = useState(false);
  const [step,    setStep]    = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (!localStorage.getItem(ONBOARDED_KEY)) setShow(true);
    } catch {}
  }, []);

  function finish() {
    try { localStorage.setItem(ONBOARDED_KEY, '1'); } catch {}
    setShow(false);
  }

  async function handleAction() {
    await requestNotificationPermission();
    finish();
  }

  if (!mounted || !show) return null;

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-4 pb-8 sm:pb-0"
      style={{ background: 'rgba(3,7,18,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Skip */}
      <button
        onClick={finish}
        className="absolute top-14 right-5 text-xs text-gray-600 hover:text-gray-400 transition-colors font-mono"
        style={{ paddingTop: 'var(--sat)' }}
      >
        skip
      </button>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background:    'rgba(11,13,21,0.95)',
          border:        '1px solid rgba(255,255,255,0.10)',
          boxShadow:     '0 32px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pt-5 pb-1">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width:      i === step ? '20px' : '6px',
                background: i === step ? '#6366f1' : 'rgba(255,255,255,0.12)',
              }}
            />
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="px-8 py-8 text-center"
          >
            <div className="flex justify-center mb-6">{current.icon}</div>
            <h2 className="text-xl font-semibold text-white mb-3 tracking-tight">{current.title}</h2>
            <p className="text-sm text-gray-400 leading-relaxed">{current.body}</p>
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="px-8 pb-8 flex flex-col gap-3">
          {isLast ? (
            <>
              <button onClick={handleAction} className="btn-primary w-full">
                {current.action || 'Get Started'}
              </button>
              <button onClick={finish} className="text-xs text-gray-600 hover:text-gray-400 transition-colors py-1">
                Maybe later
              </button>
            </>
          ) : (
            <button onClick={() => setStep((s) => s + 1)} className="btn-primary w-full">
              Continue
            </button>
          )}
        </div>
      </div>
    </motion.div>,
    document.body
  );
}
