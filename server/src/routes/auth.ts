import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool, memoryStore, generateToken, verifyToken, hasPostgres, UserRole } from "../db/store";

const router = Router();

// Sign Up
router.post("/signup", async (req, res) => {
  const { email, password, displayName, role } = req.body;
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const normalizedRole: UserRole = role === "teacher" ? "teacher" : "student";
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  try {
    if (hasPostgres()) {
      const result = await pool.query(
        "INSERT INTO users (email, password_hash, display_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, display_name, role",
        [email.toLowerCase(), passwordHash, displayName, normalizedRole]
      );
      const row = result.rows[0];
      const user = {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        role: row.role as UserRole,
      };
      const token = generateToken(user);
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
        role: normalizedRole,
      };
      memoryStore.users.set(email.toLowerCase(), newUser);
      const userPayload = {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        role: newUser.role,
      };
      const token = generateToken(userPayload);
      return res.json({ token, user: userPayload });
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
      const row = result.rows[0];
      const isMatch = await bcrypt.compare(password, row.password_hash);
      if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

      const userPayload = {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        role: (row.role || "student") as UserRole,
      };
      const token = generateToken(userPayload);
      return res.json({ token, user: userPayload });
    } else {
      const user = memoryStore.users.get(email.toLowerCase());
      if (!user) return res.status(400).json({ error: "Invalid credentials" });

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

      const userPayload = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      };
      const token = generateToken(userPayload);
      return res.json({ token, user: userPayload });
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
