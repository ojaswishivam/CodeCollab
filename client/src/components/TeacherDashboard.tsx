import React, { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { editor } from "monaco-editor";
import {
  Users,
  ShieldAlert,
  Award,
  Plus,
  Eye,
  Lock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BookOpen,
  X,
  Trash2,
  Download,
  GitCompare,
} from "lucide-react";
import { API_URL, WS_URL } from "../config";
import {
  ClassroomSession,
  StudentWorkspaceSummary,
  ActivityLog,
  SubmissionReport,
} from "../types/codeclass";
import { EvaluationReportModal } from "./EvaluationReportModal";

interface TeacherDashboardProps {
  token: string | null;
  sessions: ClassroomSession[];
  activeSessionCode: string;
  onSelectSession: (code: string) => void;
  onSessionsUpdated: () => void;
  onNotify?: (msg: string, type?: "info" | "success" | "warning") => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  token,
  sessions,
  activeSessionCode,
  onSelectSession,
  onSessionsUpdated,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<"workspaces" | "proctoring" | "submissions">("workspaces");
  const [students, setStudents] = useState<StudentWorkspaceSummary[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionReport[]>([]);
  const [similarityPairs, setSimilarityPairs] = useState<
    { studentA: string; studentB: string; similarityPercent: number }[]
  >([]);
  const [inspectingStudent, setInspectingStudent] = useState<StudentWorkspaceSummary | null>(null);
  const [selectedReport, setSelectedReport] = useState<SubmissionReport | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Read-only Monaco inspection state
  const [readonlyEditor, setReadonlyEditor] = useState<editor.IStandaloneCodeEditor | null>(null);

  // Create session form state
  const [newTitle, setNewTitle] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newDuration, setNewDuration] = useState<number>(60);
  const [newLang, setNewLang] = useState<"python" | "javascript" | "cpp">("cpp");
  const [newProbTitle, setNewProbTitle] = useState("");
  const [newProbDesc, setNewProbDesc] = useState("");
  const [newProctoring, setNewProctoring] = useState(true);
  const [newTestCases, setNewTestCases] = useState([
    { input: "5\n1 2 3 4 5\n", expectedOutput: "15", isHidden: false, points: 50 },
    { input: "3\n10 20 30\n", expectedOutput: "60", isHidden: true, points: 50 },
  ]);

  const activeSession = sessions.find((s) => s.code === activeSessionCode) || sessions[0];

  const fetchMonitoringData = async () => {
    if (!token || !activeSessionCode) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [studRes, logRes, subRes, simRes] = await Promise.all([
        fetch(`${API_URL}/api/sessions/${activeSessionCode}/students`, { headers }),
        fetch(`${API_URL}/api/proctoring/logs/${activeSessionCode}`, { headers }),
        fetch(`${API_URL}/api/evaluate/submissions/${activeSessionCode}`, { headers }),
        fetch(`${API_URL}/api/evaluate/similarity/${activeSessionCode}`, { headers }),
      ]);

      if (studRes.ok) {
        const sData = await studRes.json();
        setStudents(sData.students || []);
      }
      if (logRes.ok) {
        const lData = await logRes.json();
        setLogs(lData.logs || []);
      }
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubmissions(subData.submissions || []);
      }
      if (simRes.ok) {
        const simData = await simRes.json();
        setSimilarityPairs(simData.pairs || []);
      }
    } catch (err) {
      console.error("Failed to fetch teacher monitoring data:", err);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    const timer = setInterval(fetchMonitoringData, 3500);
    return () => clearInterval(timer);
  }, [activeSessionCode, token]);

  // Read-only Yjs text observer: mirrors student's live CRDT document without MonacoBinding write-back
  useEffect(() => {
    if (!readonlyEditor || !inspectingStudent) return;

    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(WS_URL, inspectingStudent.yjsRoomId, ydoc, {
      params: token ? { token } : {},
    });
    const model = readonlyEditor.getModel();
    const ytext = ydoc.getText("monaco");

    const syncModelFromYText = () => {
      if (!model) return;
      const liveText = ytext.toString();
      if (liveText.length > 0 && model.getValue() !== liveText) {
        model.setValue(liveText);
      }
    };

    ytext.observe(syncModelFromYText);

    provider.on("sync", (isSynced: boolean) => {
      if (!isSynced || !model) return;
      const liveText = ytext.toString();
      if (liveText.length > 0) {
        model.setValue(liveText);
      } else if (inspectingStudent.code) {
        model.setValue(inspectingStudent.code);
      }
    });

    return () => {
      ytext.unobserve(syncModelFromYText);
      provider.destroy();
      ydoc.destroy();
    };
  }, [readonlyEditor, inspectingStudent?.yjsRoomId, token]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: newCode || undefined,
          title: newTitle,
          mode: "assessment",
          language: newLang,
          problemTitle: newProbTitle,
          problemDescription: newProbDesc,
          proctoringEnabled: newProctoring,
          durationMinutes: Number(newDuration) || 60,
          testCases: newTestCases,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create session");

      if (onNotify) onNotify(`Created session ${data.session.code}`, "success");
      setIsCreateOpen(false);
      setNewTitle("");
      setNewCode("");
      setNewProbTitle("");
      setNewProbDesc("");
      onSessionsUpdated();
      onSelectSession(data.session.code);
    } catch (err: any) {
      if (onNotify) onNotify(err.message, "warning");
    }
  };

  const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
    const escapeCell = (val: string) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.map(escapeCell).join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden text-[#dfe2eb] p-0.5">
      {/* Top Teacher Control Bar */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
            <BookOpen size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">
                Instructor Command Center
              </h2>
              <span className="text-[10px] bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30 px-2 py-0.5 rounded font-mono font-bold uppercase">
                Teacher Role
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Manage sessions, inspect isolated student workspaces (read-only), review proctoring alerts &amp; evaluation scores
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={activeSessionCode}
            onChange={(e) => onSelectSession(e.target.value)}
            className="bg-[#161B22] border border-[#30363D] text-xs font-mono font-semibold text-[#60A5FA] px-3 py-1.5 rounded focus:outline-none focus:border-[#3B82F6]"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.code}>
                {s.code} — {s.title} ({s.mode})
              </option>
            ))}
          </select>

          <button
            onClick={fetchMonitoringData}
            className="p-2 bg-[#161B22] hover:bg-[#1f242c] border border-[#30363D] rounded text-gray-300 transition"
            title="Refresh Monitoring Data"
          >
            <RefreshCw size={14} />
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 bg-[#10B981] hover:bg-[#059669] text-[#090D16] text-xs font-bold px-3.5 py-1.5 rounded transition"
          >
            <Plus size={14} />
            <span>New Assignment / Session</span>
          </button>
        </div>
      </div>

      {/* Session Overview & Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center bg-[#0D1117] p-0.5 rounded-lg border border-[#30363D]">
          <button
            onClick={() => setActiveTab("workspaces")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold transition ${
              activeTab === "workspaces"
                ? "bg-[#3B82F6]/20 text-[#60A5FA] border border-[#3B82F6]/40"
                : "text-gray-400 hover:text-white border border-transparent"
            }`}
          >
            <Users size={13} />
            <span>Student Workspaces ({students.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("proctoring")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold transition ${
              activeTab === "proctoring"
                ? "bg-[#F59E0B]/20 text-[#FBBF24] border border-[#F59E0B]/40"
                : "text-gray-400 hover:text-white border border-transparent"
            }`}
          >
            <ShieldAlert size={13} />
            <span>Proctoring Alerts ({logs.filter((l) => l.severity !== "info").length})</span>
          </button>
          <button
            onClick={() => setActiveTab("submissions")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold transition ${
              activeTab === "submissions"
                ? "bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/40"
                : "text-gray-400 hover:text-white border border-transparent"
            }`}
          >
            <Award size={13} />
            <span>Evaluation Reports ({submissions.length})</span>
          </button>
        </div>

        {activeSession && (
          <div className="text-xs text-gray-400 flex items-center gap-2 font-mono">
            <span>Problem: <strong className="text-gray-200">{activeSession.problemTitle}</strong></span>
            <span>•</span>
            <span>Tests: <strong className="text-[#60A5FA]">{activeSession.testCases.length}</strong></span>
            <span>•</span>
            <span>Proctoring: <strong className={activeSession.proctoringEnabled ? "text-[#34D399]" : "text-gray-400"}>
              {activeSession.proctoringEnabled ? "ON" : "OFF"}
            </strong></span>
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* TAB 1: LIVE STUDENT WORKSPACES */}
        {activeTab === "workspaces" && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
            {/* Student List */}
            <div className="lg:col-span-5 bg-[#0D1117] border border-[#30363D] rounded-lg p-3.5 overflow-y-auto space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                Isolated Student Workspaces
              </div>
              {students.length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-500">
                  No students have joined session <code className="text-indigo-300">{activeSessionCode}</code> yet.
                  <br />
                  Open another tab as a Student to see live isolated workspaces appear here!
                </div>
              ) : (
                students.map((st) => (
                  <div
                    key={st.id}
                    className={`p-3.5 rounded-xl border transition ${
                      inspectingStudent?.id === st.id
                        ? "bg-indigo-950/30 border-indigo-500/60"
                        : "bg-[#181822] border-gray-800 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{st.studentName}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              st.status === "submitted"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-sky-500/20 text-sky-300"
                            }`}
                          >
                            {st.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                          Lang: {st.language} • Last active: {new Date(st.lastActiveAt).toLocaleTimeString()}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (inspectingStudent?.yjsRoomId !== st.yjsRoomId) {
                            setReadonlyEditor(null);
                          }
                          setInspectingStudent(st);
                        }}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                      >
                        <Eye size={13} />
                        <span>Inspect</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-gray-800/80">
                      <span className="text-gray-400">
                        Proctoring Alerts:{" "}
                        <strong className={st.alertCount > 0 ? "text-amber-400" : "text-emerald-400"}>
                          {st.alertCount}
                        </strong>
                      </span>
                      <span className="text-gray-400">
                        Latest Score:{" "}
                        <strong className="text-indigo-300 font-mono">
                          {st.latestSubmission
                            ? `${st.latestSubmission.score}/100 (${st.latestSubmission.passedCount}/${st.latestSubmission.totalCount})`
                            : "Not submitted"}
                        </strong>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Read-Only Live Monaco Code Inspector */}
            <div className="lg:col-span-7 bg-[#0D1117] border border-[#30363D] rounded-lg overflow-hidden flex flex-col">
              {inspectingStudent ? (
                <>
                  <div className="px-4 py-2 bg-[#161B22] border-b border-[#30363D] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-[#34D399] font-semibold">
                      <Lock size={13} className="text-[#10B981]" />
                      <span>
                        Read-Only Inspection: <strong className="text-white">{inspectingStudent.studentName}</strong> (Cannot overwrite student code)
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setReadonlyEditor(null);
                        setInspectingStudent(null);
                      }}
                      className="text-gray-400 hover:text-white font-semibold"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex-1 min-h-[260px]">
                    <Editor
                      key={inspectingStudent.yjsRoomId}
                      height="100%"
                      theme="vs-dark"
                      language={inspectingStudent.language}
                      defaultValue=""
                      onMount={(ed) => setReadonlyEditor(ed)}
                      options={{
                        readOnly: true,
                        domReadOnly: true,
                        automaticLayout: true,
                        fontSize: 13,
                        minimap: { enabled: false },
                      }}
                    />
                  </div>
                  {/* Bottom Proctoring & Evaluation Summary Strip */}
                  <div className="px-4 py-2 bg-[#161B22] border-t border-[#30363D] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">
                        Proctoring Alerts:{" "}
                        <strong className={inspectingStudent.alertCount > 0 ? "text-[#FBBF24]" : "text-[#34D399]"}>
                          {inspectingStudent.alertCount}
                        </strong>
                      </span>
                      <span className="text-gray-600">|</span>
                      <span className="text-gray-400">
                        Latest Score:{" "}
                        <strong className="text-[#60A5FA]">
                          {inspectingStudent.latestSubmission
                            ? `${inspectingStudent.latestSubmission.score}/100 (${inspectingStudent.latestSubmission.passedCount}/${inspectingStudent.latestSubmission.totalCount})`
                            : "Not submitted"}
                        </strong>
                      </span>
                    </div>
                    {inspectingStudent.latestSubmission && (
                      <button
                        onClick={() => setSelectedReport(inspectingStudent.latestSubmission)}
                        className="text-[#34D399] hover:underline font-bold"
                      >
                        Open Full Report ➔
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-6 text-center">
                  <Eye size={32} className="mb-2 text-gray-600" />
                  <div className="text-sm font-semibold text-gray-300">
                    Select a Student to Inspect Live Code
                  </div>
                  <p className="text-xs text-gray-500 max-w-sm mt-1">
                    Teachers view each student&apos;s independent workspace in strict read-only mode so student edits are never overwritten.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PROCTORING ACTIVITY LOGS */}
        {activeTab === "proctoring" && (
          <div className="flex-1 bg-[#12121a] border border-gray-800 rounded-2xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-amber-950/20 border-b border-amber-500/20 flex items-center justify-between gap-2 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                <span>
                  <strong>Instructor Review Notice:</strong> Proctoring signals (webcam, tab-switch, copy-paste, inactivity, head-pose) are review alerts for instructor judgment, not automatic proof of cheating.
                </span>
              </div>
              <button
                onClick={() =>
                  downloadCsv(
                    `${activeSessionCode}_proctoring_logs.csv`,
                    ["Timestamp", "Student", "Event Type", "Severity", "Details"],
                    logs.map((l) => [l.timestamp, l.studentName, l.eventType, l.severity, l.details])
                  )
                }
                className="flex items-center gap-1.5 bg-[#1a1a24] hover:bg-[#242432] border border-gray-700 text-gray-200 px-3 py-1.5 rounded-lg font-semibold shrink-0"
              >
                <Download size={12} />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#171722] text-gray-400 border-b border-gray-800 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Timestamp</th>
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-4 py-2.5">Event Type</th>
                    <th className="px-4 py-2.5">Severity</th>
                    <th className="px-4 py-2.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/80">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                        No proctoring activity logs recorded for this session yet.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#191926]">
                        <td className="px-4 py-2.5 font-mono text-gray-400 whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-gray-200">{log.studentName}</td>
                        <td className="px-4 py-2.5 font-mono text-indigo-300">{log.eventType}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              log.severity === "alert"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : log.severity === "warning"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            }`}
                          >
                            {log.severity}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-300">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: AUTOMATED EVALUATION REPORTS */}
        {activeTab === "submissions" && (
          <div className="flex-1 bg-[#12121a] border border-gray-800 rounded-2xl overflow-y-auto flex flex-col">
            <div className="px-4 py-3 bg-[#151520] border-b border-gray-800 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                {similarityPairs.length > 0 ? (
                  <span className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-lg font-semibold">
                    <GitCompare size={13} />
                    Similarity Alert:{" "}
                    {similarityPairs
                      .slice(0, 2)
                      .map((p) => `${p.studentA} & ${p.studentB} (${p.similarityPercent}%)`)
                      .join(", ")}
                  </span>
                ) : (
                  <span className="text-gray-400">
                    No high-similarity submission pairs detected (&ge;70% threshold).
                  </span>
                )}
              </div>
              <button
                onClick={() =>
                  downloadCsv(
                    `${activeSessionCode}_evaluation_reports.csv`,
                    ["Student", "Language", "Compilation", "Passed", "Total", "Time (sec)", "Score", "Submitted At"],
                    submissions.map((s) => [
                      s.studentName,
                      s.language,
                      s.compilationStatus,
                      String(s.passedCount),
                      String(s.totalCount),
                      s.executionTimeSec.toFixed(2),
                      String(s.score),
                      s.submittedAt,
                    ])
                  )
                }
                className="flex items-center gap-1.5 bg-[#1a1a24] hover:bg-[#242432] border border-gray-700 text-gray-200 px-3 py-1.5 rounded-lg font-semibold shrink-0"
              >
                <Download size={12} />
                <span>Export CSV</span>
              </button>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#171722] text-gray-400 border-b border-gray-800 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Language</th>
                  <th className="px-4 py-3">Compilation</th>
                  <th className="px-4 py-3">Test Cases</th>
                  <th className="px-4 py-3">Execution Time</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                      No submissions evaluated yet for {activeSessionCode}.
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-[#191926]">
                      <td className="px-4 py-3 font-bold text-white">{sub.studentName}</td>
                      <td className="px-4 py-3 font-mono uppercase text-indigo-300">{sub.language}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`flex items-center gap-1 font-semibold ${
                            sub.compilationStatus === "Successful" ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          <CheckCircle2 size={12} />
                          {sub.compilationStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-200">
                        {sub.passedCount}/{sub.totalCount}
                      </td>
                      <td className="px-4 py-3 font-mono text-sky-300">
                        {sub.executionTimeSec.toFixed(2)} sec
                      </td>
                      <td className="px-4 py-3 font-mono font-extrabold text-emerald-400">
                        {sub.score}/100
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedReport(sub)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-3 py-1 rounded-lg transition"
                        >
                          View Report
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create New Assignment / Session Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#12121a] border border-gray-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-extrabold text-white mb-4">
              Create Classroom / Exam Session
            </h3>

            <form onSubmit={handleCreateSession} className="space-y-3.5 overflow-y-auto pr-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-gray-400 font-bold uppercase block mb-1">Session Title</label>
                  <input
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. DSA Quiz 2"
                    className="w-full bg-[#1a1a24] border border-gray-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-gray-400 font-bold uppercase block mb-1">Join Code</label>
                  <input
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    placeholder="Auto (e.g. DSA-202)"
                    className="w-full bg-[#1a1a24] border border-gray-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {/* Test Duration Selector (Quick Presets + Stepper) */}
                <div className="bg-[#0D1117] border border-[#30363D] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-gray-300 font-bold uppercase flex items-center gap-1.5 text-[11px]">
                      <Clock size={12} className="text-[#60A5FA]" />
                      <span>Test Duration</span>
                    </label>
                    <div className="flex items-center gap-1 bg-[#161B22] border border-[#30363D] rounded-lg px-1.5 py-0.5">
                      <button
                        type="button"
                        onClick={() => setNewDuration((d) => Math.max(5, d - 5))}
                        className="px-1.5 py-0.5 text-gray-400 hover:text-white font-mono font-bold"
                        title="Decrease by 5 mins"
                      >
                        -5
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={300}
                        required
                        value={newDuration}
                        onChange={(e) => setNewDuration(Math.max(1, Math.min(300, Number(e.target.value) || 1)))}
                        className="w-12 bg-transparent text-center text-white font-mono font-bold focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-400 font-mono pr-1">min</span>
                      <button
                        type="button"
                        onClick={() => setNewDuration((d) => Math.min(300, d + 5))}
                        className="px-1.5 py-0.5 text-gray-400 hover:text-white font-mono font-bold"
                        title="Increase by 5 mins"
                      >
                        +5
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-6 gap-1.5">
                    {[15, 30, 45, 60, 90, 120].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setNewDuration(mins)}
                        className={`py-1.5 rounded-lg font-mono text-[11px] font-bold border transition ${
                          newDuration === mins
                            ? "bg-[#3B82F6]/20 text-[#60A5FA] border-[#3B82F6]/50"
                            : "bg-[#161B22] text-gray-400 border-[#30363D] hover:text-gray-200 hover:border-gray-600"
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 font-bold uppercase block mb-1">Default Language</label>
                    <select
                      value={newLang}
                      onChange={(e) => setNewLang(e.target.value as any)}
                      className="w-full bg-[#1a1a24] border border-gray-700 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="python">Python 3</option>
                      <option value="cpp">C++ (GCC)</option>
                      <option value="javascript">JavaScript (Node.js)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 bg-[#1a1a24] border border-gray-700 rounded-xl px-3 py-2 w-full cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newProctoring}
                        onChange={(e) => setNewProctoring(e.target.checked)}
                      />
                      <span>Enable AI Proctoring</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-gray-400 font-bold uppercase block mb-1">Problem Title</label>
                <input
                  required
                  value={newProbTitle}
                  onChange={(e) => setNewProbTitle(e.target.value)}
                  placeholder="e.g. Find Maximum Element"
                  className="w-full bg-[#1a1a24] border border-gray-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-gray-400 font-bold uppercase block mb-1">Problem Description</label>
                <textarea
                  required
                  rows={3}
                  value={newProbDesc}
                  onChange={(e) => setNewProbDesc(e.target.value)}
                  placeholder="Describe input/output format and constraints..."
                  className="w-full bg-[#1a1a24] border border-gray-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {/* Test Cases Builder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-bold uppercase">Predefined Test Cases</span>
                  <button
                    type="button"
                    onClick={() =>
                      setNewTestCases((prev) => [
                        ...prev,
                        { input: "", expectedOutput: "", isHidden: true, points: 10 },
                      ])
                    }
                    className="text-indigo-400 hover:text-indigo-300 font-bold"
                  >
                    + Add Test Case
                  </button>
                </div>

                {newTestCases.map((tc, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-[#181822] p-2 rounded-xl border border-gray-800">
                    <input
                      value={tc.input}
                      onChange={(e) => {
                        const copy = [...newTestCases];
                        copy[idx].input = e.target.value;
                        setNewTestCases(copy);
                      }}
                      placeholder="stdin"
                      className="col-span-5 bg-[#111118] border border-gray-700 rounded-lg px-2 py-1 font-mono text-white"
                    />
                    <input
                      value={tc.expectedOutput}
                      onChange={(e) => {
                        const copy = [...newTestCases];
                        copy[idx].expectedOutput = e.target.value;
                        setNewTestCases(copy);
                      }}
                      placeholder="expected stdout"
                      className="col-span-4 bg-[#111118] border border-gray-700 rounded-lg px-2 py-1 font-mono text-white"
                    />
                    <label className="col-span-2 flex items-center gap-1 text-[10px] text-gray-300">
                      <input
                        type="checkbox"
                        checked={tc.isHidden}
                        onChange={(e) => {
                          const copy = [...newTestCases];
                          copy[idx].isHidden = e.target.checked;
                          setNewTestCases(copy);
                        }}
                      />
                      Hidden
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewTestCases((prev) => prev.filter((_, i) => i !== idx))}
                      className="col-span-1 text-rose-400 hover:text-rose-300 flex justify-center"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl transition"
              >
                Launch Classroom Session
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Evaluation Report Modal */}
      <EvaluationReportModal
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </div>
  );
};
