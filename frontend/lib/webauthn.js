import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';

/**
 * Register a new WebAuthn credential
 * @param {Object} options - Registration options from server
 * @returns {Promise<Object>} - Attestation response
 */
export async function registerWebAuthn(options) {
  try {
    const attestation = await startRegistration(options);
    return attestation;
  } catch (error) {
    if (error.name === 'InvalidStateError') {
      throw new Error('Authenticator was probably already registered');
    }
    if (error.name === 'NotAllowedError') {
      throw new Error('Registration was cancelled or timed out');
    }
    throw error;
  }
}

/**
 * Authenticate using WebAuthn
 * @param {Object} options - Authentication options from server
 * @returns {Promise<Object>} - Assertion response
 */
export async function getAssertion(options) {
  try {
    const assertion = await startAuthentication(options);
    return assertion;
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      throw new Error('Authentication was cancelled or timed out');
    }
    throw error;
  }
}

/**
 * Check if WebAuthn is supported
 * @returns {boolean}
 */
export function isWebAuthnSupported() {
  return (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function'
  );
}

/**
 * Check if platform authenticator is available
 * @returns {Promise<boolean>}
 */
export async function isPlatformAuthenticatorAvailable() {
  if (!isWebAuthnSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}
