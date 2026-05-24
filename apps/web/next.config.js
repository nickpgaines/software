/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals.push("better-sqlite3");
    return config;
  },
  async redirects() {
    // The marketing site is a single page with anchor sections. /features
    // and /pricing were standalone pages in the original marketing setup;
    // keep their URLs alive so any external links land on the right
    // scroll target.
    return [
      { source: "/features", destination: "/#features", permanent: true },
      { source: "/pricing", destination: "/#pricing", permanent: true },
    ];
  },
};

module.exports = nextConfig;
