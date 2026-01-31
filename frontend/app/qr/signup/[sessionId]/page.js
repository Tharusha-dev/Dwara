'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { getSignupQRSession, getSignupRegisterOptions, completeSignupQR } from '../../../../lib/api';
import { registerWebAuthn, isWebAuthnSupported } from '../../../../lib/webauthn';
import { createWallet, buildDIDDocument, hashDIDDocument, signMessage } from '../../../../lib/wallet';
import { generateAESKey, exportKey, encryptObject } from '../../../../lib/crypto';

function SignupQRContent({ sessionId }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState(null);
  const [webAuthnSupported, setWebAuthnSupported] = useState(true);
  const [step, setStep] = useState('context'); // 'context', 'registering', 'complete'

  useEffect(() => {
    setWebAuthnSupported(isWebAuthnSupported());
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      setLoading(true);
      const data = await getSignupQRSession(sessionId);
      setSession(data);
    } catch (err) {
      setError('Invalid or expired session');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (contextNumber = null) => {
    setRegistering(true);
    setError('');
    setStep('registering');

    try {
      // Step 1: Get registration options from server
      const options = await getSignupRegisterOptions(sessionId, contextNumber);

      // Step 2: Create credential with WebAuthn (on phone)
      const attestation = await registerWebAuthn(options);

      // Step 3: Create Ethereum wallet
      const wallet = createWallet();

      // Step 4: Build and sign DID document
      const didDoc = buildDIDDocument(wallet.address, session.email);
      const didHash = hashDIDDocument(didDoc);
      const sigEth = await signMessage(wallet.wallet, didHash);

      // Step 5: Generate encryption key and encrypt PDS
      const aesKey = await generateAESKey();
      const exportedKey = await exportKey(aesKey);
      const pdsData = {
        email: session.email,
        createdAt: new Date().toISOString(),
        preferences: {},
      };
      const encryptedPds = await encryptObject(pdsData, aesKey);

      // Step 6: Complete registration with backend
      const registrationResult = await completeSignupQR(sessionId, {
        attestation,
        didDocJson: didDoc,
        didDocHash: didHash,
        ethAddress: wallet.address,
        sigEth,
        encryptedPds: JSON.stringify(encryptedPds),
      });

      setResult({
        ...registrationResult,
        mnemonic: wallet.mnemonic,
        encryptionKey: exportedKey,
      });
      setSuccess(true);
      setStep('complete');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
      setStep('context');
    } finally {
      setRegistering(false);
    }
  };

  if (!webAuthnSupported) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-4">WebAuthn Not Supported</h2>
          <p className="text-purple-200">
            Your device doesn't support passkeys. Please use a device with biometric authentication (Face ID, Touch ID, etc.)
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

  if (error && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-white mb-4">Session Error</h2>
          <p className="text-purple-200">{error}</p>
        </div>
      </div>
    );
  }

  if (success && result) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-white mb-2">Identity Created!</h2>
            <p className="text-purple-200">
              Your passkey and identity have been set up successfully.
            </p>
          </div>

          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <div className="text-sm text-purple-300 mb-1">Your DID</div>
            <div className="font-mono text-white text-sm break-all">
              {result.did}
            </div>
          </div>

          {result.txHash && (
            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <div className="text-sm text-purple-300 mb-1">Blockchain Transaction</div>
              <div className="font-mono text-green-400 text-xs break-all">
                {result.txHash}
              </div>
            </div>
          )}

          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <span className="text-2xl mr-3">⚠️</span>
              <div>
                <p className="text-yellow-200 font-semibold text-sm">Important</p>
                <p className="text-yellow-200/80 text-xs mt-1">
                  Return to your desktop to download your backup file and complete the setup.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center text-purple-200 text-sm">
            <p>You can now close this page and return to your desktop.</p>
          </div>
        </div>
      </div>
    );
  }

  if (session?.status === 'authenticated' || session?.status === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-white mb-4">Already Completed</h2>
          <p className="text-purple-200">
            This signup session has already been completed.
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
            <h1 className="text-2xl font-bold text-white mb-2">Create Your Passkey</h1>
            <p className="text-purple-200">
              Setting up identity for <span className="font-semibold">{session?.email}</span>
            </p>
          </div>

          {step === 'registering' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-purple-200">Creating your identity...</p>
              <p className="text-purple-300 text-sm mt-2">Please complete the biometric prompt</p>
            </div>
          )}

          {step === 'context' && session?.candidates && session.candidates.length > 0 && (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-purple-200 mb-3 text-center">
                  Tap the number shown on your desktop
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {session.candidates.map((num) => (
                    <button
                      key={num}
                      onClick={() => handleRegister(num)}
                      disabled={registering}
                      className="aspect-square flex items-center justify-center text-2xl font-bold bg-white/5 hover:bg-white/20 border border-purple-500/30 rounded-xl text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:bg-purple-600"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-center text-purple-300 text-sm">
                <p>After selecting the correct number, your device will prompt you to verify your identity using Face ID, Touch ID, or another biometric.</p>
              </div>
            </>
          )}

          {step === 'context' && (!session?.candidates || session.candidates.length === 0) && (
            <>
              <button
                onClick={() => handleRegister()}
                disabled={registering}
                className="w-full py-4 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                {registering ? (
                  <span className="flex items-center justify-center">
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                    Creating...
                  </span>
                ) : (
                  '🔑 Create Passkey & Identity'
                )}
              </button>

              <p className="mt-4 text-center text-purple-300 text-sm">
                Your device will prompt you to verify your identity using Face ID, Touch ID, or another biometric.
              </p>
            </>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SignupQRPage({ params }) {
  const { sessionId } = params;

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    }>
      <SignupQRContent sessionId={sessionId} />
    </Suspense>
  );
}
