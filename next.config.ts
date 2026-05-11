import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Avoid flaky parallel webpack workers racing file emits during `next build`
    // (ENOENT on `.nft.json`, rename of `500.html`, missing `./chunks/*.js` → incomplete `.next` → runtime 500.)
    webpackBuildWorker: false,
  },
};

export default nextConfig;
