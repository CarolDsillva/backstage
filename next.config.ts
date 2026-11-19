import type { NextConfig } from "next";

// Every screen is live per-user data, so we opt out of build-time prerendering/caching.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
