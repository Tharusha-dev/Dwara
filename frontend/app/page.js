'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { initPasswordRegister, completePasswordRegister } from '../lib/api';
import { deriveWallet, validatePassword } from '../lib/password';
import { buildDIDDocument, hashDIDDocument } from '../lib/wallet';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Profile fields
  const [fullName, setFullName] = useState('');
  const [nic, setNic] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registrationResult, setRegistrationResult] = useState(null);
  const router = useRouter();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate profile fields
      if (!fullName || !nic || !dateOfBirth || !address) {
        setError('Please fill in all profile fields');
        setLoading(false);
        return;
      }

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
      const { wallet, address: walletAddress } = await deriveWallet(password, salt);

      // Step 3: Build DID document
      const didDoc = buildDIDDocument(walletAddress, email);
      const didDocHash = hashDIDDocument(didDoc);

      // Step 4: Sign the sessionId as proof of key ownership
      const proofSignature = await wallet.signMessage(sessionId);

      // Step 5: Sign the DID doc hash
      const sigEth = await wallet.signMessage(didDocHash);

      // Step 6: Complete registration with profile data
      const result = await completePasswordRegister({
        sessionId,
        ethAddress: walletAddress,
        didDocJson: didDoc,
        didDocHash,
        proofSignature,
        sigEth,
        // Profile fields
        fullName,
        nic,
        dateOfBirth,
        address,
      });

      // Save token
      if (result.token) {
        localStorage.setItem('dwara_token', result.token);
      }

      setRegistrationResult(result);
    } catch (err) {
      console.error('Registration error:', err);
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
            Decentralized Identity Platform
          </p>
        </div>

        {/* Sign Up Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-semibold text-white mb-6">Create Account</h2>
          
          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Profile Section */}
            <div className="space-y-3 pb-4 border-b border-purple-500/30">
              <h3 className="text-sm font-medium text-purple-300">Personal Information</h3>
              
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-purple-200 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label htmlFor="nic" className="block text-sm font-medium text-purple-200 mb-1">
                  NIC (National ID)
                </label>
                <input
                  type="text"
                  id="nic"
                  value={nic}
                  onChange={(e) => setNic(e.target.value)}
                  placeholder="123456789V"
                  required
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-purple-200 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  id="dateOfBirth"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-purple-200 mb-1">
                  Address
                </label>
                <textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main Street, City, Country"
                  required
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm resize-none"
                />
              </div>
            </div>

            {/* Account Section */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-medium text-purple-300">Account Credentials</h3>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-purple-200 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-purple-200 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-purple-200 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password || !confirmPassword || !fullName || !nic || !dateOfBirth || !address}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                  Creating Identity...
                </span>
              ) : (
                'Create Account'
              )}
            </button>

            <div className="text-xs text-purple-300 space-y-1">
              <p className="text-center">🔒 Your password is never stored - it derives your blockchain identity</p>
              <p className="text-center text-purple-400">
                Min 8 chars, with uppercase, lowercase & number
              </p>
            </div>
          </form>

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
            <p className="text-purple-200 text-sm">Passkey Support</p>
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
