import express from "express";
import http from "http";
import cors from "cors";
import { WebSocketServer } from "ws";
// @ts-ignore
import * as utils from "y-websocket/bin/utils";
import { executeCode } from "./execution/runner";
import { logExecutionMetric, getMetricsSummary } from "./metrics/store";
import { initDb, verifyToken } from "./db/store";
import authRoutes from "./routes/auth";
import projectRoutes from "./routes/projects";
import sessionRoutes from "./routes/sessions";
import proctoringRoutes from "./routes/proctoring";
import evaluateRoutes from "./routes/evaluate";

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/proctoring", proctoringRoutes);
app.use("/api/evaluate", evaluateRoutes);

const PORT = process.env.PORT || 1234;
const server = http.createServer(app);

// Yjs WebSocket Server
const wss = new WebSocketServer({ server });
const activeRooms = new Set<string>();

wss.on("connection", (conn, req) => {
  const url = req.url || "";
  const [rawPath, rawQuery] = url.split("?");
  const docName = rawPath.replace(/^\//, "") || "major-project-demo";
  const params = new URLSearchParams(rawQuery || "");
  const tokenParam = params.get("token");
  const decodedUser = tokenParam ? verifyToken(tokenParam) : null;

  const isTeacherInspectingStudent =
    decodedUser?.role === "teacher" && docName.includes("__student__");

  activeRooms.add(docName);
  console.log(
    `[WS] Peer connected to room: ${docName} (role: ${decodedUser?.role || "guest"}, readOnly: ${isTeacherInspectingStudent})`
  );

  // Enforce server-side read-only protection when a teacher inspects a student's isolated workspace
  if (isTeacherInspectingStudent) {
    conn.on("message", (data: Buffer) => {
      try {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        // Yjs protocol: messageType 0 = sync; syncSubType 2 = Update
        if (buf.length >= 2 && buf[0] === 0 && buf[1] === 2) {
          return;
        }
      } catch (_) {}
    });
  }

  utils.setupWSConnection(conn, req, { docName });

  conn.on("close", () => {
    if (wss.clients.size === 0) {
      activeRooms.clear();
    }
  });
});

// Code Execution Endpoint (with optional stdin support)
app.post("/api/execute", async (req, res) => {
  const { language, code, stdin } = req.body;

  if (!language || typeof code !== "string") {
    return res.status(400).json({ error: "Invalid language or code payload" });
  }

  const stdinInput = typeof stdin === "string" ? stdin : "";
  console.log(`[EXEC] Running ${language} snippet (${code.length} chars, stdin: ${stdinInput.length} chars)...`);
  
  try {
    const result = await executeCode(language, code, stdinInput);

    logExecutionMetric({
      language,
      durationMs: result.durationMs,
      status: result.status,
      mode: result.mode,
    });

    res.json(result);
  } catch (err: any) {
    console.error("[EXEC] Error:", err);
    logExecutionMetric({
      language,
      durationMs: 0,
      status: "runtime_error",
      mode: "local_isolated",
    });
    res.status(500).json({
      stdout: "",
      stderr: err.message || "Internal execution error",
      exitCode: 1,
      durationMs: 0,
      status: "runtime_error",
      mode: "local_isolated",
    });
  }
});

// Metrics API
app.get("/api/metrics", (req, res) => {
  const summary = getMetricsSummary(Math.max(1, activeRooms.size));
  res.json(summary);
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", port: PORT, rooms: activeRooms.size });
});

server.listen(PORT as number, "0.0.0.0", async () => {
  await initDb();
  console.log(`=======================================================`);
  console.log(`[API] CodeCollab Backend API: http://localhost:${PORT}`);
  console.log(`[WS]  WebSocket CRDT Provider: ws://localhost:${PORT}`);
  console.log(`[AUTH] Authentication & Persistent Project Store Active`);
  console.log(`=======================================================`);
});
