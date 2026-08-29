import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const internalHost = process.env.TAURI_DEV_HOST;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@mui/material", "@mui/icons-material"],
  output: "export",
  images: {
    unoptimized: true,
  },
  assetPrefix: isProd ? undefined : internalHost ? `http://${internalHost}:3350` : undefined,
};

export default nextConfig;
