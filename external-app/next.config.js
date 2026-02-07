/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_DWARA_API_URL: process.env.NEXT_PUBLIC_DWARA_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_DWARA_ORIGIN: process.env.NEXT_PUBLIC_DWARA_ORIGIN || 'http://localhost:3000',
  },
};

module.exports = nextConfig;
