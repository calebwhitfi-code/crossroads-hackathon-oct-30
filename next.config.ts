import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Photo uploads are capped at 5 MB in the grading action; leave room for form overhead.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
