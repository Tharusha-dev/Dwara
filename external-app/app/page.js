'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Hard-coded app credentials (in production, these would be registered with Dwara)
const APP_CONFIG = {
  appId: 'demo-external-app-001',
  appName: 'Demo Banking App',
  appDomain: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001',
  scopes: ['profile', 'email'],
  icon: '🏦',
};

const DWARA_API_URL = process.env.NEXT_PUBLIC_DWARA_API_URL || 'http://localhost:4000';
const DWARA_ORIGIN = process.env.NEXT_PUBLIC_DWARA_ORIGIN || 'http://localhost:3000';

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const userData = localStorage.getItem('demo_app_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLoginWithDwara = async () => {
    setLoading(true);
    setError('');

    try {
      // Step 1: Create OAuth authorization session with Dwara
      const redirectUri = `${APP_CONFIG.appDomain}/callback`;
      const state = Math.random().toString(36).substring(7); // CSRF protection
      
      // Store state for verification later
      localStorage.setItem('oauth_state', state);

      const response = await fetch(`${DWARA_API_URL}/oauth/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appId: APP_CONFIG.appId,
          appName: APP_CONFIG.appName,
          appDomain: APP_CONFIG.appDomain,
          redirectUri,
          state,
          scopes: APP_CONFIG.scopes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initialize OAuth session');
      }

      const data = await response.json();

      // Step 2: Redirect to Dwara authorization page
      window.location.href = data.authorizationUrl;
    } catch (err) {
      console.error('Login with Dwara error:', err);
      setError(err.message || 'Failed to start login process');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('demo_app_user');
    localStorage.removeItem('demo_app_token');
    setUser(null);
  };

  // If user is logged in, show their info
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-lg w-full">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🏦</div>
              <h1 className="text-2xl font-bold text-white">Welcome to Demo Banking App</h1>
              <p className="text-blue-200 mt-2">You're signed in with Dwara</p>
            </div>

            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-6">
              <div className="flex items-center text-green-400">
                <span className="text-xl mr-2">✅</span>
                <span className="font-medium">Successfully authenticated via Dwara</span>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-blue-300 mb-1">Full Name</div>
                <div className="text-white font-medium">{user.fullName || 'Not provided'}</div>
              </div>

              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-blue-300 mb-1">Email</div>
                <div className="text-white font-medium">{user.email}</div>
              </div>

              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-blue-300 mb-1">NIC</div>
                <div className="text-white font-medium">{user.nic || 'Not provided'}</div>
              </div>

              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-blue-300 mb-1">Date of Birth</div>
                <div className="text-white font-medium">
                  {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'Not provided'}
                </div>
              </div>

              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-blue-300 mb-1">Address</div>
                <div className="text-white font-medium">{user.address || 'Not provided'}</div>
              </div>

              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-blue-300 mb-1">Decentralized ID (DID)</div>
                <div className="text-white font-mono text-sm break-all">{user.did}</div>
              </div>

              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-blue-300 mb-1">Wallet Address</div>
                <div className="text-white font-mono text-xs break-all">{user.walletAddress || 'Not provided'}</div>
              </div>
            </div>

            <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-6">
              <p className="text-blue-200 text-sm">
                <span className="font-semibold">🔐 Blockchain Verified:</span> This user's identity is anchored on the blockchain via Dwara's decentralized identity system.
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>

          <div className="mt-6 text-center text-blue-300 text-sm">
            <p>This is a demo external application showing Dwara OAuth integration</p>
          </div>
        </div>
      </div>
    );
  }

  // Login page
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🏦</div>
            <h1 className="text-3xl font-bold text-white">Demo Banking App</h1>
            <p className="text-blue-200 mt-2">
              Secure login with your Dwara identity
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
              {error}
            </div>
          )}

          <button
            onClick={handleLoginWithDwara}
            disabled={loading}
            className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg"
          >
            {loading ? (
              <span className="flex items-center">
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></span>
                Connecting...
              </span>
            ) : (
              <>
                <span className="text-2xl">🔐</span>
                <span>Login with Dwara</span>
              </>
            )}
          </button>

          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="text-center text-blue-300 text-sm space-y-2">
              <p className="font-medium">Why use Dwara?</p>
              <div className="flex justify-center space-x-4 mt-3">
                <div className="text-center">
                  <div className="text-2xl mb-1">🔒</div>
                  <p className="text-xs">Secure</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-1">⛓️</div>
                  <p className="text-xs">Blockchain</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-1">🔑</div>
                  <p className="text-xs">Passwordless</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-blue-300 text-sm">
            Don't have a Dwara account?{' '}
            <a 
              href={DWARA_ORIGIN}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 underline"
            >
              Create one here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
