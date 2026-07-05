import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained production server for the anton deploy (see deploy/README.md).
  // Build emits .next/standalone/server.js; static assets are copied in by deploy.sh.
  output: "standalone",
};

export default nextConfig;
