# Dwara MVP - Decentralized Identity with Passkeys

A decentralized identity system using WebAuthn passkeys, Ethereum wallet, and blockchain anchoring.

## 🌟 Features

- **Passwordless Authentication**: Uses WebAuthn/Passkeys (Face ID, Touch ID, Windows Hello)
- **Password-based Authentication**: Also supports traditional password login with blockchain-derived keys
- **Decentralized Identity (DID)**: Creates and manages DIDs anchored on blockchain
- **QR Code Login**: Custom relay-based flow with **Phishing-resistant Context Binding**
- **Client-Side Encryption**: All PII is encrypted with AES-GCM before upload
- **Blockchain Anchoring**: DID document hashes are stored on a local Hardhat chain
- **Real-time Updates**: Socket.IO for instant authentication notifications
- **Profile Management**: Full name, NIC, date of birth, and address
- **OAuth-like Integration**: "Login with Dwara" for external applications
- **Linked Apps Management**: Track and revoke access to connected applications
- **Login History**: Security tracking with device, browser, and location info

## 🔐 External App Integration (Login with Dwara)

Dwara supports OAuth-like authentication for external applications. This allows third-party apps to authenticate users using their Dwara identity.

### How it works:

1. External app initiates OAuth session with Dwara
2. User is redirected to Dwara's authorization page
3. User authenticates with their Dwara credentials
4. User authorizes the app to access their profile
5. App receives an authorization code
6. App exchanges the code for user information

### Demo App

A demo "Banking App" is included in the `/external-app` directory, showcasing the integration:

```bash
# Run with Docker
docker compose up external-app

# Or run locally
cd external-app && npm install && npm run dev
# Available at http://localhost:3001
```

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Backend     │────▶│    Hardhat      │
│   (Next.js)     │     │   (Express)     │     │   (Ethereum)    │
│   Port 3000     │     │   Port 4000     │     │   Port 8545     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                          │
        │               ┌───────┴───────┐                  │
        │               ▼               ▼                  ▼
        │       ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐
        │       │ PostgreSQL  │  │   OAuth     │  │   Blockscout    │
        │       │ Port 5432   │  │   System    │  │   Port 4001     │
        │       └─────────────┘  └─────────────┘  └─────────────────┘
        │
        ▼
┌─────────────────┐
│  External App   │
│   (Demo App)    │
│   Port 3001     │
└─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js >= 18 (for local development)
- Git

### Running with Docker Compose

1. **Clone and setup**:
   ```bash
   git clone <repo-url>
   cd dwara-mvp
   ```

2. **Start all services**:
   ```bash
   docker compose up --build
   ```

3. **Deploy the smart contract** (in a new terminal):
   ```bash
   docker compose exec hardhat npx hardhat run --network localhost scripts/deploy.js
   ```
   
   Copy the deployed contract address and update `DWARA_REGISTRY_ADDRESS` in your environment if different from the default.

4. **Run database migrations**:
   ```bash
   docker compose exec backend npx prisma migrate dev --name init
   ```

5. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000
   - Blockscout Explorer: http://localhost:4001
   - Hardhat JSON-RPC: http://localhost:8545

### Local Development (without Docker)

1. **Install dependencies**:
   ```bash
   # Backend
   cd backend && npm install
   
   # Frontend
   cd frontend && npm install
   
   # Hardhat
   cd hardhat && npm install
   ```

2. **Start Hardhat node**:
   ```bash
   cd hardhat
   npx hardhat node
   ```

3. **Deploy contract**:
   ```bash
   cd hardhat
   npx hardhat run --network localhost scripts/deploy.js
   ```

