import { neon } from '@neondatabase/serverless';

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create a Neon client
const sql = neon(process.env.DATABASE_URL);

// Export the SQL client for queries
export { sql };
