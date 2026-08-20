/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'khabardarjeeling.in',
        pathname: '/api/image-proxy**',
      },
      {
        protocol: 'https',
        hostname: 'api.khabardarjeeling.in',
        pathname: '/v1/storage/**',
      },
      {
        protocol: 'https',
        hostname: 'api.khabardarjeeling.space',
        pathname: '/v1/storage/**',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/**',
      },
      {
        // Cloudflare migration, Week 2 (see cloudflare/README.md): article
        // images now served from the Worker's R2-backed CDN route.
        protocol: 'https',
        hostname: 'khabar-worker.limbunowan1234.workers.dev',
        pathname: '/cdn/**',
      },
    ],
  },
};
module.exports = nextConfig;
