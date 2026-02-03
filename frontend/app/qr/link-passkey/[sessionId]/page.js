'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { getLinkPasskeySession, getLinkPasskeyRegisterOptions, completeLinkPasskey } from '../../../../lib/api';
import { registerWebAuthn, isWebAuthnSupported } from '../../../../lib/webauthn';

function LinkPasskeyContent({ sessionId }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [webAuthnSupported, setWebAuthnSupported] = useState(true);
  const [step, setStep] = useState('context'); // 'context', 'registering', 'complete'

  useEffect(() => {
    setWebAuthnSupported(isWebAuthnSupported());
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      setLoading(true);
      const data = await getLinkPasskeySession(sessionId);
      setSession(data);
    } catch (err) {
      setError('Invalid or expired session');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkPasskey = async (contextNumber = null) => {
    setRegistering(true);
    setError('');
    setStep('registering');

    try {
      // Step 1: Get registration options from server
      const options = await getLinkPasskeyRegisterOptions(sessionId, contextNumber);

      // Step 2: Create credential with WebAuthn (on phone)
      const attestation = await registerWebAuthn(options);

      // Step 3: Complete linking with backend
      await completeLinkPasskey(sessionId, attestation);

      setSuccess(true);
      setStep('complete');
    } catch (err) {
      console.error('Link passkey error:', err);
      setError(err.message || 'Failed to link passkey. Please try again.');
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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-white mb-2">Passkey Linked!</h2>
            <p className="text-purple-200">
              Your passkey has been successfully linked to your account.
            </p>
          </div>

          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-6">
            <p className="text-green-200 text-sm text-center">
              You can now login using your passkey (biometrics) from this device.
            </p>
          </div>

          <div className="bg-white/5 rounded-lg p-4 text-center">
            <p className="text-purple-300 text-sm">
              You can now close this page. Your desktop will be notified automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">🔑</div>
            <h2 className="text-2xl font-bold text-white mb-2">Link Passkey</h2>
            <p className="text-purple-200">
              Add a passkey to your account for <span className="font-semibold">{session?.email}</span>
            </p>
          </div>

          {/* Context Binding - Select number */}
          {step === 'context' && session?.candidates && (
            <>
              <div className="mb-6">
                <p className="text-purple-300 text-sm text-center mb-4">
                  Select the number shown on your desktop to verify this is a legitimate request:
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {session.candidates.map((num) => (
                    <button
                      key={num}
                      onClick={() => handleLinkPasskey(num)}
                      disabled={registering}
                      className="py-4 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white text-2xl font-bold rounded-lg transition-colors"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm text-center">
                  {error}
                </div>
              )}
            </>
          )}

          {/* No context binding - Direct action */}
          {step === 'context' && !session?.candidates && (
            <>
              <div className="mb-6">
                <p className="text-purple-300 text-sm text-center mb-4">
                  Tap the button below to create your passkey using your device's biometrics.
                </p>
                <button
                  onClick={() => handleLinkPasskey()}
                  disabled={registering}
                  className="w-full py-4 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-semibold rounded-lg transition-colors"
                >
                  {registering ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                      Creating passkey...
                    </span>
                  ) : (
                    '🔑 Create Passkey'
                  )}
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm text-center">
                  {error}
                </div>
              )}
            </>
          )}

          {/* Registering state */}
          {step === 'registering' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-purple-200">Creating your passkey...</p>
              <p className="text-purple-300 text-sm mt-2">Follow the prompts on your device</p>
            </div>
          )}

          {/* Info */}
          <div className="mt-6 pt-6 border-t border-purple-500/30">
            <div className="flex items-start text-purple-300 text-xs">
              <span className="mr-2">ℹ️</span>
              <p>
                A passkey allows you to login quickly using your face, fingerprint, or device PIN instead of your password.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LinkPasskeyPage() {
  const params = useParams();
  
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    }>
      <LinkPasskeyContent sessionId={params.sessionId} />
    </Suspense>
  );
}
