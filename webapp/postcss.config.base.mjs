// Shared PostCSS configuration for all Next.js apps
const config = {
  plugins: {
    "@tailwindcss/postcss": {
      base: process.cwd() + '/../..',
    },
  },
};

export default config;
