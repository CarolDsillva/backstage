import type { NextConfig } from "next";

// Every screen is live per-user data, so we opt out of build-time prerendering/caching.
const nextConfig: NextConfig = {
  // Dev only: lets a second local session on 127.0.0.1 (separate cookies) load the app.
  allowedDevOrigins: ["127.0.0.1", "10.2.0.2"],
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
