import { randomUUID } from 'node:crypto';
import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? randomUUID();

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  additionalPrecacheEntries: [{ url: '/~offline', revision }],
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withSerwist(nextConfig);
