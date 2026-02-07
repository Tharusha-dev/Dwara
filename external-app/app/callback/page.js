'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const DWARA_API_URL = process.env.NEXT_PUBLIC_DWARA_API_URL || 'http://localhost:4000';

// Hard-coded app credentials (same as in page.js)
const APP_CONFIG = {
  appId: 'demo-external-app-001',
  appName: 'Demo Banking App',
};

function CallbackContent() {
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        throw new Error(errorParam);
      }

      if (!code) {
        throw new Error('No authorization code received');
      }

      // Verify state matches what we stored (CSRF protection)
      const storedState = localStorage.getItem('oauth_state');
      if (state && storedState && state !== storedState) {
        throw new Error('State mismatch - possible CSRF attack');
      }

      // Clear stored state
      localStorage.removeItem('oauth_state');

      // Exchange authorization code for user info
      const response = await fetch(`${DWARA_API_URL}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          appId: APP_CONFIG.appId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to exchange authorization code');
      }

      const data = await response.json();

      // Store user data and token
      localStorage.setItem('demo_app_user', JSON.stringify(data.user));
      localStorage.setItem('demo_app_token', data.access_token);

      setStatus('success');

      // Redirect to home page after short delay
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err) {
      console.error('OAuth callback error:', err);
      setError(err.message || 'Authentication failed');
      setStatus('error');
    }
  };

  if (status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Authenticating...</h2>
          <p className="text-blue-200">Verifying your Dwara identity</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-6xl mb-6">✅</div>
          <h2 className="text-2xl font-bold text-white mb-2">Authentication Successful!</h2>
          <p className="text-blue-200">Redirecting to the application...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl text-center">
          <div className="text-6xl mb-6">❌</div>
          <h2 className="text-2xl font-bold text-white mb-2">Authentication Failed</h2>
          <p className="text-red-300 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
