const isWindows = process.platform === 'win32';

const nextConfig = {
  // Standalone output disabled on Windows - Next.js creates files with colons which Windows can't handle
  // Use Docker for production builds on Windows
  ...(isWindows ? {} : { output: 'standalone' as const }),
  cleanDistDir: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // Include styled-jsx in standalone build (Next.js doesn't trace it correctly)
  outputFileTracingIncludes: {
    '/*': ['./node_modules/styled-jsx/**/*'],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '**',
      },
    ],
  },
}

export default nextConfig

