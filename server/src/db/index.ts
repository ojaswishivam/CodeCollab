import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "codecollab_super_secret_jwt_key_2026";
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/codecollab";

export const pool = new Pool({
  connectionString: DATABASE_URL,
  connectionTimeoutMillis: 2000,
});

let isPostgresConnected = false;

// Fallback in-memory store for instant testing when Postgres is not running locally
export const memoryStore = {
  users: new Map<string, { id: string; email: string; passwordHash: string; displayName: string }>(),
  projects: new Map<string, { id: string; ownerId: string; roomId: string; name: string; language: string; yjsState?: string; createdAt: string }>(),
};

// Seed demo user
const salt = bcrypt.genSaltSync(10);
const demoHash = bcrypt.hashSync("password123", salt);
memoryStore.users.set("demo@codecollab.io", {
  id: "user_demo_1",
  email: "demo@codecollab.io",
  passwordHash: demoHash,
  displayName: "Alex Demo",
});

memoryStore.projects.set("room-demo-1", {
  id: "proj_demo_1",
  ownerId: "user_demo_1",
  roomId: "major-project-demo",
  name: "Algorithms & Sandbox Project",
  language: "javascript",
  createdAt: new Date().toISOString(),
});

export async function initDb() {
  try {
    const client = await pool.connect();
    console.log("?? PostgreSQL connected successfully!");
    isPostgresConnected = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
        room_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'javascript',
        yjs_state BYTEA,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    client.release();
  } catch (err: any) {
    console.log("??  PostgreSQL not active locally — using fast In-Memory Persistence fallback.");
    isPostgresConnected = false;
  }
}

export function generateToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (_) {
    return null;
  }
}

export function hasPostgres(): boolean {
  return isPostgresConnected;
}
