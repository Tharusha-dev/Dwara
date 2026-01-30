'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import { createQRSession } from '../../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LoginPage() {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('waiting'); // waiting, scanning, authenticated
  const router = useRouter();

  useEffect(() => {
    initQRSession();
  }, []);

  const initQRSession = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Create QR session
      const session = await createQRSession();
      setQrData(session);
      
      // Connect to Socket.IO
      const socket = io(API_URL, {
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        console.log('Socket connected');
        socket.emit('join', session.sessionId);
      });

      socket.on('authenticated', (data) => {
        console.log('Authentication successful:', data);
        setStatus('authenticated');
        
        // Save token
        if (data.token) {
          localStorage.setItem('dwara_token', data.token);
        }
        
        // Redirect to dashboard after short delay
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      // Cleanup on unmount
      return () => {
        socket.disconnect();
      };
    } catch (err) {
      console.error('Failed to create QR session:', err);
      setError('Failed to create login session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setQrData(null);
    setStatus('waiting');
    initQRSession();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Login with QR</h1>
            <p className="text-purple-200">
              Scan this QR code with your phone to login
            </p>
          </div>

          {loading && (
            <div className="flex flex-col items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
              <p className="text-purple-200">Creating session...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">❌</div>
              <p className="text-red-300 mb-4">{error}</p>
              <button
                onClick={handleRefresh}
                className="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && qrData && status === 'waiting' && (
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl mb-6">
                <QRCodeSVG
                  value={qrData.url}
                  size={220}
                  level="M"
                  includeMargin={false}
                />
              </div>
              
              <div className="text-center mb-6">
                <p className="text-purple-300 text-sm mb-2">Or open this URL on your phone:</p>
                <code className="text-xs text-purple-200 bg-white/10 px-3 py-1 rounded break-all">
                  {qrData.url}
                </code>
              </div>

              <div className="flex items-center text-purple-200">
                <div className="animate-pulse w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                Waiting for authentication...
              </div>

              <button
                onClick={handleRefresh}
                className="mt-6 text-purple-300 hover:text-purple-100 text-sm underline"
              >
                Generate new QR code
              </button>
            </div>
          )}

          {status === 'authenticated' && (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-white mb-2">Authenticated!</h2>
              <p className="text-purple-200">Redirecting to dashboard...</p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-purple-300 hover:text-purple-100"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
