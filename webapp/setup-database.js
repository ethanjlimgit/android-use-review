#!/usr/bin/env node
/**
 * PostgreSQL Database Setup Script
 * This script creates the database and user for Droid Use Frontend
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  white: '\x1b[37m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Configuration
const config = {
  postgresUser: process.env.POSTGRES_USER || 'postgres',
  postgresPassword: process.env.POSTGRES_PASSWORD || 'postgres',
  dbUser: 'droiduse',
  dbPassword: 'droiduse',
  dbName: 'droiduse',
  dbHost: 'localhost',
};

log('========================================', 'cyan');
log('PostgreSQL Database Setup', 'cyan');
log('========================================', 'cyan');
console.log('');

// Check if psql is available
try {
  execSync('psql --version', { stdio: 'ignore' });
} catch (error) {
  log('Error: psql command not found!', 'red');
  log('Please install PostgreSQL and ensure psql is in your PATH.', 'yellow');
  console.log('');
  log('You can also run the SQL script manually:', 'yellow');
  log('  psql -U postgres -f setup-database.sql', 'white');
  process.exit(1);
}

// Check if SQL script exists
if (!existsSync('setup-database.sql')) {
  log('Error: setup-database.sql not found!', 'red');
  log('Please ensure setup-database.sql exists in the current directory.', 'yellow');
  process.exit(1);
}

log('Creating database user and database...', 'yellow');
console.log('');

try {
  // Set PGPASSWORD if provided
  const env = { ...process.env };
  if (config.postgresPassword) {
    env.PGPASSWORD = config.postgresPassword;
  }

  // Create user
  log(`Creating user '${config.dbUser}'...`, 'yellow');
  const createUserSQL = `
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '${config.dbUser}') THEN
            CREATE USER ${config.dbUser} WITH PASSWORD '${config.dbPassword}';
        END IF;
    END
    $$;
  `;

  try {
    execSync(
      `psql -U ${config.postgresUser} -h ${config.dbHost} -d postgres -c "${createUserSQL.replace(/\n/g, ' ').trim()}"`,
      { env, stdio: 'inherit' }
    );
  } catch (error) {
    log('Note: User may already exist or you may need to enter the postgres password.', 'yellow');
  }

  // Create database
  log(`Creating database '${config.dbName}'...`, 'yellow');
  const createDbSQL = `SELECT 'CREATE DATABASE ${config.dbName} OWNER ${config.dbUser}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${config.dbName}');`;
  
  try {
    execSync(
      `psql -U ${config.postgresUser} -h ${config.dbHost} -d postgres -c "${createDbSQL}"`,
      { env, stdio: 'inherit' }
    );
  } catch (error) {
    // Try direct creation if the above fails
    try {
      execSync(
        `psql -U ${config.postgresUser} -h ${config.dbHost} -d postgres -c "CREATE DATABASE ${config.dbName} OWNER ${config.dbUser};"`,
        { env, stdio: 'inherit' }
      );
    } catch (error2) {
      log('Note: Database may already exist.', 'yellow');
    }
  }

  // Grant privileges
  log('Granting privileges...', 'yellow');
  execSync(
    `psql -U ${config.postgresUser} -h ${config.dbHost} -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${config.dbName} TO ${config.dbUser};"`,
    { env, stdio: 'inherit' }
  );

  // Connect to new database and set up schema privileges
  log('Creating androiduse schema...', 'yellow');
  const createSchemaSQL = `
    CREATE SCHEMA IF NOT EXISTS androiduse AUTHORIZATION ${config.dbUser};
  `;

  execSync(
    `psql -U ${config.postgresUser} -h ${config.dbHost} -d ${config.dbName} -c "${createSchemaSQL.replace(/\n/g, ' ').trim()}"`,
    { env, stdio: 'inherit' }
  );

  log('Setting up schema privileges...', 'yellow');
  const setupSchemaSQL = `
    GRANT ALL ON SCHEMA androiduse TO ${config.dbUser};
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA androiduse TO ${config.dbUser};
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA androiduse TO ${config.dbUser};
    ALTER DEFAULT PRIVILEGES IN SCHEMA androiduse GRANT ALL ON TABLES TO ${config.dbUser};
    ALTER DEFAULT PRIVILEGES IN SCHEMA androiduse GRANT ALL ON SEQUENCES TO ${config.dbUser};
  `;

  execSync(
    `psql -U ${config.postgresUser} -h ${config.dbHost} -d ${config.dbName} -c "${setupSchemaSQL.replace(/\n/g, ' ').trim()}"`,
    { env, stdio: 'inherit' }
  );

  log('Setting search_path for user...', 'yellow');
  const setSearchPathSQL = `
    ALTER USER ${config.dbUser} SET search_path TO androiduse, public;
  `;

  execSync(
    `psql -U ${config.postgresUser} -h ${config.dbHost} -d ${config.dbName} -c "${setSearchPathSQL.replace(/\n/g, ' ').trim()}"`,
    { env, stdio: 'inherit' }
  );

  log('Installing pgvector extension...', 'yellow');
  const installExtensionSQL = `
    CREATE EXTENSION IF NOT EXISTS vector SCHEMA androiduse;
  `;

  execSync(
    `psql -U ${config.postgresUser} -h ${config.dbHost} -d ${config.dbName} -c "${installExtensionSQL.replace(/\n/g, ' ').trim()}"`,
    { env, stdio: 'inherit' }
  );

  console.log('');
  log('✓ Database setup completed successfully!', 'green');
  console.log('');
  log(`Database: ${config.dbName}`, 'cyan');
  log(`User: ${config.dbUser}`, 'cyan');
  log(`Password: ${config.dbPassword}`, 'cyan');
  console.log('');
  log('Next steps:', 'yellow');
  log('  1. Run: pnpm db:generate', 'white');
  log('  2. Run: pnpm db:push', 'white');
  console.log('');
} catch (error) {
  log('Error during database setup:', 'red');
  console.error(error.message);
  console.log('');
  log('You can also run the SQL script manually:', 'yellow');
  log('  psql -U postgres -f setup-database.sql', 'white');
  process.exit(1);
}




