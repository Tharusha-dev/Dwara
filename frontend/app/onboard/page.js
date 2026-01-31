'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import { validateMagicToken, createSignupQRSession } from '../../lib/api';
import { downloadFile } from '../../lib/crypto';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function OnboardContent() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrData, setQrData] = useState(null);
  const [registrationResult, setRegistrationResult] = useState(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const magicToken = searchParams.get('magic');

  useEffect(() => {
    if (magicToken) {
      validateToken();
    }
  }, [magicToken]);

  const validateToken = async () => {
    try {
      setLoading(true);
      const result = await validateMagicToken(magicToken);
      setEmail(result.email);
      setStep(1);
    } catch (err) {
      setError('Invalid or expired magic link. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  const initSignupQRSession = async () => {
    try {
      setLoading(true);
      setError('');

      // Create signup QR session
      const session = await createSignupQRSession(email, magicToken);
      setQrData(session);

      // Connect to Socket.IO
      const socketUrl = API_URL.replace(/\/api\/?$/, '');
      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        console.log('Socket connected');
        socket.emit('join', session.sessionId);
      });

      socket.on('signup-complete', (data) => {
        console.log('Signup completed:', data);
        
        // Save token
        if (data.token) {
          localStorage.setItem('dwara_token', data.token);
        }

        setRegistrationResult(data);
        setStep(2);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      // Cleanup on unmount
      return () => {
        socket.disconnect();
      };
    } catch (err) {
      console.error('Failed to create signup QR session:', err);
      setError(err.response?.data?.error || 'Failed to create signup session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleShowQR = () => {
    initSignupQRSession();
  };

  const handleRefreshQR = () => {
    setQrData(null);
    initSignupQRSession();
  };

  const handleDownloadBackup = () => {
    if (!registrationResult) return;
    
    const backup = {
      did: registrationResult.did,
      // Note: mnemonic and encryptionKey are now created on phone
      // User should save them from phone or we need to transfer them securely
      createdAt: new Date().toISOString(),
      warning: 'KEEP THIS FILE SECURE! Anyone with this file can access your identity.',
    };
    
    downloadFile(
      JSON.stringify(backup, null, 2),
      `dwara-backup-${Date.now()}.json`,
      'application/json'
    );
  };

  const handleComplete = () => {
    router.push('/dashboard');
  };

  if (loading && step === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-purple-200">Validating magic link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step >= s - 1
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-purple-300'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`w-16 h-1 ${
                    step >= s ? 'bg-purple-600' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Show QR Code for Phone Registration */}
        {step === 1 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">🔑</div>
              <h2 className="text-2xl font-bold text-white">Create Your Passkey</h2>
              <p className="text-purple-200 mt-2">
                Welcome, <span className="font-semibold">{email}</span>
              </p>
            </div>

            {!qrData ? (
              <>
                <div className="space-y-4 text-purple-200 mb-6">
                  <p>To create your identity, you'll need to:</p>
                  <ul className="list-disc list-inside space-y-2 text-sm">
                    <li>Scan a QR code with your phone</li>
                    <li>Create a secure passkey using your phone's biometrics (Face ID, Touch ID)</li>
                    <li>Your identity will be anchored on the blockchain</li>
                  </ul>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleShowQR}
                  disabled={loading}
                  className="w-full py-4 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-semibold rounded-lg transition-colors duration-200 text-lg"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                      Creating session...
                    </span>
                  ) : (
                    'Show QR Code'
                  )}
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-xl mb-6">
                  <QRCodeSVG
                    value={qrData.url}
                    size={220}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                <div className="text-center mb-4">
                  <p className="text-purple-300 text-sm">Scan this QR code with your phone's camera</p>
                </div>

                {qrData.contextNumber && (
                  <div className="bg-purple-900/50 p-4 rounded-xl mb-6 border border-purple-500/30 w-full">
                    <p className="text-purple-300 text-sm mb-1 text-center">Security Check</p>
                    <p className="text-4xl font-bold text-white tracking-widest text-center">{qrData.contextNumber}</p>
                    <p className="text-purple-300 text-xs mt-1 text-center">Select this number on your phone</p>
                  </div>
                )}

                <div className="flex items-center text-purple-200 mb-4">
                  <div className="animate-pulse w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                  Waiting for phone registration...
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm w-full">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleRefreshQR}
                  className="text-purple-300 hover:text-purple-100 text-sm underline"
                >
                  Generate new QR code
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Backup & Complete */}
        {step === 2 && registrationResult && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-white">Identity Created!</h2>
              <p className="text-purple-200 mt-2">
                Your decentralized identity is ready
              </p>
            </div>

            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <div className="text-sm text-purple-300 mb-1">Your DID</div>
              <div className="font-mono text-white text-sm break-all">
                {registrationResult.did}
              </div>
            </div>

            {registrationResult.txHash && (
              <div className="bg-white/5 rounded-lg p-4 mb-6">
                <div className="text-sm text-purple-300 mb-1">Blockchain Transaction</div>
                <div className="font-mono text-green-400 text-xs break-all">
                  {registrationResult.txHash}
                </div>
              </div>
            )}

            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <span className="text-2xl mr-3">⚠️</span>
                <div>
                  <p className="text-yellow-200 font-semibold">Important: Download Your Backup</p>
                  <p className="text-yellow-200/80 text-sm mt-1">
                    This backup contains your recovery phrase and encryption key. 
                    Store it securely - you'll need it to recover your identity.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleDownloadBackup}
                className="w-full py-3 px-4 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                📥 Download Backup File
              </button>

              <button
                onClick={handleComplete}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                Continue to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* No magic token */}
        {!magicToken && step === 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🔗</div>
            <h2 className="text-2xl font-bold text-white mb-4">Invalid Link</h2>
            <p className="text-purple-200 mb-6">
              This page requires a valid magic link. Please request one from the home page.
            </p>
            <button
              onClick={() => router.push('/')}
              className="py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg"
            >
              Go to Home
            </button>
          </div>
        )}

        {error && step === 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-white mb-4">Link Error</h2>
            <p className="text-purple-200 mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg"
            >
              Request New Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    }>
      <OnboardContent />
    </Suspense>
  );
}
