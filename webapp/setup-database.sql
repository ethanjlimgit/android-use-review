-- PostgreSQL Database Setup Script for Droid Use Frontend
-- Run this script as a PostgreSQL superuser (usually 'postgres')
-- Usage: psql -U postgres -f setup-database.sql

-- Create user if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'droiduse') THEN
        CREATE USER droiduse WITH PASSWORD 'droiduse';
    END IF;
END
$$;

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE droiduse OWNER droiduse'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'droiduse')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE droiduse TO droiduse;

-- Connect to the new database and grant schema privileges
\c droiduse

-- Grant privileges on the public schema
GRANT ALL ON SCHEMA public TO droiduse;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO droiduse;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO droiduse;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO droiduse;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO droiduse;

-- Display success message
\echo 'Database setup completed successfully!'
\echo 'Database: droiduse'
\echo 'User: droiduse'
\echo 'Password: droiduse'




