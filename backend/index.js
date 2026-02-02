require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { PrismaClient } = require('@prisma/client');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json({ limit: '10mb' }));

// Environment variables
const ORIGIN = process.env.ORIGIN || 'http://localhost:3000';
const RP_ID = new URL(ORIGIN).hostname;
const RP_NAME = 'Dwara';
const DWARA_REGISTRY_ADDRESS = process.env.DWARA_REGISTRY_ADDRESS;
const HARDHAT_RPC = process.env.HARDHAT_RPC || 'http://hardhat:8545';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const PORT = process.env.PORT || 4000;

// Blockchain setup
let provider = null;
let relayerWallet = null;

try {
  provider = new ethers.JsonRpcProvider(HARDHAT_RPC);
  if (RELAYER_PRIVATE_KEY) {
    relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    console.log('Relayer wallet configured:', relayerWallet.address);
  }
} catch (err) {
  console.warn('Failed to setup blockchain provider:', err.message);
}

// Helper to convert base64url
function base64urlToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(base64 + padding, 'base64');
}

function bufferToBase64url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Magic link: create a token and return the URL (demo: we will return the link)
 */
app.post('/magic-link', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const token = uuidv4();
    await prisma.session.create({
      data: {
        id: token,
        type: 'magic',
        payload: { email, expiresAt: Date.now() + 10 * 60 * 1000 },
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // In production, send email. For hackathon, return link:
    const link = `${ORIGIN}/onboard?magic=${token}`;
    console.log(`Magic link created for ${email}: ${link}`);
    return res.json({ ok: true, link, token });
  } catch (err) {
    console.error('Magic link error:', err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

/**
 * Validate magic token
 */
app.get('/magic-link/:token', async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.token },
    });
    if (!session || session.type !== 'magic') {
      return res.status(404).json({ error: 'invalid token' });
    }
    if (session.payload.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'token expired' });
    }
    res.json({ ok: true, email: session.payload.email });
  } catch (err) {
    console.error('Magic link validation error:', err);
    res.status(500).json({ error: 'server error' });
  }
});

/**
 * Registration options for WebAuthn
 */
