import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "medxplain.vercel.app",
        process.env.BETTER_AUTH_URL?.replace("https://", "") ?? "",
      ].filter(Boolean),
    },
  },
};

export default nextConfig;
