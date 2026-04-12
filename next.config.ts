import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允許 Cloudflare Tunnel 等外部域名在開發模式下存取
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.loca.lt",
  ],
};

export default nextConfig;