app.post('/webauthn/register/options', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { email } });
    }

    // Check if user already has credentials
    const excludeCredentials = user.credentialId
      ? [
        {
          id: base64urlToBuffer(user.credentialId),
          type: 'public-key',
          transports: ['internal', 'hybrid'],
        },
      ]
      : [];

    const opts = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: user.id,
      userName: email,
      userDisplayName: email,
      timeout: 60000,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        // authenticatorAttachment: 'platform', // Allow both platform and cross-platform
      },
      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    });

    // Save challenge to session
    await prisma.session.create({
      data: {
        id: opts.challenge,
        type: 'webauthn-register',
        payload: { userId: user.id, email },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    console.log(`WebAuthn registration options created for ${email}`);
    res.json(opts);
  } catch (err) {
    console.error('WebAuthn register options error:', err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

/**
 * Verify WebAuthn registration & complete DID registration flow
 */
app.post('/register-did', async (req, res) => {
  try {
    const {
      attestation,
      didDocJson,
      didDocHash,
      ethAddress,
      sigEth,
      encryptedPds,
      challenge,
    } = req.body;

    if (!attestation || !didDocJson || !didDocHash || !ethAddress || !challenge) {
      return res.status(400).json({ error: 'missing required fields' });
    }

    // Verify WebAuthn attestation
    const verification = await verifyRegistrationResponse({
      response: attestation,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'webauthn attestation verification failed' });
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
    const credentialIdStr = bufferToBase64url(credentialID);
    const credentialPubKeyStr = Buffer.from(credentialPublicKey).toString('base64');

    // Verify Ethereum signature over didDocHash (client signed)
    if (sigEth) {
      try {
        const recovered = ethers.verifyMessage(didDocHash, sigEth);
        if (recovered.toLowerCase() !== ethAddress.toLowerCase()) {
          return res.status(400).json({ error: 'ethereum signature mismatch' });
        }
      } catch (sigErr) {
        console.warn('Signature verification failed:', sigErr.message);
      }
    }

    // Update user record
    const user = await prisma.user.upsert({
      where: { email: didDocJson.email },
      update: {
        walletAddress: ethAddress,
        didHash: didDocHash,
        didDocumentJson: didDocJson,
        credentialId: credentialIdStr,
        credentialPubKey: credentialPubKeyStr,
        counter: counter,
        encryptedPDS: encryptedPds || null,
      },
      create: {
        email: didDocJson.email,
        walletAddress: ethAddress,
        didHash: didDocHash,
        didDocumentJson: didDocJson,
        credentialId: credentialIdStr,
        credentialPubKey: credentialPubKeyStr,
        counter: counter,
        encryptedPDS: encryptedPds || null,
      },
    });

    // Clean up the challenge session
    await prisma.session.deleteMany({
      where: { id: challenge },
    });

    // Anchor DID on blockchain via relayer
    let txHash = null;
    if (relayerWallet && DWARA_REGISTRY_ADDRESS) {
      try {
        const contractAbi = [
          'function register(bytes32 didHash, address controller)',
          'event Registered(address indexed controller, bytes32 didHash, uint256 ts)',
        ];
        const contract = new ethers.Contract(
          DWARA_REGISTRY_ADDRESS,
          contractAbi,
          relayerWallet
        );

        // Ensure didDocHash is bytes32 format
        const hashBytes32 = didDocHash.startsWith('0x')
          ? didDocHash
          : '0x' + didDocHash;

        const tx = await contract.register(hashBytes32, ethAddress);
        const receipt = await tx.wait();
        txHash = receipt.hash;
        console.log('DID anchored on chain, tx:', txHash);
      } catch (chainErr) {
        console.warn('Blockchain anchoring failed:', chainErr.message);
      }
    } else {
      console.warn('Relayer not configured; skipping on-chain anchor');
    }

    // Generate JWT token for the user
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        did: `did:dwara:${ethAddress.slice(2, 14).toLowerCase()}`,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      ok: true,
      userId: user.id,
      did: `did:dwara:${ethAddress.slice(2, 14).toLowerCase()}`,
      txHash,
      token,
    });
  } catch (err) {
    console.error('Register DID error:', err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

/**
 * Create QR session for desktop login
 */
app.post('/create-qr-session', async (req, res) => {
  try {
    const { email } = req.body;
    const sessionId = uuidv4();
    const challenge = bufferToBase64url(randomBytes(32));
    const contextNumber = Math.floor(Math.random() * 90) + 10; // 10-99

    await prisma.session.create({
      data: {
        id: sessionId,
        type: 'qr',
        payload: {
          email: email || null,
          challenge,
          status: 'pending',
          contextNumber
        },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const url = `${ORIGIN}/qr/${sessionId}`;
    console.log(`QR session created: ${sessionId}, context: ${contextNumber}`);
    res.json({ sessionId, url, challenge, contextNumber });
  } catch (err) {
    console.error('Create QR session error:', err);
    res.status(500).json({ error: 'server error' });
  }
});

/**
 * Create QR session for desktop SIGNUP (new custom QR flow)
 */
app.post('/create-signup-qr-session', async (req, res) => {
  try {
    const { email, magicToken } = req.body;
    if (!email || !magicToken) {
      return res.status(400).json({ error: 'email and magicToken required' });
    }

    // Validate magic token
    const magicSession = await prisma.session.findUnique({
      where: { id: magicToken },
    });
    if (!magicSession || magicSession.type !== 'magic') {
      return res.status(404).json({ error: 'invalid magic token' });
    }
    if (magicSession.payload.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'magic token expired' });
    }
    if (magicSession.payload.email !== email) {
      return res.status(400).json({ error: 'email mismatch' });
    }

    const sessionId = uuidv4();
    const challenge = bufferToBase64url(randomBytes(32));
    const contextNumber = Math.floor(Math.random() * 90) + 10; // 10-99

    await prisma.session.create({
      data: {
        id: sessionId,
        type: 'signup-qr',
        payload: {
          email,
          magicToken,
          challenge,
          status: 'pending',
          contextNumber
        },
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    const url = `${ORIGIN}/qr/signup/${sessionId}`;
    console.log(`Signup QR session created: ${sessionId}, context: ${contextNumber}`);
    res.json({ sessionId, url, challenge, contextNumber });
  } catch (err) {
    console.error('Create signup QR session error:', err);
    res.status(500).json({ error: 'server error' });
  }
});

/**
 * Get signup QR session info
 */
app.get('/signup-qr/:sessionId', async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId },
    });
    if (!session || session.type !== 'signup-qr') {
      return res.status(404).json({ error: 'session not found' });
    }

    // Generate candidates for context binding
    const correctNumber = session.payload.contextNumber;
    let candidates = [];

    if (correctNumber) {
      const correct = parseInt(correctNumber);
      const decoys = new Set();
      while (decoys.size < 2) {
        const decoy = Math.floor(Math.random() * 90) + 10;
        if (decoy !== correct) decoys.add(decoy);
      }
      candidates = [correct, ...decoys].sort(() => Math.random() - 0.5);
    }

    res.json({
      sessionId: session.id,
      email: session.payload.email,
      challenge: session.payload.challenge,
      status: session.payload.status,
      candidates: candidates.length > 0 ? candidates : undefined
    });
  } catch (err) {
    console.error('Get signup QR session error:', err);
    res.status(500).json({ error: 'server error' });
  }
});

/**
 * Get registration options for signup QR flow (phone requests this)
 */
app.post('/signup-qr/:sessionId/register-options', async (req, res) => {
  try {
    const { contextNumber } = req.body;
    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId },
    });
    if (!session || session.type !== 'signup-qr') {
      return res.status(404).json({ error: 'session not found' });
    }

    // Verify context binding
    if (session.payload.contextNumber) {
      if (!contextNumber || parseInt(contextNumber) !== parseInt(session.payload.contextNumber)) {
        return res.status(400).json({ error: 'Incorrect context number' });
      }
    }

    const email = session.payload.email;

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { email } });
    }

    // Check if user already has credentials
    const excludeCredentials = user.credentialId
      ? [
        {
          id: base64urlToBuffer(user.credentialId),
          type: 'public-key',
          transports: ['internal', 'hybrid'],
        },
      ]
      : [];

    const opts = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: user.id,
      userName: email,
      userDisplayName: email,
      timeout: 60000,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    // Update session with the challenge
    await prisma.session.update({
      where: { id: session.id },
      data: {
        payload: { ...session.payload, challenge: opts.challenge },
      },
    });

    console.log(`Signup QR registration options created for ${email}`);
    res.json(opts);
  } catch (err) {
    console.error('Signup QR register options error:', err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

/**
 * Complete registration from phone (signup QR flow)
 */
app.post('/signup-qr/:sessionId/complete', async (req, res) => {
  try {
    const {
      attestation,
      didDocJson,
      didDocHash,
      ethAddress,
      sigEth,
      encryptedPds,
    } = req.body;

    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId },
    });
    if (!session || session.type !== 'signup-qr') {
      return res.status(404).json({ error: 'session not found' });
    }

    if (!attestation || !didDocJson || !didDocHash || !ethAddress) {
      return res.status(400).json({ error: 'missing required fields' });
    }

    const challenge = session.payload.challenge;

    // Verify WebAuthn attestation
    const verification = await verifyRegistrationResponse({
      response: attestation,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'webauthn attestation verification failed' });
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
    const credentialIdStr = bufferToBase64url(credentialID);
    const credentialPubKeyStr = Buffer.from(credentialPublicKey).toString('base64');

    // Verify Ethereum signature over didDocHash
    if (sigEth) {
      try {
        const recovered = ethers.verifyMessage(didDocHash, sigEth);
        if (recovered.toLowerCase() !== ethAddress.toLowerCase()) {
          return res.status(400).json({ error: 'ethereum signature mismatch' });
        }
      } catch (sigErr) {
        console.warn('Signature verification failed:', sigErr.message);
      }
    }

    // Update user record
    const user = await prisma.user.upsert({
      where: { email: didDocJson.email },
      update: {
        walletAddress: ethAddress,
        didHash: didDocHash,
        didDocumentJson: didDocJson,
        credentialId: credentialIdStr,
        credentialPubKey: credentialPubKeyStr,
        counter: counter,
        encryptedPDS: encryptedPds || null,
      },
      create: {
        email: didDocJson.email,
        walletAddress: ethAddress,
        didHash: didDocHash,
        didDocumentJson: didDocJson,
        credentialId: credentialIdStr,
        credentialPubKey: credentialPubKeyStr,
        counter: counter,
        encryptedPDS: encryptedPds || null,
      },
    });

    // Clean up sessions
    await prisma.session.deleteMany({
      where: { id: { in: [session.id, session.payload.magicToken] } },
    });

    // Anchor DID on blockchain via relayer
    let txHash = null;
    if (relayerWallet && DWARA_REGISTRY_ADDRESS) {
      try {
        const contractAbi = [
          'function register(bytes32 didHash, address controller)',
          'event Registered(address indexed controller, bytes32 didHash, uint256 ts)',
        ];
        const contract = new ethers.Contract(
          DWARA_REGISTRY_ADDRESS,
          contractAbi,
          relayerWallet
        );

        const hashBytes32 = didDocHash.startsWith('0x')
          ? didDocHash
          : '0x' + didDocHash;

        const tx = await contract.register(hashBytes32, ethAddress);
        const receipt = await tx.wait();
        txHash = receipt.hash;
        console.log('DID anchored on chain, tx:', txHash);
      } catch (chainErr) {
        console.warn('Blockchain anchoring failed:', chainErr.message);
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        did: `did:dwara:${ethAddress.slice(2, 14).toLowerCase()}`,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const result = {
      ok: true,
      userId: user.id,
      did: `did:dwara:${ethAddress.slice(2, 14).toLowerCase()}`,
      txHash,
      token,
    };

    // Emit socket event to desktop
    io.to(session.id).emit('signup-complete', result);

    console.log(`Signup QR registration complete for ${user.email}`);
    res.json(result);
  } catch (err) {
    console.error('Signup QR complete error:', err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

/**
 * Get QR session info and challenge
 */
app.get('/qr/:sessionId', async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId },
    });
    if (!session || session.type !== 'qr') {
      return res.status(404).json({ error: 'session not found' });
    }

    // Generate candidates for context binding
    const correctDetails = session.payload.contextNumber;
    let candidates = [];

    if (correctDetails) {
      const correct = parseInt(correctDetails);
      const decoys = new Set();
      while (decoys.size < 2) {
        const decoy = Math.floor(Math.random() * 90) + 10;
        if (decoy !== correct) decoys.add(decoy);
      }
      candidates = [correct, ...decoys].sort(() => Math.random() - 0.5);
    }

    res.json({
      sessionId: session.id,
      challenge: session.payload.challenge,
      status: session.payload.status,
      email: session.payload.email,
      candidates: candidates.length > 0 ? candidates : undefined
    });
  } catch (err) {
    console.error('Get QR session error:', err);
    res.status(500).json({ error: 'server error' });
  }
});

/**
 * Get authentication options for QR login
 */
app.post('/qr/:sessionId/auth-options', async (req, res) => {
  try {
    const { email } = req.body;
    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId },
    });
    if (!session || session.type !== 'qr') {
      return res.status(404).json({ error: 'session not found' });
    }

    // Verify context binding
    const { contextNumber } = req.body;
    if (session.payload.contextNumber) {
      if (!contextNumber || parseInt(contextNumber) !== parseInt(session.payload.contextNumber)) {
        return res.status(400).json({ error: 'Incorrect context number' });
      }
    }

    // If email provided, get user's credential
    let allowCredentials = [];
    if (email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user && user.credentialId) {
        allowCredentials = [
          {
            id: base64urlToBuffer(user.credentialId),
            type: 'public-key',
            transports: ['internal', 'hybrid'],
          },
        ];
      }
    }

    const opts = await generateAuthenticationOptions({
      rpID: RP_ID,
      timeout: 60000,
      allowCredentials,
      userVerification: 'preferred',
      challenge: session.payload.challenge,
    });

    // Update session with generated challenge if different
    await prisma.session.update({
      where: { id: session.id },
      data: {
        payload: { ...session.payload, challenge: opts.challenge, email },
      },
    });

    res.json(opts);
  } catch (err) {
    console.error('Auth options error:', err);
    res.status(500).json({ error: 'server error' });
  }
});

