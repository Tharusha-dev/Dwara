'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '../../lib/api';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
            <p className="text-purple-200 text-sm mb-4">
              Your identity is secured by WebAuthn passkeys and anchored on the blockchain.
            </p>
            <div className="flex items-center text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              Passkey Active
            </div>
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
