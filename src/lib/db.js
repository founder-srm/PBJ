import 'server-only';
import { neon } from '@neondatabase/serverless';

// HTTP driver: one round trip per query, and sql.transaction([...]) for atomic multi-statement writes.
export const sql = neon(process.env.DATABASE_URL);