/**
 * Verify assertion from mobile (QR flow)
 */
app.post('/qr/:sessionId/assertion', async (req, res) => {
  try {
    const { assertion, email } = req.body;
    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId },
    });
    if (!session || session.type !== 'qr') {
      return res.status(404).json({ error: 'session not found' });
    }

    // Find user by email or by credential ID from assertion
    let user = null;
    if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    }
    if (!user && assertion.id) {
      // Try to find by credential ID
      user = await prisma.user.findFirst({
        where: { credentialId: assertion.id },
      });
    }

    if (!user || !user.credentialId || !user.credentialPubKey) {
      return res.status(404).json({ error: 'user not found or no credentials' });
    }

    // Verify assertion
    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: session.payload.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: base64urlToBuffer(user.credentialId),
        credentialPublicKey: Buffer.from(user.credentialPubKey, 'base64'),
        counter: user.counter || 0,
      },
    });

    if (!verification.verified) {
      return res.status(400).json({ error: 'assertion verification failed' });
    }

    // Update counter
    await prisma.user.update({
      where: { id: user.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    // Mark session as authenticated
    await prisma.session.update({
      where: { id: session.id },
      data: {
        userId: user.id,
        payload: { ...session.payload, status: 'authenticated' },
      },
    });

    // Generate JWT
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        did: user.walletAddress
          ? `did:dwara:${user.walletAddress.slice(2, 14).toLowerCase()}`
          : null,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Emit socket event to desktop
    io.to(session.id).emit('authenticated', {
      userId: user.id,
      email: user.email,
      token,
    });

    console.log(`QR authentication successful for ${user.email}`);
    res.json({ ok: true, token });
  } catch (err) {
    console.error('Assertion verification error:', err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

/**
 * Get user info by token
 */
app.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        walletAddress: true,
        didHash: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'user not found' });
    }

    res.json({
      ...user,
      did: user.walletAddress
        ? `did:dwara:${user.walletAddress.slice(2, 14).toLowerCase()}`
        : null,
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'invalid token' });
    }
    console.error('Get user error:', err);
    res.status(500).json({ error: 'server error' });
  }
});

