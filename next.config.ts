import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "sharp", "exceljs", "jspdf", "jspdf-autotable"],
  experimental: {
    serverActions: { bodySizeLimit: "12mb" }, // upload beberapa foto produk sekaligus
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
