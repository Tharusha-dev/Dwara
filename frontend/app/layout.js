import './globals.css';

export const metadata = {
  title: 'Dwara - Decentralized Identity',
  description: 'Secure, decentralized identity verification with WebAuthn and blockchain',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
