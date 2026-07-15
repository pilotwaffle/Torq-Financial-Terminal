/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // No .eslintrc was recovered with the source; skip lint during production
  // builds so a missing config can't fail the deploy. Type-checking (tsc) still runs.
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
