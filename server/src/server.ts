import express from "express";
import http from "http";
import cors from "cors";
import { WebSocketServer } from "ws";
// @ts-ignore
import * as utils from "y-websocket/bin/utils";
import { executeCode } from "./execution/runner";
import { logExecutionMetric, getMetricsSummary } from "./metrics/store";
import { initDb } from "./db";
import authRoutes from "./routes/auth";
import projectRoutes from "./routes/projects";

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);

const PORT = process.env.PORT || 1234;
const server = http.createServer(app);

// Yjs WebSocket Server
const wss = new WebSocketServer({ server });
const activeRooms = new Set<string>();

wss.on("connection", (conn, req) => {
  const url = req.url || "";
  const docName = url.replace(/^\//, "").split("?")[0] || "major-project-demo";
  activeRooms.add(docName);
  console.log(`[WS] Peer connected to room: ${docName} (Total Active Rooms: ${activeRooms.size})`);
  
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
