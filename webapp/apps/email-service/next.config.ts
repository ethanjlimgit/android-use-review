const isWindows = process.platform === 'win32';

const nextConfig = {
  ...(isWindows ? {} : { output: 'standalone' as const }),
  cleanDistDir: true,
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingIncludes: {
    '/*': ['./node_modules/styled-jsx/**/*'],
  },
}

export default nextConfig
