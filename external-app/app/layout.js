import './globals.css';

export const metadata = {
  title: 'Demo App - Login with Dwara',
  description: 'External application demonstrating Dwara OAuth integration',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
