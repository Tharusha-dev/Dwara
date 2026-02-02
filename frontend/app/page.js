'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestMagicLink, initPasswordRegister, completePasswordRegister } from '../lib/api';
import { deriveWallet, validatePassword, signChallenge } from '../lib/password';
import { buildDIDDocument, hashDIDDocument } from '../lib/wallet';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [magicLink, setMagicLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState('passkey'); // 'passkey' or 'password'
  const [registrationResult, setRegistrationResult] = useState(null);
  const router = useRouter();

  const handleSignUpPasskey = async (e) => {
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

  const handleSignUpPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate password
      const validation = validatePassword(password);
      if (!validation.valid) {
        setError(validation.errors.join('. '));
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      // Step 1: Initialize registration to get salt
      const { sessionId, salt } = await initPasswordRegister(email, null);

      // Step 2: Derive wallet from password + salt (client-side only)
      const { wallet, address } = await deriveWallet(password, salt);

      // Step 3: Build DID document
      const didDoc = buildDIDDocument(address, email);
      const didDocHash = hashDIDDocument(didDoc);

      // Step 4: Sign the sessionId as proof of key ownership
      const proofSignature = await wallet.signMessage(sessionId);

      // Step 5: Sign the DID doc hash
      const sigEth = await wallet.signMessage(didDocHash);

      // Step 6: Complete registration
      const result = await completePasswordRegister({
        sessionId,
        ethAddress: address,
        didDocJson: didDoc,
        didDocHash,
        proofSignature,
        sigEth,
      });

      // Save token
      if (result.token) {
        localStorage.setItem('dwara_token', result.token);
      }

      setRegistrationResult(result);
    } catch (err) {
      console.error('Password registration error:', err);
      setError(err.response?.data?.error || 'Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    router.push('/login');
  };

  // If registration is complete, show success
  if (registrationResult) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-white mb-2">Registration Complete!</h2>
            <p className="text-purple-200 mb-6">Your decentralized identity has been created.</p>
            
            <div className="bg-white/5 rounded-lg p-4 mb-6 text-left">
              <div className="text-sm text-purple-300 mb-1">Your DID</div>
              <div className="font-mono text-white text-sm break-all">
                {registrationResult.did}
              </div>
            </div>

            {registrationResult.txHash && (
              <div className="bg-white/5 rounded-lg p-4 mb-6 text-left">
                <div className="text-sm text-purple-300 mb-1">Blockchain Transaction</div>
                <div className="font-mono text-green-400 text-xs break-all">
                  {registrationResult.txHash}
                </div>
              </div>
            )}

            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
              <p className="text-yellow-200 text-sm">
                ⚠️ <strong>Important:</strong> Remember your password! It cannot be recovered as it's never stored anywhere.
              </p>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          
          {/* Auth Mode Toggle */}
          <div className="flex rounded-lg bg-white/5 p-1 mb-6">
            <button
              type="button"
              onClick={() => setAuthMode('passkey')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                authMode === 'passkey'
                  ? 'bg-purple-600 text-white'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              🔑 Passkey
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('password')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                authMode === 'password'
                  ? 'bg-purple-600 text-white'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              🔒 Password
            </button>
          </div>

          {authMode === 'passkey' ? (
            <form onSubmit={handleSignUpPasskey} className="space-y-4">
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

              <p className="text-xs text-purple-300 text-center">
                Most secure option • Uses your device's biometrics
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignUpPassword} className="space-y-4">
              <div>
                <label htmlFor="email-pw" className="block text-sm font-medium text-purple-200 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email-pw"
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

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-purple-200 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password || !confirmPassword}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                    Creating Identity...
                  </span>
                ) : (
                  'Sign Up with Password'
                )}
              </button>

              <div className="text-xs text-purple-300 space-y-1">
                <p className="text-center">🔒 Your password is never stored</p>
                <p className="text-center text-purple-400">
                  Password requirements: 8+ chars, uppercase, lowercase, number
                </p>
              </div>
            </form>
          )}

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
              Login
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
            <p className="text-purple-200 text-sm">Zero Knowledge</p>
          </div>
        </div>
      </div>
    </div>
  );
}
