import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool, memoryStore, generateToken, verifyToken, hasPostgres } from "../db";

const router = Router();

// Sign Up
router.post("/signup", async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  try {
    if (hasPostgres()) {
      const result = await pool.query(
        "INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name",
        [email.toLowerCase(), passwordHash, displayName]
      );
      const user = result.rows[0];
      const token = generateToken({ id: user.id, email: user.email, displayName: user.display_name });
      return res.json({ token, user });
    } else {
      if (memoryStore.users.has(email.toLowerCase())) {
        return res.status(400).json({ error: "User already exists" });
      }
      const newUser = {
        id: "user_" + Math.random().toString(36).substring(2, 9),
        email: email.toLowerCase(),
        passwordHash,
        displayName,
      };
      memoryStore.users.set(email.toLowerCase(), newUser);
      const token = generateToken({ id: newUser.id, email: newUser.email, displayName: newUser.displayName });
      return res.json({ token, user: { id: newUser.id, email: newUser.email, displayName: newUser.displayName } });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to sign up" });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    if (hasPostgres()) {
      const result = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
      if (result.rows.length === 0) {
        return res.status(400).json({ error: "Invalid credentials" });
      }
      const user = result.rows[0];
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

      const token = generateToken({ id: user.id, email: user.email, displayName: user.display_name });
      return res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
    } else {
      const user = memoryStore.users.get(email.toLowerCase());
      if (!user) return res.status(400).json({ error: "Invalid credentials" });

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

      const token = generateToken({ id: user.id, email: user.email, displayName: user.displayName });
      return res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to log in" });
  }
});

// Get Current User Profile
router.get("/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: "Invalid token" });

  res.json({ user: decoded });
});

export default router;
