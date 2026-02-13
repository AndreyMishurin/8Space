/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "logos-world.net",
      },
    ],
  },
  async rewrites() {
    // In development, proxy /app/* to the Vite dev server
    // In production, serve the pre-built Vite SPA from public/app/
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/app/:path*",
          destination: "http://localhost:5173/app/:path*",
        },
      ];
    }
    return [
      {
        source: "/app/:path*",
        destination: "/app/index.html",
      },
    ];
  },
};

module.exports = nextConfig;
