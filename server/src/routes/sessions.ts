import { Router } from "express";
import { memoryStore, ClassroomSession, TestCase, verifyToken } from "../db/store";

const router = Router();

function getOptionalUser(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return verifyToken(authHeader.split(" ")[1]);
}

// List all classroom/exam sessions
router.get("/", (req, res) => {
  const user = getOptionalUser(req);
  const isTeacher = user?.role === "teacher";

  const sessions = Array.from(memoryStore.sessions.values()).map((s) => ({
    ...s,
    testCases: isTeacher
      ? s.testCases
      : s.testCases.map((tc) =>
          tc.isHidden
            ? { id: tc.id, isHidden: true, points: tc.points, input: "[Hidden]", expectedOutput: "[Hidden]" }
            : tc
        ),
  }));

  res.json({ sessions });
});

// Get single session by code
router.get("/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  const session = memoryStore.sessions.get(code);
  if (!session) {
    return res.status(404).json({ error: `Session "${code}" not found` });
  }

  const user = getOptionalUser(req);
  const isTeacher = user?.role === "teacher";

  res.json({
    session: {
      ...session,
      testCases: isTeacher
        ? session.testCases
        : session.testCases.map((tc) =>
            tc.isHidden
              ? { id: tc.id, isHidden: true, points: tc.points, input: "[Hidden]", expectedOutput: "[Hidden]" }
              : tc
          ),
    },
  });
});

// Create a new classroom/exam session (Teacher)
router.post("/", (req, res) => {
  const user = getOptionalUser(req);
  if (!user || user.role !== "teacher") {
    return res.status(403).json({ error: "Only teachers can create classroom sessions" });
  }

  const {
    code,
    title,
    mode,
    language,
    problemTitle,
    problemDescription,
    starterCode,
    testCases,
    proctoringEnabled,
    inactivityThresholdSec,
    durationMinutes,
  } = req.body;

  if (!title || !problemTitle || !problemDescription) {
    return res.status(400).json({ error: "Title, problem title, and description are required" });
  }

  const sessionCode = (
    code || `CLS-${Math.random().toString(36).substring(2, 6)}`
  )
    .trim()
    .toUpperCase();

  if (memoryStore.sessions.has(sessionCode)) {
    return res.status(400).json({ error: `Session code "${sessionCode}" already exists` });
  }

  const normalizedCases: TestCase[] = Array.isArray(testCases) && testCases.length > 0
    ? testCases.map((tc: any, idx: number) => ({
        id: tc.id || `tc_${idx + 1}`,
        input: String(tc.input ?? ""),
        expectedOutput: String(tc.expectedOutput ?? ""),
        isHidden: Boolean(tc.isHidden),
        points: Number(tc.points) || 10,
      }))
    : [{ id: "tc_1", input: "", expectedOutput: "", isHidden: false, points: 100 }];

  const newSession: ClassroomSession = {
    id: "sess_" + Math.random().toString(36).substring(2, 9),
    code: sessionCode,
    title: title.trim(),
    teacherId: user.id,
    teacherName: user.displayName,
    mode: mode === "collaborative" ? "collaborative" : "assessment",
    language: ["python", "javascript", "cpp"].includes(language) ? language : "python",
    problemTitle: problemTitle.trim(),
    problemDescription: problemDescription.trim(),
    starterCode: starterCode || {
      python: "# Write your Python solution here\n",
      javascript: "// Write your JavaScript solution here\n",
      cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    return 0;\n}\n",
    },
    testCases: normalizedCases,
    proctoringEnabled: mode === "collaborative" ? false : Boolean(proctoringEnabled ?? true),
    inactivityThresholdSec: Number(inactivityThresholdSec) || 30,
    durationMinutes: Number(durationMinutes) || 60,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  memoryStore.sessions.set(sessionCode, newSession);
  res.status(201).json({ session: newSession });
});

// Student registers or heartbeats their independent workspace
router.post("/:code/workspace", (req, res) => {
  const sessionCode = req.params.code.toUpperCase();
  const { studentId, studentName, language, code, status } = req.body;

  if (!studentId || !studentName) {
    return res.status(400).json({ error: "studentId and studentName are required" });
  }

  const key = `${sessionCode}:${studentId}`;
  const existing = memoryStore.workspaces.get(key);
  const now = new Date().toISOString();

  const updated = {
    id: key,
    sessionCode,
    studentId,
    studentName,
    language: language || existing?.language || "python",
    code: typeof code === "string" ? code : existing?.code || "",
    status: (status === "submitted" ? "submitted" : existing?.status || "active") as "active" | "submitted",
    lastActiveAt: now,
    updatedAt: now,
  };

  memoryStore.workspaces.set(key, updated);
  res.json({ workspace: updated });
});

// Teacher lists all student workspaces, latest scores, and alert counts for a session
router.get("/:code/students", (req, res) => {
  const sessionCode = req.params.code.toUpperCase();
  const user = getOptionalUser(req);
  if (!user || user.role !== "teacher") {
    return res.status(403).json({ error: "Teacher role required to inspect student workspaces" });
  }

  const teacherIds = new Set(
    Array.from(memoryStore.users.values())
      .filter((u) => u.role === "teacher")
      .map((u) => u.id)
  );

  const workspaces = Array.from(memoryStore.workspaces.values()).filter(
    (w) => w.sessionCode === sessionCode && !teacherIds.has(w.studentId)
  );

  const enriched = workspaces.map((ws) => {
    const logs = memoryStore.activityLogs.filter(
      (l) => l.sessionCode === sessionCode && l.studentId === ws.studentId
    );
    const alertCount = logs.filter((l) => l.severity !== "info").length;

    const studentSubs = memoryStore.submissions.filter(
      (s) => s.sessionCode === sessionCode && s.studentId === ws.studentId
    );
    const latestSubmission = studentSubs[0] || null;

    return {
      ...ws,
      alertCount,
      recentLogs: logs.slice(0, 5),
      latestSubmission,
      yjsRoomId: `${sessionCode}__student__${ws.studentId}`,
    };
  });

  res.json({ students: enriched });
});

export default router;
