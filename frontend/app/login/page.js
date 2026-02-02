'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import { createQRSession, initPasswordLogin, completePasswordLogin, checkAuthMethod } from '../../lib/api';
import { signChallenge } from '../../lib/password';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LoginPage() {
  const [authMode, setAuthMode] = useState('passkey'); // 'passkey' or 'password'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle, waiting, authenticating, authenticated
  const router = useRouter();

  // Password login handler
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setStatus('authenticating');

    try {
      // Step 1: Initialize login to get salt and challenge
      const { sessionId, salt, challenge } = await initPasswordLogin(email);

      // Step 2: Sign the challenge with password-derived key (client-side only)
      const { signature, address } = await signChallenge(password, salt, challenge);

      // Step 3: Complete login by sending the signature
      const result = await completePasswordLogin(sessionId, signature);

      // Save token
      if (result.token) {
        localStorage.setItem('dwara_token', result.token);
      }

      setStatus('authenticated');

      // Redirect to dashboard after short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err) {
      console.error('Password login error:', err);
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
      setStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  // QR login initializer
  const initQRSession = async () => {
    try {
      setLoading(true);
      setError('');
      setStatus('waiting');

      // Create QR session
      const session = await createQRSession();
      setQrData(session);

      // Connect to Socket.IO
      // Use root domain for socket.io in production (remove /api suffix if present)
      const socketUrl = API_URL.replace(/\/api\/?$/, '');
      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        console.log('Socket connected');
        socket.emit('join', session.sessionId);
      });

      socket.on('authenticated', (data) => {
        console.log('Authentication successful:', data);
        setStatus('authenticated');

        // Save token
        if (data.token) {
          localStorage.setItem('dwara_token', data.token);
        }

        // Redirect to dashboard after short delay
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      // Cleanup on unmount
      return () => {
        socket.disconnect();
      };
    } catch (err) {
      console.error('Failed to create QR session:', err);
      setError('Failed to create login session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setQrData(null);
    setStatus('idle');
    setError('');
  };

  const handleShowQR = () => {
    initQRSession();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-purple-200">
              Sign in to your account
            </p>
          </div>

          {/* Auth Mode Toggle */}
          <div className="flex rounded-lg bg-white/5 p-1 mb-6">
            <button
              type="button"
              onClick={() => { setAuthMode('passkey'); setError(''); setStatus('idle'); }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                authMode === 'passkey'
                  ? 'bg-purple-600 text-white'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              🔑 Passkey (QR)
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('password'); setError(''); setStatus('idle'); setQrData(null); }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                authMode === 'password'
                  ? 'bg-purple-600 text-white'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              🔒 Password
            </button>
          </div>

          {/* Password Login Form */}
          {authMode === 'password' && status !== 'authenticated' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-purple-200 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>

              <p className="text-xs text-purple-300 text-center">
                🔒 Password is never sent to the server
              </p>
            </form>
          )}

          {/* Passkey/QR Login */}
          {authMode === 'passkey' && status === 'idle' && (
            <div className="text-center">
              <p className="text-purple-200 mb-6">
                Scan a QR code with your phone to login securely using your passkey.
              </p>
              <button
                onClick={handleShowQR}
                disabled={loading}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                {loading ? 'Creating session...' : 'Show QR Code'}
              </button>
            </div>
          )}

          {authMode === 'passkey' && loading && status !== 'waiting' && (
            <div className="flex flex-col items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
              <p className="text-purple-200">Creating session...</p>
            </div>
          )}

          {authMode === 'passkey' && error && (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">❌</div>
              <p className="text-red-300 mb-4">{error}</p>
              <button
                onClick={handleRefresh}
                className="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
              >
                Try Again
              </button>
            </div>
          )}

          {authMode === 'passkey' && !loading && !error && qrData && status === 'waiting' && (
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl mb-6">
                <QRCodeSVG
                  value={qrData.url}
                  size={220}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div className="text-center mb-6">
                <p className="text-purple-300 text-sm mb-2">Or open this URL on your phone:</p>
                <code className="text-xs text-purple-200 bg-white/10 px-3 py-1 rounded break-all">
                  {qrData.url}
                </code>
              </div>

              {qrData.contextNumber && (
                <div className="bg-purple-900/50 p-4 rounded-xl mb-6 border border-purple-500/30">
                  <p className="text-purple-300 text-sm mb-1">Security Check</p>
                  <p className="text-3xl font-bold text-white tracking-widest">{qrData.contextNumber}</p>
                  <p className="text-purple-300 text-xs mt-1">Select this number on your phone</p>
                </div>
              )}

              <div className="flex items-center text-purple-200">
                <div className="animate-pulse w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                Waiting for authentication...
              </div>

              <button
                onClick={handleRefresh}
                className="mt-6 text-purple-300 hover:text-purple-100 text-sm underline"
              >
                Generate new QR code
              </button>
            </div>
          )}

          {status === 'authenticated' && (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-white mb-2">Authenticated!</h2>
              <p className="text-purple-200">Redirecting to dashboard...</p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-purple-300 hover:text-purple-100"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
