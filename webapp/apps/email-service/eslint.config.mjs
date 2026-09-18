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
      '**/generated/**',
    ],
  },
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default config;
