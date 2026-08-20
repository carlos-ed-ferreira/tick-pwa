import { randomUUID } from 'node:crypto';
import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? randomUUID();

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  additionalPrecacheEntries: ['/', '/calendar', '/goals', '/~offline'].map(
    (url) => ({ url, revision }),
  ),
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: false,
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
