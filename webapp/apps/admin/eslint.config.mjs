import nextConfig from 'eslint-config-next';

const config = [
  ...nextConfig,
  {
    ignores: [
      '**/coverage/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
    ],
  },
  {
    rules: {
      // Allow unescaped entities in JSX (quotes, apostrophes)
      'react/no-unescaped-entities': 'off',
      // Allow setState in effects (with caution - should be reviewed later)
      'react-hooks/set-state-in-effect': 'warn',
      // Allow React Hook Form's watch() usage
      'react-hooks/incompatible-library': 'warn',
    },
  },
];

export default config;
