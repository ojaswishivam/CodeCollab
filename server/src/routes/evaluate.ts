import { Router } from "express";
import { memoryStore, SubmissionReport, verifyToken } from "../db/store";
import { evaluateTestCases } from "../execution/runner";
import { logExecutionMetric } from "../metrics/store";

const router = Router();

function getOptionalUser(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return verifyToken(authHeader.split(" ")[1]);
}

// Module 5: Automated Code Evaluation against predefined test cases
router.post("/", async (req, res) => {
  const { sessionCode, studentId, studentName, language, code } = req.body;

  if (!sessionCode || !language || typeof code !== "string") {
    return res.status(400).json({ error: "sessionCode, language, and code are required" });
  }

  const normalizedCode = String(sessionCode).toUpperCase();
  const session = memoryStore.sessions.get(normalizedCode);
  if (!session) {
    return res.status(404).json({ error: `Session "${normalizedCode}" not found` });
  }

  const effectiveStudentId = studentId || "anon_student";
  const effectiveStudentName = studentName || "Student";

  console.log(`[EVAL] Evaluating ${effectiveStudentName} (${language}) for session ${normalizedCode}...`);

  try {
    const evalOutput = await evaluateTestCases(language, code, session.testCases);

    const report: SubmissionReport = {
      id: "sub_" + Math.random().toString(36).substring(2, 9),
      sessionCode: normalizedCode,
      studentId: effectiveStudentId,
      studentName: effectiveStudentName,
      language,
      code,
      compilationStatus: evalOutput.compilationStatus,
      compileError: evalOutput.compileError,
      passedCount: evalOutput.passedCount,
      totalCount: evalOutput.totalCount,
      score: evalOutput.score,
      maxScore: 100,
      executionTimeSec: evalOutput.executionTimeSec,
      testResults: evalOutput.testResults,
      statusLabel: "Submission evaluated",
      submittedAt: new Date().toISOString(),
    };

    memoryStore.submissions.unshift(report);
    if (memoryStore.submissions.length > 300) {
      memoryStore.submissions.pop();
    }

    // Update student workspace status to submitted
    const wsKey = `${normalizedCode}:${effectiveStudentId}`;
    const existingWs = memoryStore.workspaces.get(wsKey);
    memoryStore.workspaces.set(wsKey, {
      id: wsKey,
      sessionCode: normalizedCode,
      studentId: effectiveStudentId,
      studentName: effectiveStudentName,
      language,
      code,
      status: "submitted",
      lastActiveAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(existingWs ? {} : {}),
    });

    logExecutionMetric({
      language,
      durationMs: Math.round(evalOutput.executionTimeSec * 1000),
      status: evalOutput.compilationStatus === "Compilation Error" ? "compile_error" : "success",
      mode: "local_isolated",
    });

    res.json({ report });
  } catch (err: any) {
    console.error("[EVAL] Error:", err);
    res.status(500).json({ error: err.message || "Automated evaluation failed" });
  }
});

// Fetch submissions for a session
router.get("/submissions/:sessionCode", (req, res) => {
  const sessionCode = req.params.sessionCode.toUpperCase();
  const user = getOptionalUser(req);
  const { studentId } = req.query;

  let subs = memoryStore.submissions.filter((s) => s.sessionCode === sessionCode);
  if (user?.role !== "teacher") {
    const targetId = user?.id || (studentId as string);
    subs = targetId ? subs.filter((s) => s.studentId === targetId) : [];
  }

  res.json({ submissions: subs });
});

function tokenizeCode(code: string): Set<string> {
  const cleaned = code
    .replace(/\/\/.*$/gm, "")
    .replace(/#.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = cleaned.match(/[a-zA-Z_][a-zA-Z0-9_]*|\d+|[+\-*/=<>!&|]+/g) || [];
  return new Set(tokens);
}

// Pairwise token similarity check across latest submissions per student in a session
router.get("/similarity/:sessionCode", (req, res) => {
  const sessionCode = req.params.sessionCode.toUpperCase();
  const user = getOptionalUser(req);
  if (!user || user.role !== "teacher") {
    return res.status(403).json({ error: "Teacher role required" });
  }

  const subs = memoryStore.submissions.filter((s) => s.sessionCode === sessionCode);
  const latestByStudent = new Map<string, SubmissionReport>();
  for (const s of subs) {
    if (!latestByStudent.has(s.studentId)) {
      latestByStudent.set(s.studentId, s);
    }
  }

  const list = Array.from(latestByStudent.values());
  const pairs: {
    studentA: string;
    studentB: string;
    similarityPercent: number;
  }[] = [];

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const tokA = tokenizeCode(list[i].code);
      const tokB = tokenizeCode(list[j].code);
      if (tokA.size === 0 || tokB.size === 0) continue;

      let intersection = 0;
      tokA.forEach((t) => {
        if (tokB.has(t)) intersection++;
      });
      const union = tokA.size + tokB.size - intersection;
      const similarityPercent = Math.round((intersection / union) * 100);
      if (similarityPercent >= 70) {
        pairs.push({
          studentA: list[i].studentName,
          studentB: list[j].studentName,
          similarityPercent,
        });
      }
    }
  }

  res.json({ pairs: pairs.sort((a, b) => b.similarityPercent - a.similarityPercent) });
});

export default router;
