'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { validateMagicToken, getRegistrationOptions, registerDID } from '../../lib/api';
import { registerWebAuthn, isWebAuthnSupported, isPlatformAuthenticatorAvailable } from '../../lib/webauthn';
import { createWallet, buildDIDDocument, hashDIDDocument, signMessage } from '../../lib/wallet';
import { generateAESKey, exportKey, encryptObject, downloadFile } from '../../lib/crypto';

function OnboardContent() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletInfo, setWalletInfo] = useState(null);
  const [didInfo, setDidInfo] = useState(null);
  const [registrationResult, setRegistrationResult] = useState(null);
  const [webAuthnSupported, setWebAuthnSupported] = useState(true);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const magicToken = searchParams.get('magic');

  useEffect(() => {
    checkWebAuthnSupport();
    if (magicToken) {
      validateToken();
    }
  }, [magicToken]);

  const checkWebAuthnSupport = async () => {
    const supported = isWebAuthnSupported();
    // Allow if WebAuthn is supported, even if platform authenticator (TouchID/FaceID)
    // is not explicitly detected (allows roaming authenticators like YubiKeys)
    setWebAuthnSupported(supported);
  };

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

  const handleCreatePasskey = async () => {
    setLoading(true);
    setError('');

    try {
      // Step 1: Get registration options from server
      const options = await getRegistrationOptions(email);
      
      // Step 2: Create credential with WebAuthn
      const attestation = await registerWebAuthn(options);
      
      // Step 3: Create Ethereum wallet
      const wallet = createWallet();
      setWalletInfo(wallet);
      
      // Step 4: Build and sign DID document
      const didDoc = buildDIDDocument(wallet.address, email);
      const didHash = hashDIDDocument(didDoc);
      const sigEth = await signMessage(wallet.wallet, didHash);
      
      setDidInfo({ didDoc, didHash, sigEth });
      
      // Step 5: Generate encryption key and encrypt PDS
      const aesKey = await generateAESKey();
      const exportedKey = await exportKey(aesKey);
      const pdsData = {
        email,
        createdAt: new Date().toISOString(),
        preferences: {},
      };
      const encryptedPds = await encryptObject(pdsData, aesKey);
      
      // Step 6: Register DID with backend
      const result = await registerDID({
        attestation,
        didDocJson: didDoc,
        didDocHash: didHash,
        ethAddress: wallet.address,
        sigEth,
        encryptedPds: JSON.stringify(encryptedPds),
        challenge: options.challenge,
      });
      
      // Save token
      if (result.token) {
        localStorage.setItem('dwara_token', result.token);
      }
      
      setRegistrationResult({
        ...result,
        mnemonic: wallet.mnemonic,
        encryptionKey: exportedKey,
      });
      
      setStep(2);
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = () => {
    if (!registrationResult) return;
    
    const backup = {
      did: registrationResult.did,
      mnemonic: registrationResult.mnemonic,
      encryptionKey: registrationResult.encryptionKey,
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

  if (!webAuthnSupported) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-4">WebAuthn Not Supported</h2>
          <p className="text-purple-200">
            Your browser or device doesn't support passkeys. Please use a modern browser
            with biometric authentication (Face ID, Touch ID, Windows Hello, etc.)
          </p>
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

        {/* Step 1: Create Passkey */}
        {step === 1 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">🔑</div>
              <h2 className="text-2xl font-bold text-white">Create Your Passkey</h2>
              <p className="text-purple-200 mt-2">
                Welcome, <span className="font-semibold">{email}</span>
              </p>
            </div>

            <div className="space-y-4 text-purple-200 mb-6">
              <p>When you click the button below, we will:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Create a secure passkey using your device's biometrics</li>
                <li>Generate a new Ethereum wallet for your identity</li>
                <li>Create your decentralized identity (DID) document</li>
                <li>Anchor your DID on the blockchain</li>
              </ul>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleCreatePasskey}
              disabled={loading}
              className="w-full py-4 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-semibold rounded-lg transition-colors duration-200 text-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                  Creating identity...
                </span>
              ) : (
                'Create Passkey & Identity'
              )}
            </button>
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