4. **Setup database** (requires PostgreSQL running):
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your database URL
   npx prisma migrate dev
   ```

5. **Start backend**:
   ```bash
   cd backend
   npm run dev
   ```

6. **Start frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

## 📋 Environment Variables

### Backend (.env)

```env
DATABASE_URL=postgresql://app:pass@localhost:5432/dwara
HARDHAT_RPC=http://localhost:8545
DWARA_REGISTRY_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
RELAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
JWT_SECRET=your_secret_here
ORIGIN=http://localhost:3000
PORT=4000
```

### Frontend (.env)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## 🔍 Blockchain Explorer (Blockscout)

Blockscout is included to provide a web interface for exploring the local Hardhat blockchain:

- **URL**: http://localhost:4001
- **Features**:
  - View all transactions and blocks
  - Explore contract interactions
  - See DID registration events
  - Monitor account balances and activities

Once you deploy the DwaraRegistry contract and register DIDs, you can:
1. Search for the contract address in Blockscout
2. View the `Registered` events when users sign up
3. Explore transaction details and gas usage

## ⛓️ Blockchain Integration

Dwara uses a hybrid architecture where identity control is decentralized, but user experience is streamlined via a relayer.

### Smart Contract: DwaraRegistry
The core is a minimal Solidity contract (`DwaraRegistry.sol`) deployed on a local Hardhat network (Ethereum compatible).
- **Mapping**: Stores `address => bytes32` (Controller Address -> DID Document Hash).
- **Immutability**: Once registered, the DID hash serves as a timestamped proof of existence.

### Anchoring Process (Gasless)
1. **User Action**: User generates a DID Document client-side and signs it with their Ethereum wallet.
2. **Off-Chain Relay**: The signature and data are sent to the backend.
3. **On-Chain Transaction**: The backend (acting as a Relayer) validates the signature and submits the transaction to the blockchain, paying the gas fees.
4. **Result**: The user gets a decentralized identity without needing to hold ETH.

### Data Privacy
- **On-Chain**: Only the **Hash** of the DID Document is stored. No PII is ever visible on the blockchain.
- **Off-Chain**: The encrypted DID Document is stored in the application database (PostgreSQL), accessible only by the user's keys.

## 🔄 User Flows

### Sign Up Flow

1. User enters email on homepage
2. Server creates magic link (displayed for demo)
3. User clicks link → arrives at onboarding page
4. WebAuthn creates passkey (biometric prompt)
5. Client generates Ethereum wallet
6. Client builds DID document and signs with wallet
7. Server verifies attestation and anchors DID on blockchain
8. User downloads backup (mnemonic + encryption key)

### QR Login Flow (Custom w/ Context Binding)

1. **Desktop** initiates session: Displays unique QR code AND a **2-digit Context Number**.
2. **Mobile** scans QR: Opens the secure authentication page.
3. **Context Binding**: Mobile displays 3 candidate numbers. User must tap the number that matches the one shown on Desktop.
   - *This proves user presence and prevents phishing (remote attackers can't see the desktop screen).*
4. **Authentication**: After correct match, Mobile prompts for WebAuthn (Face ID / Touch ID).
5. **Completion**: Server verifies signature and notifies Desktop via Socket.IO.
6. **Desktop** automatically logs in.

## 🔐 Security Notes

- **No passwords stored**: Authentication is via WebAuthn passkeys only
- **Context Binding**: QR flow requires number matching to ensure the user is physically present at the screen, preventing remote phishing attacks.
- **Client-side encryption**: PII is encrypted with AES-GCM before upload
- **Recovery**: Users must backup their wallet mnemonic and encryption key
- **Relayer**: The backend uses a funded account to pay gas for DID anchoring

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS
- **Backend**: Node.js, Express, Socket.IO, Prisma
- **Database**: PostgreSQL
- **Blockchain**: Hardhat (local Ethereum)
- **Authentication**: @simplewebauthn/browser & @simplewebauthn/server
- **Wallet**: ethers.js

## 📁 Project Structure

```
dwara-mvp/
├── frontend/          # Next.js 14 app
│   ├── app/          # App router pages
│   └── lib/          # Utilities (api, webauthn, crypto, wallet)
├── backend/          # Express server
│   └── index.js      # Main server file
├── hardhat/          # Smart contracts
│   ├── contracts/    # Solidity contracts
│   └── scripts/      # Deploy scripts
├── prisma/           # Database schema
├── external-app/     # Demo external app for OAuth-like integration
└── docker-compose.yml
```

## 🧪 Demo Script

1. Open http://localhost:3000
2. Enter email and click "Sign Up with Passkey"
3. Click the magic link
4. Complete passkey creation (biometric prompt)
5. Download your backup file
6. Go to dashboard
7. Open login page in another browser/incognito
8. Scan QR with your phone
9. Authenticate with passkey on phone
10. Watch desktop auto-login!

## ⚠️ Known Limitations

- WebAuthn requires HTTPS in production (works on localhost for dev)
- Magic links are displayed (not emailed) for demo purposes
- Single relayer account for gas payments
- Local Hardhat chain (not production blockchain)

## 📄 License

MIT
