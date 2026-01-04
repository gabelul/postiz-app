import { PostgresStore, PgVector } from '@mastra/pg';

let _store: PostgresStore | null = null;

/**
 * Lazily creates and returns the PostgresStore for Mastra
 * This ensures environment variables are loaded before creating the store
 */
export function getPostgresStore(): PostgresStore | null {
  if (_store) {
    return _store;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    // Return null if DATABASE_URL is not set
    // This allows the service to gracefully handle missing configuration
    return null;
  }

  _store = new PostgresStore({
    connectionString: databaseUrl,
  });
  return _store;
}

/**
 * Reset the store (useful for testing)
 */
export function resetPostgresStore(): void {
  _store = null;
}

// Legacy export - attempts to access the store
// Returns a minimal object that won't throw errors
// Importing code should use getPostgresStore() directly
export const pStore = new Proxy({} as PostgresStore, {
  get(target, prop) {
    const store = getPostgresStore();
    if (!store) {
      return undefined;
    }
    return (store as any)[prop];
  },
});
