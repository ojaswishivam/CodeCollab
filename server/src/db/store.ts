import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "codeclass_super_secret_jwt_key_2026";
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/codecollab";

export const pool = new Pool({
  connectionString: DATABASE_URL,
  connectionTimeoutMillis: 2000,
});

let isPostgresConnected = false;

export type UserRole = "teacher" | "student";

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
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

export interface StudentWorkspace {
  id: string;
  sessionCode: string;
  studentId: string;
  studentName: string;
  language: string;
  code: string;
  status: "active" | "submitted";
  lastActiveAt: string;
  updatedAt: string;
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

export const memoryStore = {
  users: new Map<string, StoredUser>(),
  projects: new Map<string, { id: string; ownerId: string; roomId: string; name: string; language: string; yjsState?: string; createdAt: string }>(),
  sessions: new Map<string, ClassroomSession>(),
  workspaces: new Map<string, StudentWorkspace>(),
  activityLogs: [] as ActivityLog[],
  submissions: [] as SubmissionReport[],
};

const salt = bcrypt.genSaltSync(10);
const demoHash = bcrypt.hashSync("password123", salt);

memoryStore.users.set("teacher@codeclass.io", {
  id: "user_teacher_1",
  email: "teacher@codeclass.io",
  passwordHash: demoHash,
  displayName: "Prof. Sharma (Teacher)",
  role: "teacher",
});

memoryStore.users.set("student1@codeclass.io", {
  id: "user_student_1",
  email: "student1@codeclass.io",
  passwordHash: demoHash,
  displayName: "Aarav (Student)",
  role: "student",
});

memoryStore.users.set("student2@codeclass.io", {
  id: "user_student_2",
  email: "student2@codeclass.io",
  passwordHash: demoHash,
  displayName: "Priya (Student)",
  role: "student",
});

memoryStore.users.set("demo@codecollab.io", {
  id: "user_demo_1",
  email: "demo@codecollab.io",
  passwordHash: demoHash,
  displayName: "Alex Demo",
  role: "student",
});

memoryStore.projects.set("room-demo-1", {
  id: "proj_demo_1",
  ownerId: "user_demo_1",
  roomId: "major-project-demo",
  name: "Algorithms & Sandbox Project",
  language: "javascript",
  createdAt: new Date().toISOString(),
});

memoryStore.sessions.set("CS301-EXAM", {
  id: "sess_cs301",
  code: "CS301-EXAM",
  title: "CS301 Mid-Term Coding Assessment",
  teacherId: "user_teacher_1",
  teacherName: "Prof. Sharma",
  mode: "assessment",
  language: "python",
  problemTitle: "Array Sum Calculator",
  problemDescription:
    "Given an integer N on the first line followed by N space-separated integers on the second line, compute and print the total sum of all integers.\n\nInput Format:\nLine 1: Integer N (1 <= N <= 1000)\nLine 2: N space-separated integers\n\nOutput Format:\nSingle integer representing the sum.",
  starterCode: {
    python: `# Read N and N space-separated integers, then print their sum
n = int(input().strip())
nums = list(map(int, input().strip().split()))
print(sum(nums[:n]))
`,
    javascript: `// Read N and N space-separated integers from stdin, then print their sum
const fs = require("fs");
const tokens = fs.readFileSync(0, "utf8").trim().split(/\\s+/);
const n = parseInt(tokens[0], 10);
let total = 0;
for (let i = 1; i <= n; i++) {
  total += parseInt(tokens[i], 10);
}
console.log(total);
`,
    cpp: `#include <iostream>
using namespace std;

int main() {
    int n;
    if (!(cin >> n)) return 0;
    long long sum = 0, x;
    for (int i = 0; i < n; i++) {
        cin >> x;
        sum += x;
    }
    cout << sum << endl;
    return 0;
}
`,
  },
  testCases: [
    { id: "tc_1", input: "5\n1 2 3 4 5\n", expectedOutput: "15", isHidden: false, points: 10 },
    { id: "tc_2", input: "3\n10 20 30\n", expectedOutput: "60", isHidden: false, points: 10 },
    { id: "tc_3", input: "4\n-5 5 10 -10\n", expectedOutput: "0", isHidden: false, points: 10 },
    { id: "tc_4", input: "1\n42\n", expectedOutput: "42", isHidden: true, points: 10 },
    { id: "tc_5", input: "6\n100 200 300 400 500 600\n", expectedOutput: "2100", isHidden: true, points: 10 },
    { id: "tc_6", input: "5\n0 0 0 0 0\n", expectedOutput: "0", isHidden: true, points: 10 },
    { id: "tc_7", input: "4\n-10 -20 -30 -40\n", expectedOutput: "-100", isHidden: true, points: 10 },
    { id: "tc_8", input: "7\n7 14 21 28 35 42 49\n", expectedOutput: "196", isHidden: true, points: 10 },
    { id: "tc_9", input: "2\n999 1\n", expectedOutput: "1000", isHidden: true, points: 10 },
    { id: "tc_10", input: "8\n1 1 2 3 5 8 13 21\n", expectedOutput: "54", isHidden: true, points: 10 },
  ],
  proctoringEnabled: true,
  inactivityThresholdSec: 30,
  durationMinutes: 60,
  isActive: true,
  createdAt: new Date().toISOString(),
});

memoryStore.sessions.set("COLLAB-101", {
  id: "sess_collab101",
  code: "COLLAB-101",
  title: "CS301 Pair Programming Lab (CRDT Shared)",
  teacherId: "user_teacher_1",
  teacherName: "Prof. Sharma",
  mode: "collaborative",
  language: "javascript",
  problemTitle: "Fibonacci Sequence Generator",
  problemDescription:
    "Collaborate in real-time using Yjs CRDT synchronization. Multiple authorized peers can edit this shared document concurrently without write-write conflicts.",
  starterCode: {
    javascript: `// Collaborative CRDT Pair Programming Room\nfunction fibonacci(n) {\n  const seq = [0, 1];\n  for (let i = 2; i < n; i++) {\n    seq.push(seq[i - 1] + seq[i - 2]);\n  }\n  return seq;\n}\n\nconsole.log(fibonacci(10));\n`,
    python: `def fibonacci(n):\n    seq = [0, 1]\n    for i in range(2, n):\n        seq.append(seq[-1] + seq[-2])\n    return seq\n\nprint(fibonacci(10))\n`,
    cpp: `#include <iostream>\nusing namespace std;\nint main() {\n    cout << "Collaborative C++ Lab" << endl;\n    return 0;\n}\n`,
  },
  testCases: [
    { id: "tc_c1", input: "", expectedOutput: "[ 0, 1, 1, 2, 3, 5, 8, 13, 21, 34 ]", isHidden: false, points: 100 },
  ],
  proctoringEnabled: false,
  inactivityThresholdSec: 60,
  durationMinutes: 90,
  isActive: true,
  createdAt: new Date().toISOString(),
});

export async function initDb() {
  try {
    const client = await pool.connect();
    console.log("[DB] PostgreSQL connected successfully!");
    isPostgresConnected = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
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
    console.log("[DB] PostgreSQL not active locally — using fast In-Memory Persistence fallback.");
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
