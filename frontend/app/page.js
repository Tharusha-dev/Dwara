'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestMagicLink } from '../lib/api';

export default function Home() {
  const [email, setEmail] = useState('');
  const [magicLink, setMagicLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMagicLink('');

    try {
      const result = await requestMagicLink(email);
      setMagicLink(result.link);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create magic link');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo & Title */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-2">
            🔐 Dwara
          </h1>
          <p className="text-purple-200 text-lg">
            Decentralized Identity with Passkeys
          </p>
        </div>

        {/* Sign Up Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-semibold text-white mb-6">Get Started</h2>
          
          <form onSubmit={handleSignUp} className="space-y-4">
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

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              {loading ? 'Creating...' : 'Sign Up with Passkey'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          {magicLink && (
            <div className="mt-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
              <p className="text-green-200 text-sm mb-2">Magic link created! Click below to continue:</p>
              <a
                href={magicLink}
                className="text-green-300 hover:text-green-100 underline text-sm break-all"
              >
                {magicLink}
              </a>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-purple-500/30">
            <p className="text-purple-200 text-sm text-center mb-4">
              Already have an account?
            </p>
            <button
              onClick={handleLogin}
              className="w-full py-3 px-4 bg-transparent border border-purple-500 hover:bg-purple-500/20 text-purple-300 font-semibold rounded-lg transition-colors duration-200"
            >
              Login with QR Code
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-4">
            <div className="text-3xl mb-2">🔑</div>
            <p className="text-purple-200 text-sm">Passwordless</p>
          </div>
          <div className="p-4">
            <div className="text-3xl mb-2">⛓️</div>
            <p className="text-purple-200 text-sm">Blockchain Verified</p>
          </div>
          <div className="p-4">
            <div className="text-3xl mb-2">🔒</div>
            <p className="text-purple-200 text-sm">Client Encrypted</p>
          </div>
        </div>
      </div>
    </div>
  );
}
