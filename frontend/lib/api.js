import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('dwara_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Magic link
export const requestMagicLink = async (email) => {
  const response = await api.post('/magic-link', { email });
  return response.data;
};

export const validateMagicToken = async (token) => {
  const response = await api.get(`/magic-link/${token}`);
  return response.data;
};

// WebAuthn registration
export const getRegistrationOptions = async (email) => {
  const response = await api.post('/webauthn/register/options', { email });
  return response.data;
};

export const registerDID = async (data) => {
  const response = await api.post('/register-did', data);
  return response.data;
};

// QR Session
export const createQRSession = async (email) => {
  const response = await api.post('/create-qr-session', { email });
  return response.data;
};

export const getQRSession = async (sessionId) => {
  const response = await api.get(`/qr/${sessionId}`);
  return response.data;
};

export const getAuthOptions = async (sessionId, email, contextNumber) => {
  const response = await api.post(`/qr/${sessionId}/auth-options`, {
    email,
    contextNumber
  });
  return response.data;
};

export const submitAssertion = async (sessionId, assertion, email) => {
  const response = await api.post(`/qr/${sessionId}/assertion`, {
    assertion,
    email,
  });
  return response.data;
};

// Signup QR Session (custom QR flow for registration)
export const createSignupQRSession = async (email, magicToken) => {
  const response = await api.post('/create-signup-qr-session', { email, magicToken });
  return response.data;
};

export const getSignupQRSession = async (sessionId) => {
  const response = await api.get(`/signup-qr/${sessionId}`);
  return response.data;
};

export const getSignupRegisterOptions = async (sessionId, contextNumber) => {
  const response = await api.post(`/signup-qr/${sessionId}/register-options`, { contextNumber });
  return response.data;
};

export const completeSignupQR = async (sessionId, data) => {
  const response = await api.post(`/signup-qr/${sessionId}/complete`, data);
  return response.data;
};

// User
export const getCurrentUser = async () => {
  const response = await api.get('/me');
  return response.data;
};
