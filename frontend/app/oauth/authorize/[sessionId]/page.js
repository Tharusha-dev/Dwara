'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getOAuthSession, authorizeOAuthPassword, initPasswordLogin } from '../../../../lib/api';
import { signChallenge } from '../../../../lib/password';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function AuthorizeContent() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authorizing, setAuthorizing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId;

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const data = await getOAuthSession(sessionId);
      setSession(data);
    } catch (err) {
      console.error('Failed to load OAuth session:', err);
      setError(err.response?.data?.error || 'Invalid or expired authorization session');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorize = async (e) => {
    e.preventDefault();
    setAuthorizing(true);
    setError('');

    try {
      // Step 1: Get salt and challenge from password login init
      const { sessionId: loginSessionId, salt, challenge } = await initPasswordLogin(email);

      // Step 2: Sign the challenge with password-derived key
      const { signature } = await signChallenge(password, salt, challenge);

      // Step 3: Authorize the OAuth session with password
      const result = await authorizeOAuthPassword(sessionId, email, signature, challenge);

      setAuthorized(true);

      // Redirect to the app's callback URL
      setTimeout(() => {
        window.location.href = result.redirectUri;
      }, 2000);
    } catch (err) {
      console.error('Authorization error:', err);
      setError(err.response?.data?.error || 'Authorization failed. Please check your credentials.');
    } finally {
      setAuthorizing(false);
    }
  };

  const handleDeny = () => {
    // Redirect back to the app with an error
    if (session?.redirectUri) {
      const url = new URL(session.redirectUri);
      url.searchParams.set('error', 'access_denied');
      window.location.href = url.toString();
    } else {
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-purple-200">Loading authorization request...</p>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-white mb-4">Authorization Error</h2>
          <p className="text-red-300 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-6xl mb-6">✅</div>
          <h2 className="text-2xl font-bold text-white mb-2">Authorization Successful!</h2>
          <p className="text-purple-200">Redirecting you back to {session?.appName}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">🔐</div>
            <h1 className="text-2xl font-bold text-white">Authorize Access</h1>
          </div>

          {/* App Info */}
          <div className="bg-white/5 rounded-xl p-4 mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-purple-600/30 rounded-xl flex items-center justify-center text-3xl">
                🌐
              </div>
              <div>
                <div className="text-white font-semibold text-lg">{session?.appName}</div>
                <div className="text-purple-300 text-sm">{session?.appDomain}</div>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="mb-6">
            <p className="text-purple-200 text-sm mb-3">
              This application is requesting access to:
            </p>
            <div className="space-y-2">
              {session?.scopes?.includes('email') && (
                <div className="flex items-center text-white text-sm">
                  <span className="text-green-400 mr-2">✓</span>
                  Your email address
                </div>
              )}
              {session?.scopes?.includes('profile') && (
                <div className="flex items-center text-white text-sm">
                  <span className="text-green-400 mr-2">✓</span>
                  Your profile information (name, NIC, DOB, address)
                </div>
              )}
              <div className="flex items-center text-white text-sm">
                <span className="text-green-400 mr-2">✓</span>
                Your Decentralized ID (DID)
              </div>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleAuthorize} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-purple-200 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-purple-200 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={handleDeny}
                className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
              >
                Deny
              </button>
              <button
                type="submit"
                disabled={authorizing || !email || !password}
                className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-semibold rounded-lg transition-colors"
              >
                {authorizing ? (
                  <span className="flex items-center justify-center">
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                    Authorizing...
                  </span>
                ) : (
                  'Authorize'
                )}
              </button>
            </div>
          </form>

          {/* Security Note */}
          <div className="mt-6 pt-4 border-t border-purple-500/30">
            <p className="text-purple-300 text-xs text-center">
              🔒 Your password never leaves your device. We use blockchain-based cryptographic verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      }
    >
      <AuthorizeContent />
    </Suspense>
  );
}