// ============================================
// PASSWORD-BASED AUTHENTICATION ENDPOINTS
// ============================================

/**
 * Initialize password-based registration
 * Creates a unique salt for the user and returns it
 * The password is NEVER sent to the server
 */
app.post('/password/register/init', async (req, res) => {
  try {
    const { email, magicToken } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    // Validate magic token if provided
    if (magicToken) {
      const magicSession = await prisma.session.findUnique({
        where: { id: magicToken },
      });
      if (!magicSession || magicSession.type !== 'magic') {
        return res.status(404).json({ error: 'invalid magic token' });
      }
      if (magicSession.payload.expiresAt < Date.now()) {
        return res.status(400).json({ error: 'magic token expired' });
      }
      if (magicSession.payload.email !== email) {
        return res.status(400).json({ error: 'email mismatch' });
      }
    }

    // Check if user already exists with credentials
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.walletAddress) {
      return res.status(400).json({ error: 'user already registered' });
    }

    // Generate a unique salt for this user (32 bytes, base64 encoded)
    const salt = randomBytes(32).toString('base64');

    // Create a session to store the salt and email for the registration flow
    const sessionId = uuidv4();
    await prisma.session.create({
      data: {
        id: sessionId,
        type: 'password-register',
        payload: { email, salt, magicToken },
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    console.log(`Password registration initialized for ${email}`);
    res.json({ sessionId, salt });
  } catch (err) {
    console.error('Password register init error:', err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

/**
 * Complete password-based registration
 * Client sends: derived wallet address, DID doc, and signature proof
 * Password is NEVER transmitted - only the derived public key
 */
app.post('/password/register/complete', async (req, res) => {
  try {
    const {
      sessionId,
      ethAddress,
      didDocJson,
      didDocHash,
      proofSignature, // Signature of sessionId to prove ownership of derived key
      encryptedPds,
    } = req.body;

    if (!sessionId || !ethAddress || !didDocJson || !didDocHash || !proofSignature) {
      return res.status(400).json({ error: 'missing required fields' });
    }

    // Get the registration session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.type !== 'password-register') {
      return res.status(404).json({ error: 'invalid session' });
    }
    if (session.expiresAt < new Date()) {
      return res.status(400).json({ error: 'session expired' });
    }

    const { email, salt, magicToken } = session.payload;

    // Verify the proof signature - client signs the sessionId with their derived key
    // This proves they know the password without revealing it
    try {
      const recovered = ethers.verifyMessage(sessionId, proofSignature);
      if (recovered.toLowerCase() !== ethAddress.toLowerCase()) {
        return res.status(400).json({ error: 'proof signature mismatch - invalid password' });
      }
    } catch (sigErr) {
      console.error('Signature verification failed:', sigErr.message);
      return res.status(400).json({ error: 'invalid proof signature' });
    }

    // Create or update the user with password-based auth
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        walletAddress: ethAddress,
        didHash: didDocHash,
        didDocumentJson: didDocJson,
        passwordSalt: salt,
        authMethod: 'password',
        encryptedPDS: encryptedPds || null,
      },
      create: {
        email,
        walletAddress: ethAddress,
        didHash: didDocHash,
        didDocumentJson: didDocJson,
        passwordSalt: salt,
        authMethod: 'password',
        encryptedPDS: encryptedPds || null,
      },
    });

    // Clean up sessions
    const sessionsToDelete = [sessionId];
    if (magicToken) sessionsToDelete.push(magicToken);
    await prisma.session.deleteMany({
      where: { id: { in: sessionsToDelete } },
    });

    // Anchor DID on blockchain via relayer
    let txHash = null;
    if (relayerWallet && DWARA_REGISTRY_ADDRESS) {
      try {
        const contractAbi = [
          'function register(bytes32 didHash, address controller)',
          'event Registered(address indexed controller, bytes32 didHash, uint256 ts)',
        ];
        const contract = new ethers.Contract(
          DWARA_REGISTRY_ADDRESS,
          contractAbi,
          relayerWallet
        );

        const hashBytes32 = didDocHash.startsWith('0x')
          ? didDocHash
          : '0x' + didDocHash;

        const tx = await contract.register(hashBytes32, ethAddress);
        const receipt = await tx.wait();
        txHash = receipt.hash;
        console.log('DID anchored on chain (password auth), tx:', txHash);
      } catch (chainErr) {
        console.warn('Blockchain anchoring failed:', chainErr.message);
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        did: `did:dwara:${ethAddress.slice(2, 14).toLowerCase()}`,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`Password registration complete for ${email}`);
    res.json({
      ok: true,
      userId: user.id,
      did: `did:dwara:${ethAddress.slice(2, 14).toLowerCase()}`,
      txHash,
      token,
    });
  } catch (err) {
    console.error('Password register complete error:', err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

/**
 * Initialize password-based login
 * Returns the user's salt and a challenge to sign
 */
app.post('/password/login/init', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return generic error to prevent email enumeration
      return res.status(400).json({ error: 'invalid credentials' });
    }
    if (!user.passwordSalt || user.authMethod !== 'password') {
      return res.status(400).json({ error: 'password auth not enabled for this account' });
    }

    // Generate a random challenge
    const challenge = bufferToBase64url(randomBytes(32));
    const sessionId = uuidv4();

    await prisma.session.create({
      data: {
        id: sessionId,
        type: 'password-login',
        payload: { 
          email, 
          challenge, 
          walletAddress: user.walletAddress,
          userId: user.id
        },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });

    console.log(`Password login initialized for ${email}`);
    res.json({ 
      sessionId, 
      salt: user.passwordSalt, 
      challenge 
    });
  } catch (err) {
    console.error('Password login init error:', err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

/**
 * Complete password-based login
 * Client signs the challenge with their password-derived key
 */
app.post('/password/login/complete', async (req, res) => {
  try {
    const { sessionId, signature } = req.body;

    if (!sessionId || !signature) {
      return res.status(400).json({ error: 'missing required fields' });
    }

    // Get the login session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.type !== 'password-login') {
      return res.status(404).json({ error: 'invalid session' });
    }
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: sessionId } });
      return res.status(400).json({ error: 'session expired' });
    }

    const { challenge, walletAddress, userId, email } = session.payload;

    // Verify the signature
    try {
      const recovered = ethers.verifyMessage(challenge, signature);
      if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(400).json({ error: 'invalid password' });
      }
    } catch (sigErr) {
      console.error('Signature verification failed:', sigErr.message);
      return res.status(400).json({ error: 'invalid signature' });
    }

    // Clean up session
    await prisma.session.delete({ where: { id: sessionId } });

    // Get user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'user not found' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        did: user.walletAddress
          ? `did:dwara:${user.walletAddress.slice(2, 14).toLowerCase()}`
          : null,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`Password login successful for ${email}`);
    res.json({ 
      ok: true, 
      token,
      userId: user.id,
      email: user.email,
      did: user.walletAddress
        ? `did:dwara:${user.walletAddress.slice(2, 14).toLowerCase()}`
        : null,
    });
  } catch (err) {
    console.error('Password login complete error:', err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

/**
 * Check if user has password auth enabled
 */
app.get('/auth-method/:email', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { email: req.params.email },
      select: { authMethod: true, credentialId: true }
    });
    
    if (!user) {
      return res.json({ exists: false });
    }
    
    res.json({ 
      exists: true,
      authMethod: user.authMethod || 'passkey',
      hasPasskey: !!user.credentialId,
      hasPassword: user.authMethod === 'password'
    });
  } catch (err) {
    console.error('Auth method check error:', err);
    res.status(500).json({ error: 'server error' });
  }
});

/**
 * Socket.IO connection handler
 */
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join', (sessionId) => {
    socket.join(sessionId);
    console.log(`Socket ${socket.id} joined room ${sessionId}`);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`ORIGIN: ${ORIGIN}`);
  console.log(`RP_ID: ${RP_ID}`);
  console.log(`Hardhat RPC: ${HARDHAT_RPC}`);
  console.log(`Registry Address: ${DWARA_REGISTRY_ADDRESS}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  server.close(() => {
    process.exit(0);
  });
});
