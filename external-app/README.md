# Dwara External App Demo

This is a demo application showcasing the "Login with Dwara" OAuth-like integration.

## What it demonstrates

1. **OAuth-like Flow**: External apps can initiate login using Dwara's decentralized identity
2. **Secure Authentication**: Uses blockchain-based cryptographic verification
3. **Profile Sharing**: Users can authorize apps to access their profile information

## Hard-coded App Configuration

This demo app uses the following hard-coded credentials:

```javascript
const APP_CONFIG = {
  appId: 'demo-external-app-001',
  appName: 'Demo Banking App',
  appDomain: 'http://localhost:3001',  // or production domain
  scopes: ['profile', 'email'],
  icon: '🏦',
};
```

In a production environment, these would be registered with the Dwara system.

## Running locally

```bash
cd external-app
npm install
npm run dev
```

The app will be available at http://localhost:3001

## Integration Flow

1. User clicks "Login with Dwara" button
2. App creates OAuth session with Dwara backend
3. User is redirected to Dwara authorization page
4. User authenticates with their Dwara password
5. User authorizes the app to access their data
6. Dwara redirects back to the app with an authorization code
7. App exchanges the code for user information
8. User is logged in to the external app

## Scopes

Available scopes:
- `email`: Access to user's email address
- `profile`: Access to user's profile (name, NIC, DOB, address, wallet address)

## Security Features

- CSRF protection via state parameter
- PKCE support for additional security
- Authorization codes expire after single use
- All authentication happens on Dwara's secure system
