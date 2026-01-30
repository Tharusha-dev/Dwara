/**
 * Client-side encryption utilities using Web Crypto API (AES-GCM)
 */

/**
 * Generate a random 256-bit AES key
 * @returns {Promise<CryptoKey>}
 */
export async function generateAESKey() {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey to base64 string
 * @param {CryptoKey} key
 * @returns {Promise<string>}
 */
export async function exportKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(raw);
}

/**
 * Import a key from base64 string
 * @param {string} base64Key
 * @returns {Promise<CryptoKey>}
 */
export async function importKey(base64Key) {
  const raw = base64ToArrayBuffer(base64Key);
  return await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt an object with AES-GCM
 * @param {Object} obj - Object to encrypt
 * @param {CryptoKey} key - AES key
 * @returns {Promise<{iv: string, ciphertext: string}>}
 */
export async function encryptObject(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

/**
 * Decrypt an encrypted object
 * @param {{iv: string, ciphertext: string}} encrypted
 * @param {CryptoKey} key
 * @returns {Promise<Object>}
 */
export async function decryptObject(encrypted, key) {
  const iv = base64ToArrayBuffer(encrypted.iv);
  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const text = new TextDecoder().decode(decrypted);
  return JSON.parse(text);
}

/**
 * Helper: ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper: base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Download content as a file
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
