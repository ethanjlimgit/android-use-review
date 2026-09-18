import { copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnv = join(__dirname, '.env');
const emailServiceEnv = join(__dirname, '.env.email-service');
const exampleEnv = join(__dirname, '.env.example');

if (!existsSync(rootEnv)) {
  if (existsSync(exampleEnv)) {
    console.log('No .env file found, copying from .env.example...');
    copyFileSync(exampleEnv, rootEnv);
    console.log('Created .env from .env.example');
  } else {
    console.log('No .env or .env.example file found in root directory');
    process.exit(0);
  }
}

// Main app targets — use root .env
const mainTargets = [
  'apps/frontend',
  'apps/admin',
  'apps/agent-server',
  'packages/shared-lib',
  'packages/shared-prisma',
  'packages/shared-ui',
];

mainTargets.forEach((target) => {
  const dest = join(__dirname, target, '.env');
  try {
    copyFileSync(rootEnv, dest);
    console.log(`Copied .env to ${target}`);
  } catch (err) {
    console.error(`Failed to copy .env to ${target}:`, err.message);
  }
});

// Email service — create .env.email-service from example if it doesn't exist
if (!existsSync(emailServiceEnv)) {
  const exampleEmailEnv = join(__dirname, '.env.email-service.example');
  if (existsSync(exampleEmailEnv)) {
    console.log('No .env.email-service found, copying from .env.email-service.example...');
    copyFileSync(exampleEmailEnv, emailServiceEnv);
    console.log('Created .env.email-service from .env.email-service.example');
  }
}

// Email service — use .env.email-service
if (existsSync(emailServiceEnv)) {
  const dest = join(__dirname, 'apps/email-service', '.env');
  try {
    copyFileSync(emailServiceEnv, dest);
    console.log('Copied .env.email-service to apps/email-service');
  } catch (err) {
    console.error('Failed to copy .env.email-service to apps/email-service:', err.message);
  }
} else {
  console.log('No .env.email-service file found — skipping email-service');
}
