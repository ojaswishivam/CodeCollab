import { Router } from "express";
import { pool, memoryStore, verifyToken, hasPostgres } from "../db";

const router = Router();

// Middleware to authenticate
function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication token required" });
  }
  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: "Invalid token" });
  req.user = decoded;
  next();
}

// List user projects
router.get("/", requireAuth, async (req: any, res) => {
  try {
    if (hasPostgres()) {
      const result = await pool.query(
        "SELECT id, room_id, name, language, created_at, updated_at FROM projects WHERE owner_id = $1 ORDER BY updated_at DESC",
        [req.user.id]
      );
      return res.json({ projects: result.rows });
    } else {
      const list = Array.from(memoryStore.projects.values()).filter(
        (p) => p.ownerId === req.user.id || req.user.email === "demo@codecollab.io"
      );
      return res.json({ projects: list });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load projects" });
  }
});

// Create project
router.post("/", requireAuth, async (req: any, res) => {
  const { name, roomId, language } = req.body;
  if (!name || !roomId) {
    return res.status(400).json({ error: "Project name and room ID required" });
  }

  const lang = language || "javascript";

  try {
    if (hasPostgres()) {
      const result = await pool.query(
        "INSERT INTO projects (owner_id, room_id, name, language) VALUES ($1, $2, $3, $4) RETURNING id, room_id, name, language, created_at",
        [req.user.id, roomId, name, lang]
      );
      return res.json({ project: result.rows[0] });
    } else {
      const newProj = {
        id: "proj_" + Math.random().toString(36).substring(2, 9),
        ownerId: req.user.id,
        roomId,
        name,
        language: lang,
        createdAt: new Date().toISOString(),
      };
      memoryStore.projects.set(roomId, newProj);
      return res.json({ project: newProj });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create project" });
  }
});

export default router;
