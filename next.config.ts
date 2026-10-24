import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Photo uploads are capped at 5 MB in the grading action; the larger body limit lets oversized photos reach it and get a friendly message.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
