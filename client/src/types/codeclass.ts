export type UserRole = "teacher" | "student";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
  points?: number;
}

export interface ClassroomSession {
  id: string;
  code: string;
  title: string;
  teacherId: string;
  teacherName: string;
  mode: "assessment" | "collaborative";
  language: "python" | "javascript" | "cpp";
  problemTitle: string;
  problemDescription: string;
  starterCode: Record<string, string>;
  testCases: TestCase[];
  proctoringEnabled: boolean;
  inactivityThresholdSec: number;
  durationMinutes: number;
  isActive: boolean;
  createdAt: string;
}

export type ProctoringEventType =
  | "webcam_enabled"
  | "webcam_disabled"
  | "webcam_denied"
  | "tab_switch"
  | "fullscreen_exit"
  | "copy_paste"
  | "inactivity"
  | "multiple_faces"
  | "no_face"
  | "head_pose_away";

export interface ActivityLog {
  id: string;
  sessionCode: string;
  studentId: string;
  studentName: string;
  eventType: ProctoringEventType;
  severity: "info" | "warning" | "alert";
  details: string;
  timestamp: string;
}

export interface TestCaseResult {
  testCaseId: string;
  index: number;
  passed: boolean;
  isHidden: boolean;
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  error?: string;
  durationMs: number;
}

export interface SubmissionReport {
  id: string;
  sessionCode: string;
  studentId: string;
  studentName: string;
  language: string;
  code: string;
  compilationStatus: "Successful" | "Compilation Error";
  compileError?: string;
  passedCount: number;
  totalCount: number;
  score: number;
  maxScore: number;
  executionTimeSec: number;
  testResults: TestCaseResult[];
  statusLabel: string;
  submittedAt: string;
}

export interface StudentWorkspaceSummary {
  id: string;
  sessionCode: string;
  studentId: string;
  studentName: string;
  language: string;
  code: string;
  status: "active" | "submitted";
  lastActiveAt: string;
  updatedAt: string;
  alertCount: number;
  recentLogs: ActivityLog[];
  latestSubmission: SubmissionReport | null;
  yjsRoomId: string;
}
