import Head        from 'next/head';
import Link        from 'next/link';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter }           from 'next/router';

export default function Settings() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/auth/login');
  }, [status, router]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-600 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Settings — ValuBull</title>
      </Head>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <h1 className="text-xl font-semibold text-white">Account Settings</h1>

        {/* Account info */}
        <section className="card space-y-4">
          <h2 className="text-sm font-medium text-gray-300">Your Account</h2>
          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <span className="text-gray-600">Email</span>
            <span className="text-gray-300 font-mono">{session?.user?.email}</span>
            {session?.user?.name && (
              <>
                <span className="text-gray-600">Name</span>
                <span className="text-gray-300">{session.user.name}</span>
              </>
            )}
          </div>
        </section>

        {/* Legal */}
        <section className="card space-y-3">
          <h2 className="text-sm font-medium text-gray-300">Legal & Privacy</h2>
          <div className="flex flex-col gap-2 text-xs">
            <Link href="/privacy" className="text-brand-400 hover:text-brand-300 transition-colors">
              Privacy Policy →
            </Link>
            <Link href="/terms" className="text-brand-400 hover:text-brand-300 transition-colors">
              Terms of Use →
            </Link>
          </div>
          <p className="text-xs text-gray-700 pt-1 border-t border-white/[0.06]">
            ValuBull stores your email address and display name to provide account features.
            We do not sell your data or share it with third parties. Financial data is provided
            by Financial Modeling Prep and Polygon.io for informational purposes only.
          </p>
        </section>

        {/* Danger zone */}
        <DeleteAccountSection />

      </div>
    </>
  );
}

function DeleteAccountSection() {
  const router = useRouter();
  const [step,    setStep]    = useState('idle'); // idle | confirm | deleting | done | error
  const [errMsg,  setErrMsg]  = useState('');
  const [confirm, setConfirm] = useState('');

  async function handleDelete() {
    if (confirm.toUpperCase() !== 'DELETE') return;
    setStep('deleting');
    try {
      const r = await fetch('/api/settings/delete-account', { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Deletion failed.');
      }
      setStep('done');
      // Sign out and redirect after a short pause so user sees confirmation
      setTimeout(() => signOut({ callbackUrl: '/' }), 2000);
    } catch (e) {
      setErrMsg(e.message);
      setStep('error');
    }
  }

  return (
    <section className="card border border-red-500/20 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-red-400">Danger Zone</h2>
        <p className="text-xs text-gray-600 mt-1">
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
      </div>

      {step === 'idle' && (
        <button
          onClick={() => setStep('confirm')}
          className="text-xs px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          Delete My Account
        </button>
      )}

      {step === 'confirm' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            Type <span className="font-mono text-red-400 font-semibold">DELETE</span> to confirm.
            Your watchlist, posts, and account data will be permanently removed.
          </p>
          <input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="w-full bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-red-500/50"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={confirm.toUpperCase() !== 'DELETE'}
              className="text-xs px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Permanently Delete Account
            </button>
            <button
              onClick={() => { setStep('idle'); setConfirm(''); }}
              className="text-xs px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'deleting' && (
        <p className="text-xs text-gray-500 animate-pulse">Deleting your account...</p>
      )}

      {step === 'done' && (
        <p className="text-xs text-green-400">
          Account deleted. Signing you out...
        </p>
      )}

      {step === 'error' && (
        <div className="space-y-2">
          <p className="text-xs text-red-400">{errMsg}</p>
          <button
            onClick={() => { setStep('idle'); setConfirm(''); setErrMsg(''); }}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            ← Go back
          </button>
        </div>
      )}
    </section>
  );
}
