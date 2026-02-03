'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import { getCurrentUser, createLinkPasskeySession } from '../../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [linkPasskeyData, setLinkPasskeyData] = useState(null);
  const [linkPasskeyLoading, setLinkPasskeyLoading] = useState(false);
  const [linkPasskeySuccess, setLinkPasskeySuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = localStorage.getItem('dwara_token');
      if (!token) {
        router.push('/');
        return;
      }

      const userData = await getCurrentUser();
      setUser(userData);
    } catch (err) {
      console.error('Failed to load user:', err);
      if (err.response?.status === 401) {
        localStorage.removeItem('dwara_token');
        router.push('/');
      } else {
        setError('Failed to load user data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dwara_token');
    router.push('/');
  };

  const handleLinkPasskey = async () => {
    try {
      setLinkPasskeyLoading(true);
      setError('');

      const session = await createLinkPasskeySession();
      setLinkPasskeyData(session);

      // Connect to Socket.IO
      const socketUrl = API_URL.replace(/\/api\/?$/, '');
      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        console.log('Socket connected for link passkey');
        socket.emit('join', session.sessionId);
      });

      socket.on('passkey-linked', (data) => {
        console.log('Passkey linked:', data);
        setLinkPasskeySuccess(true);
        setLinkPasskeyData(null);
        // Reload user to get updated hasPasskey status
        loadUser();
        socket.disconnect();
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

    } catch (err) {
      console.error('Failed to create link passkey session:', err);
      setError(err.response?.data?.error || 'Failed to create session');
    } finally {
      setLinkPasskeyLoading(false);
    }
  };

  const cancelLinkPasskey = () => {
    setLinkPasskeyData(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-purple-200">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
          <p className="text-purple-200 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-purple-200">Welcome back!</p>
          </div>
          <button
            onClick={handleLogout}
            className="py-2 px-4 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>

        {/* User Info Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl mb-8">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
            <span className="mr-2">👤</span> Identity Information
          </h2>

          <div className="grid gap-6">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-purple-300 mb-1">Email</div>
              <div className="text-white font-medium">{user?.email}</div>
            </div>

            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-purple-300 mb-1">Decentralized ID (DID)</div>
              <div className="text-white font-mono text-sm break-all">
                {user?.did || 'Not registered'}
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-purple-300 mb-1">Wallet Address</div>
              <div className="text-white font-mono text-sm break-all">
                {user?.walletAddress || 'Not registered'}
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-purple-300 mb-1">DID Hash (On-chain)</div>
              <div className="text-white font-mono text-xs break-all">
                {user?.didHash || 'Not anchored'}
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-purple-300 mb-1">Account Created</div>
              <div className="text-white">
                {user?.createdAt ? new Date(user.createdAt).toLocaleString() : 'Unknown'}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <span className="mr-2">🔐</span> Security
            </h3>
            
            {/* Passkey Status */}
            <div className="mb-4">
              {user?.hasPasskey ? (
                <div className="flex items-center text-green-400 mb-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                  Passkey Linked
                </div>
              ) : (
                <div className="flex items-center text-yellow-400 mb-2">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                  No Passkey Linked
                </div>
              )}
              <div className="flex items-center text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                Password Active
              </div>
            </div>

            {/* Link Passkey Section */}
            {!user?.hasPasskey && !linkPasskeyData && (
              <div className="mt-4 pt-4 border-t border-purple-500/30">
                <p className="text-purple-200 text-sm mb-4">
                  Add a passkey for faster, more secure logins using your phone's biometrics.
                </p>
                <button
                  onClick={handleLinkPasskey}
                  disabled={linkPasskeyLoading}
                  className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-medium rounded-lg transition-colors"
                >
                  {linkPasskeyLoading ? 'Creating session...' : '🔑 Link Passkey'}
                </button>
              </div>
            )}

            {/* QR Code for linking passkey */}
            {linkPasskeyData && (
              <div className="mt-4 pt-4 border-t border-purple-500/30">
                <p className="text-purple-200 text-sm mb-4 text-center">
                  Scan this QR code with your phone to link your passkey
                </p>
                <div className="flex justify-center mb-4">
                  <div className="bg-white p-3 rounded-xl">
                    <QRCodeSVG
                      value={linkPasskeyData.url}
                      size={160}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>
                
                {linkPasskeyData.contextNumber && (
                  <div className="bg-purple-900/50 p-3 rounded-xl mb-4 border border-purple-500/30 text-center">
                    <p className="text-purple-300 text-xs mb-1">Security Check</p>
                    <p className="text-2xl font-bold text-white tracking-widest">{linkPasskeyData.contextNumber}</p>
                    <p className="text-purple-300 text-xs mt-1">Select this on your phone</p>
                  </div>
                )}

                <div className="flex items-center justify-center text-purple-200 text-sm mb-4">
                  <div className="animate-pulse w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                  Waiting for phone...
                </div>

                <button
                  onClick={cancelLinkPasskey}
                  className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 text-purple-300 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Success message */}
            {linkPasskeySuccess && (
              <div className="mt-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200 text-sm">
                ✅ Passkey successfully linked! You can now login with your passkey.
              </div>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <span className="mr-2">⛓️</span> Blockchain Status
            </h3>
            <p className="text-purple-200 text-sm mb-4">
              Your DID document hash is recorded on the local Hardhat chain.
            </p>
            <div className="flex items-center text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              {user?.didHash ? 'Anchored' : 'Pending'}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-purple-300 text-sm">
          <p>
            Your personal data is encrypted client-side. Only you have access to your encryption keys.
          </p>
        </div>
      </div>
    </div>
  );
}
