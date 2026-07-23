import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /\/api\/.*/i,
        handler: "NetworkOnly", // Ensuring sensitive data is never cached
      },
    ],
  },
});

const storageUrl = process.env.S3_PUBLIC_URL ? new URL(process.env.S3_PUBLIC_URL) : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: storageUrl ? [
      {
        protocol: storageUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: storageUrl.hostname,
      }
    ] : [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.supabase.co' }
    ],
  },
  /* config options here */
  turbopack: {},
  allowedDevOrigins: ['10.0.2.2', 'localhost', '192.168.1.147', '192.168.1.191', '127.0.0.1'],
};

export default withPWA(nextConfig);
