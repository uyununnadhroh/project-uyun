import type { NextConfig } from "next";

const ocrAssets = ["./node_modules/@tesseract.js-data/*/4.0.0_best_int/*.traineddata.gz"];

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "sharp", "exceljs", "jspdf", "jspdf-autotable"],
  experimental: {
    serverActions: { bodySizeLimit: "4.25mb" }, // total gambar maksimal 4 MiB, sisanya untuk metadata form
  },
  outputFileTracingIncludes: {
    "/api/orders/**/proof": ocrAssets,
    "/admin/verifikasi": ocrAssets,
    "/admin/pesanan/**": ocrAssets,
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
