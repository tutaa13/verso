import { neon } from "@neondatabase/serverless";

// Returns a tagged-template SQL executor connected to Neon
export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  return neon(process.env.DATABASE_URL);
}
