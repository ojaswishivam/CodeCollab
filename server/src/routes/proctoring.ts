import { Router } from "express";
import { memoryStore, ActivityLog, ProctoringEventType, verifyToken } from "../db/store";

const router = Router();

function getOptionalUser(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return verifyToken(authHeader.split(" ")[1]);
}

const EVENT_SEVERITY: Record<ProctoringEventType, "info" | "warning" | "alert"> = {
  webcam_enabled: "info",
  webcam_disabled: "warning",
  webcam_denied: "warning",
  tab_switch: "alert",
  fullscreen_exit: "warning",
  copy_paste: "warning",
  inactivity: "warning",
  multiple_faces: "alert",
  no_face: "warning",
  head_pose_away: "warning",
};

// Log a proctoring event (consent-based alert for teacher review, not proof of cheating)
router.post("/log", (req, res) => {
  const { sessionCode, studentId, studentName, eventType, details } = req.body;

  if (!sessionCode || !studentId || !studentName || !eventType) {
    return res.status(400).json({ error: "Missing required proctoring log fields" });
  }

  const typedEvent = eventType as ProctoringEventType;
  const severity = EVENT_SEVERITY[typedEvent] || "warning";

  const entry: ActivityLog = {
    id: "log_" + Math.random().toString(36).substring(2, 9),
    sessionCode: String(sessionCode).toUpperCase(),
    studentId: String(studentId),
    studentName: String(studentName),
    eventType: typedEvent,
    severity,
    details: String(details || eventType),
    timestamp: new Date().toISOString(),
  };

  memoryStore.activityLogs.unshift(entry);
  if (memoryStore.activityLogs.length > 500) {
    memoryStore.activityLogs.pop();
  }

  res.status(201).json({ log: entry });
});

// Fetch activity logs for a session (Teachers see all; Students see only their own)
router.get("/logs/:sessionCode", (req, res) => {
  const sessionCode = req.params.sessionCode.toUpperCase();
  const user = getOptionalUser(req);
  const { studentId } = req.query;

  let logs = memoryStore.activityLogs.filter((l) => l.sessionCode === sessionCode);

  if (user?.role !== "teacher") {
    const targetId = user?.id || (studentId as string);
    logs = targetId ? logs.filter((l) => l.studentId === targetId) : [];
  } else if (studentId) {
    logs = logs.filter((l) => l.studentId === String(studentId));
  }

  res.json({ logs: logs.slice(0, 150) });
});

export default router;
