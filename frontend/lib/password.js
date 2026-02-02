import { ethers } from 'ethers';

/**
 * Password-based key derivation for blockchain authentication
 * 
 * This module derives an Ethereum private key from a password + salt combination.
 * The password is NEVER sent to the server - only cryptographic proofs are transmitted.
 * 
 * Security properties:
 * - Uses scrypt (via PBKDF2 fallback) for key derivation - resistant to brute force
 * - Unique salt per user prevents rainbow table attacks
 * - Server only stores public address, never the password or derived key
 * - Authentication is done via signature verification
 */

// PBKDF2 parameters - high iteration count for security
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits for Ethereum private key

/**
 * Derive an Ethereum private key from password and salt using PBKDF2
 * @param {string} password - User's password
 * @param {string} salt - Unique salt (base64 encoded, provided by server)
 * @returns {Promise<string>} - Hex-encoded private key (with 0x prefix)
 */
export async function derivePrivateKey(password, salt) {
  // Convert password to bytes
  const passwordBytes = new TextEncoder().encode(password);
  
  // Decode salt from base64
  const saltBytes = base64ToUint8Array(salt);
  
  // Import password as CryptoKey for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  // Derive 256 bits using PBKDF2-SHA256
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8 // bits
  );
  
  // Convert to hex string with 0x prefix
  const privateKey = '0x' + uint8ArrayToHex(new Uint8Array(derivedBits));
  
  return privateKey;
}

/**
 * Derive an Ethereum wallet from password and salt
 * @param {string} password - User's password
 * @param {string} salt - Unique salt (base64 encoded)
 * @returns {Promise<{wallet: ethers.Wallet, address: string, privateKey: string}>}
 */
export async function deriveWallet(password, salt) {
  const privateKey = await derivePrivateKey(password, salt);
  const wallet = new ethers.Wallet(privateKey);
  
  return {
    wallet,
    address: wallet.address,
    privateKey,
  };
}

/**
 * Generate a cryptographic challenge response for authentication
 * Signs the challenge with the password-derived key
 * @param {string} password - User's password
 * @param {string} salt - User's salt
 * @param {string} challenge - Server-provided challenge (random string)
 * @returns {Promise<{signature: string, address: string}>}
 */
export async function signChallenge(password, salt, challenge) {
  const { wallet, address } = await deriveWallet(password, salt);
  const signature = await wallet.signMessage(challenge);
  
  return { signature, address };
}

/**
 * Validate password strength
 * @param {string} password
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validatePassword(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a random salt for a new user
 * @returns {string} - Base64 encoded salt
 */
export function generateSalt() {
  const saltBytes = crypto.getRandomValues(new Uint8Array(32));
  return uint8ArrayToBase64(saltBytes);
}

// Helper: Uint8Array to hex string
function uint8ArrayToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Base64 to Uint8Array
function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Helper: Uint8Array to Base64
function uint8ArrayToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
