import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "medxplain.vercel.app",
        process.env.NEXT_PUBLIC_APP_URL?.replace("https://", "") ?? "",
      ].filter(Boolean),
    },
  },
};

export default nextConfig;
