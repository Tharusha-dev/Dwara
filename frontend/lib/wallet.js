import { ethers } from 'ethers';

/**
 * Create a new random Ethereum wallet
 * @returns {{wallet: ethers.Wallet, address: string, mnemonic: string, privateKey: string}}
 */
export function createWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    wallet,
    address: wallet.address,
    mnemonic: wallet.mnemonic?.phrase || '',
    privateKey: wallet.privateKey,
  };
}

/**
 * Restore wallet from mnemonic
 * @param {string} mnemonic
 * @returns {ethers.Wallet}
 */
export function restoreWalletFromMnemonic(mnemonic) {
  return ethers.Wallet.fromPhrase(mnemonic);
}

/**
 * Build a DID document
 * @param {string} address - Ethereum address
 * @param {string} email - User email
 * @returns {Object}
 */
export function buildDIDDocument(address, email) {
  const didId = `did:dwara:${address.slice(2, 14).toLowerCase()}`;
  
  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: didId,
    email: email,
    controller: address,
    verificationMethod: [
      {
        id: `${didId}#key-1`,
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: didId,
        blockchainAccountId: `eip155:1:${address}`,
      },
    ],
    authentication: [`${didId}#key-1`],
    created: new Date().toISOString(),
  };
}

/**
 * Compute keccak256 hash of DID document
 * @param {Object} didDoc
 * @returns {string} - Hex string with 0x prefix
 */
export function hashDIDDocument(didDoc) {
  const jsonStr = JSON.stringify(didDoc);
  return ethers.keccak256(ethers.toUtf8Bytes(jsonStr));
}

/**
 * Sign a message with wallet
 * @param {ethers.Wallet} wallet
 * @param {string} message
 * @returns {Promise<string>} - Signature
 */
export async function signMessage(wallet, message) {
  return await wallet.signMessage(message);
}
