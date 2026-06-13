/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  transpilePackages: ['react-force-graph-2d', 'three'],
  turbopack: {},
};

module.exports = nextConfig;
