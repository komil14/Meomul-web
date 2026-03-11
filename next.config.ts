import type { NextConfig } from "next";

const backendGraphqlUrl =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "http://localhost:3001/graphql";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const socketUrl =
  process.env.NEXT_PUBLIC_CHAT_SOCKET_URL ?? "http://localhost:3001";

const isDev = process.env.NODE_ENV !== "production";

const buildCsp = (): string =>
  [
    "default-src 'self'",
    // 'unsafe-eval' required in dev mode for Next.js webpack source maps
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://cdn.prod.website-files.com https://d3e54v103j8qbb.cloudfront.net https://ajax.googleapis.com`,
    "style-src 'self' 'unsafe-inline' https://cdn.prod.website-files.com",
    "font-src 'self' data:",
    `img-src 'self' data: blob: https: ${apiUrl}`,
    `media-src 'self' https://videos.pexels.com ${apiUrl}`,
    `connect-src 'self' ${apiUrl} ${socketUrl} ws: wss:`,
    "frame-src 'self' https://maps.google.com https://www.google.com https://www.youtube.com https://www.youtube-nocookie.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  i18n: {
    locales: ["en", "ko", "ru", "uz"],
    defaultLocale: "en",
    localeDetection: false,
  },

  // Tree-shake barrel exports for large icon/UI libraries
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  async rewrites() {
    return [
      {
        source: "/graphql",
        destination: backendGraphqlUrl,
      },
      
      
    ];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Content-Security-Policy",
            value: buildCsp(),
          },
        ],
      },
    ];
  },

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.meomul.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      // Allow API server for uploaded images (localhost for dev, production domain for prod)
      ...(process.env.NODE_ENV === "development"
        ? [
            {
              protocol: "http" as const,
              hostname: "localhost",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
