'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { getQRSession, getAuthOptions, submitAssertion } from '../../../lib/api';
import { getAssertion, isWebAuthnSupported } from '../../../lib/webauthn';

function QRAuthContent({ sessionId }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [webAuthnSupported, setWebAuthnSupported] = useState(true);

  useEffect(() => {
    setWebAuthnSupported(isWebAuthnSupported());
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      setLoading(true);
      const data = await getQRSession(sessionId);
      setSession(data);
      if (data.email) {
        setEmail(data.email);
      }
    } catch (err) {
      setError('Invalid or expired session');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthenticate = async (contextNumber = null) => {
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setAuthenticating(true);
    setError('');

    try {
      // Get authentication options
      const options = await getAuthOptions(sessionId, email, contextNumber);

      // Perform WebAuthn authentication
      const assertion = await getAssertion(options);

      // Submit assertion to server
      await submitAssertion(sessionId, assertion, email);

      setSuccess(true);
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setAuthenticating(false);
    }
  };

  if (!webAuthnSupported) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-4">WebAuthn Not Supported</h2>
          <p className="text-purple-200">
            Your browser doesn't support passkeys. Please use a device with biometric authentication.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-purple-200">Loading session...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-white mb-4">Authenticated!</h2>
          <p className="text-purple-200">
            You have successfully authenticated. You can now close this page and return to your desktop.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">🔐</div>
            <h1 className="text-2xl font-bold text-white mb-2">Confirm Login</h1>
            <p className="text-purple-200">
              Use your passkey to authenticate this session
            </p>
          </div>

          {session?.status === 'authenticated' && (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-green-300">Session already authenticated</p>
            </div>
          )}

          {session?.status === 'pending' && (
            <>
              <div className="mb-6">
                <label htmlFor="email" className="block text-sm font-medium text-purple-200 mb-2">
                  Your Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {session.candidates && session.candidates.length > 0 && (
                <div className="mb-8">
                  <label className="block text-sm font-medium text-purple-200 mb-3 text-center">
                    Tap the number shown on your desktop
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    {session.candidates.map((num) => (
                      <button
                        key={num}
                        onClick={() => handleAuthenticate(num)}
                        disabled={authenticating || !email}
                        className="aspect-square flex items-center justify-center text-2xl font-bold bg-white/5 hover:bg-white/20 border border-purple-500/30 rounded-xl text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:bg-purple-600"
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                  {error}
                </div>
              )}

              {(!session.candidates || session.candidates.length === 0) && (
                <button
                  onClick={() => handleAuthenticate()}
                  disabled={authenticating || !email}
                  className="w-full py-4 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-semibold rounded-lg transition-colors duration-200"
                >
                  {authenticating ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                      Authenticating...
                    </span>
                  ) : (
                    '🔑 Authenticate with Passkey'
                  )}
                </button>
              )}

              <p className="mt-4 text-center text-purple-300 text-sm">
                Your device will prompt you to verify your identity using Face ID, Touch ID, or another biometric.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QRAuthPage({ params }) {
  const { sessionId } = params;

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    }>
      <QRAuthContent sessionId={sessionId} />
    </Suspense>
  );
}
