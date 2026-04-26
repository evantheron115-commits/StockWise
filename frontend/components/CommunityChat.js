import { useState, useEffect, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';

const MAX_CHARS = 1000;

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Avatar({ name, image }) {
  if (image) {
    return (
      <img
        src={image}
        alt={name || 'User'}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        style={{ boxShadow: '0 0 0 1.5px rgba(99,102,241,0.4)' }}
      />
    );
  }
  const initials = (name || '?').slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
      <span className="text-[11px] font-semibold text-brand-400">{initials}</span>
    </div>
  );
}

export default function CommunityChat({ ticker }) {
  const { data: session, status } = useSession();

  const [posts,    setPosts]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [content,  setContent]  = useState('');
  const [posting,  setPosting]  = useState(false);
  const [postError, setPostError] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/posts/${ticker}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          if (data.error) throw new Error(data.error);
          setPosts(data.posts || []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load posts.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [ticker]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    setPosting(true);
    setPostError('');

    try {
      const res  = await fetch(`/api/posts/${ticker}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post.');

      setPosts((prev) => [data.post, ...prev]);
      setContent('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err) {
      setPostError(err.message);
    } finally {
      setPosting(false);
    }
  }

  function handleTextareaChange(e) {
    setContent(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  const charsLeft = MAX_CHARS - content.length;

  return (
    <div className="space-y-4 mb-6">

      {/* Post composer */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">
          Community Chat
          <span className="text-xs font-normal text-gray-600 ml-2">{ticker}</span>
        </h3>

        {status === 'loading' ? null : session ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-3">
              <Avatar name={session.user?.name || session.user?.email} image={session.user?.image || session.user?.avatar} />
              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  maxLength={MAX_CHARS}
                  placeholder={`Share your thoughts on ${ticker}…`}
                  value={content}
                  onChange={handleTextareaChange}
                  disabled={posting}
                  className="w-full bg-gray-900 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-700 resize-none focus:outline-none focus:border-brand-500/50 transition-colors disabled:opacity-50"
                  style={{ minHeight: '64px', overflow: 'hidden' }}
                />
                {postError && (
                  <p className="text-xs text-red-400 mt-1">{postError}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between pl-11">
              <span className={`text-[10px] ${charsLeft < 100 ? 'text-amber-500' : 'text-gray-700'}`}>
                {charsLeft} remaining
              </span>
              <button
                type="submit"
                disabled={posting || !content.trim()}
                className="btn-primary text-xs px-4 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gray-800 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">
                <button
                  onClick={() => signIn()}
                  className="text-brand-400 hover:text-brand-300 transition-colors"
                >
                  Sign in
                </button>
                {' '}to join the discussion.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Post list */}
      <div className="card">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-24" />
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-6">
            No posts yet. Be the first to share your thoughts on {ticker}.
          </p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="flex gap-3">
                <Avatar name={post.user_name} image={post.user_avatar} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-semibold text-amber-400/90">{post.user_name}</span>
                    <span className="text-[10px] text-gray-600">{timeAgo(post.created_at)}</span>
                  </div>
                  {/* Frosted glass message bubble */}
                  <div
                    className="rounded-xl rounded-tl-sm px-3 py-2 text-sm text-gray-300 whitespace-pre-wrap break-words"
                    style={{
                      background:           'rgba(255,255,255,0.04)',
                      backdropFilter:       'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      border:               '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {post.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
