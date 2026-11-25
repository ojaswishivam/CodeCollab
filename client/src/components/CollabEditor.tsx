import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import type { editor } from "monaco-editor";
import {
  Play,
  Loader2,
  Check,
  Download,
  Code2,
  Type,
  Minus,
  Plus,
  ChevronDown,
  Send,
  Shield,
  Users,
  FileText,
  Clock,
} from "lucide-react";
import { PresenceBar, UserAwareness } from "./PresenceBar";
import { ExecutionPanel, ExecutionResult } from "./ExecutionPanel";
import { ProctoringMonitor } from "./ProctoringMonitor";
import { EvaluationReportModal } from "./EvaluationReportModal";
import { API_URL, WS_URL } from "../config";
import { ClassroomSession, SubmissionReport, UserRole } from "../types/codeclass";

interface CollabEditorProps {
  session: ClassroomSession;
  userId: string;
  userName: string;
  userRole: UserRole;
  onUpdateUserName: (name: string) => void;
  onNotify?: (message: string, type?: "info" | "success" | "warning") => void;
}

const USER_COLORS = [
  "#f87171", "#fb923c", "#facc15", "#4ade80",
  "#38bdf8", "#818cf8", "#c084fc", "#f472b6",
];

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 22];

interface LanguageOption {
  id: string;
  name: string;
  runtime: string;
  badgeColor: string;
}

const LANGUAGES: LanguageOption[] = [
  { id: "python", name: "Python", runtime: "Python 3 (v3.11+)", badgeColor: "bg-sky-400" },
  { id: "javascript", name: "JavaScript", runtime: "Node.js (v20+)", badgeColor: "bg-amber-400" },
  { id: "cpp", name: "C++", runtime: "GCC (C++17)", badgeColor: "bg-pink-400" },
];

export const CollabEditor: React.FC<CollabEditorProps> = ({
  session,
  userId,
  userName,
  userRole,
  onUpdateUserName,
  onNotify,
}) => {
  // Independent student workspace in assessment mode; shared CRDT room in collaborative mode
  const effectiveRoomId =
    session.mode === "assessment"
      ? `${session.code}__student__${userId}`
      : `${session.code}__shared`;

  const [editorInstance, setEditorInstance] = useState<editor.IStandaloneCodeEditor | null>(null);
  const [activeUsers, setActiveUsers] = useState<UserAwareness[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [language, setLanguage] = useState<string>(session.language || "python");
  const [isLangMenuOpen, setIsLangMenuOpen] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<number>(14);
  const [isFontMenuOpen, setIsFontMenuOpen] = useState<boolean>(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [evalReport, setEvalReport] = useState<SubmissionReport | null>(null);
  const [stdin, setStdin] = useState<string>(
    session.testCases.find((t) => !t.isHidden)?.input || ""
  );

  const [cursorPos, setCursorPos] = useState({ lineNumber: 1, column: 1 });
  const [charCount, setCharCount] = useState<number>(0);
  const [lineCount, setLineCount] = useState<number>(1);
  const [latencyMs, setLatencyMs] = useState<number>(18);
  const [secondsLeft, setSecondsLeft] = useState<number>(
    (session.durationMinutes || 60) * 60
  );
  const autoSubmittedRef = useRef<boolean>(false);

  const providerRef = useRef<WebsocketProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const metaMapRef = useRef<Y.Map<any> | null>(null);
  const langMenuRef = useRef<HTMLDivElement | null>(null);
  const fontMenuRef = useRef<HTMLDivElement | null>(null);
  const pasteHandlerRef = useRef<(chars: number) => void>(() => {});
  const syncHeartbeatTimerRef = useRef<any>(null);

  const [userColor] = useState(
    () => USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]
  );

  const currentLangObj = useMemo(() => {
    return LANGUAGES.find((l) => l.id === language) || LANGUAGES[0];
  }, [language]);

  // Sync default language and sample stdin when session changes
  useEffect(() => {
    setLanguage(session.language || "python");
    setStdin(session.testCases.find((t) => !t.isHidden)?.input || "");
  }, [session.code, session.language]);

  // Close dropdown menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setIsLangMenuOpen(false);
      }
      if (fontMenuRef.current && !fontMenuRef.current.contains(e.target as Node)) {
        setIsFontMenuOpen(false);
      }
    };
    if (isLangMenuOpen || isFontMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isLangMenuOpen, isFontMenuOpen]);

  // Send workspace snapshot to central Classroom Session Server
  const pushWorkspaceSnapshot = useCallback(
    async (codeSnapshot: string, langSnapshot: string) => {
      if (userRole === "teacher") return;
      try {
        await fetch(`${API_URL}/api/sessions/${session.code}/workspace`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: userId,
            studentName: userName,
            language: langSnapshot,
            code: codeSnapshot,
          }),
        });
      } catch (_) {}
    },
    [session.code, userId, userName, userRole]
  );

  // Initialize Yjs + WebSocket binding for the effectiveRoomId
  useEffect(() => {
    if (!editorInstance) return;

    const ydoc = new Y.Doc();
    docRef.current = ydoc;

    const token = sessionStorage.getItem("collab_token");
    const provider = new WebsocketProvider(WS_URL, effectiveRoomId, ydoc, {
      params: token ? { token } : {},
    });
    providerRef.current = provider;

    const pingStart = Date.now();
    const handleStatus = (event: { status: "connecting" | "connected" | "disconnected" }) => {
      setStatus(event.status);
      if (event.status === "connected") {
        setLatencyMs(Math.max(8, Date.now() - pingStart));
      }
    };
    provider.on("status", handleStatus);
    if (provider.wsconnected) {
      setStatus("connected");
      setLatencyMs(16);
    }

    const metaMap = ydoc.getMap("room-meta");
    metaMapRef.current = metaMap;

    const updateFromMetaMap = () => {
      if (session.mode === "collaborative") {
        const syncedLang = metaMap.get("language");
        if (syncedLang && typeof syncedLang === "string") {
          setLanguage(syncedLang);
        }
      }
      const syncedRunning = metaMap.get("isRunning");
      setIsRunning(Boolean(syncedRunning));

      const syncedResult = metaMap.get("executionResult");
      if (syncedResult) {
        try {
          setExecutionResult(JSON.parse(syncedResult as string));
        } catch (_) {}
      }
    };

    metaMap.observe(updateFromMetaMap);

    provider.awareness.setLocalStateField("user", {
      name: `${userName}${userRole === "teacher" ? " (Instructor)" : ""}`,
      color: userColor,
    });

    const updateAwareness = () => {
      const states = provider.awareness.getStates();
      const usersList: UserAwareness[] = [];
      const myClientId = provider.awareness.clientID;

      states.forEach((state, clientID) => {
        if (state.user) {
          usersList.push({
            id: clientID,
            name: state.user.name || `User-${clientID}`,
            color: state.user.color || "#818cf8",
            isSelf: clientID === myClientId,
          });
        }
      });

      setActiveUsers(usersList);
    };

    provider.awareness.on("change", updateAwareness);
    updateAwareness();

    const model = editorInstance.getModel();
    let binding: any = null;
    if (model) {
      const ytext = ydoc.getText("monaco");

      provider.on("sync", (isSynced: boolean) => {
        if (isSynced) {
          updateFromMetaMap();
          if (ytext.toString().length === 0) {
            const starter =
              session.starterCode?.[session.language] ||
              session.starterCode?.python ||
              "";
            if (starter) {
              ytext.insert(0, starter);
            }
          }
          setCharCount(model.getValueLength());
          setLineCount(model.getLineCount());
          pushWorkspaceSnapshot(ytext.toString(), language);
        }
      });

      binding = new MonacoBinding(
        ytext,
        model,
        new Set([editorInstance]),
        provider.awareness
      );

      const cursorDisposable = editorInstance.onDidChangeCursorPosition((e) => {
        setCursorPos({ lineNumber: e.position.lineNumber, column: e.position.column });
      });

      const contentDisposable = model.onDidChangeContent(() => {
        setCharCount(model.getValueLength());
        setLineCount(model.getLineCount());
        if (syncHeartbeatTimerRef.current) clearTimeout(syncHeartbeatTimerRef.current);
        syncHeartbeatTimerRef.current = setTimeout(() => {
          pushWorkspaceSnapshot(model.getValue(), language);
        }, 1200);
      });

      const pasteDisposable = editorInstance.onDidPaste((e) => {
        const pastedChars = model.getValueInRange(e.range).length;
        pasteHandlerRef.current(pastedChars);
      });

      return () => {
        cursorDisposable.dispose();
        contentDisposable.dispose();
        pasteDisposable.dispose();
        if (syncHeartbeatTimerRef.current) clearTimeout(syncHeartbeatTimerRef.current);
        metaMap.unobserve(updateFromMetaMap);
        try {
          if (binding && typeof binding.destroy === "function") binding.destroy();
        } catch (_) {}
        provider.destroy();
        ydoc.destroy();
      };
    }

    return () => {
      provider.off("status", handleStatus);
      provider.awareness.off("change", updateAwareness);
      if (binding && typeof binding.destroy === "function") binding.destroy();
      provider.destroy();
      ydoc.destroy();
    };
  }, [editorInstance, effectiveRoomId]);

  useEffect(() => {
    if (providerRef.current) {
      providerRef.current.awareness.setLocalStateField("user", {
        name: `${userName}${userRole === "teacher" ? " (Instructor)" : ""}`,
        color: userColor,
      });
    }
  }, [userName, userColor, userRole]);

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    setIsLangMenuOpen(false);
    if (metaMapRef.current && session.mode === "collaborative") {
      metaMapRef.current.set("language", newLang);
    }

    if (docRef.current) {
      const ytext = docRef.current.getText("monaco");
      const currentCode = ytext.toString().trim();
      const isStarter = Object.values(session.starterCode || {}).some(
        (tpl) => tpl.trim() === currentCode
      );
      if ((isStarter || currentCode.length === 0) && session.starterCode?.[newLang]) {
        ytext.delete(0, ytext.length);
        ytext.insert(0, session.starterCode[newLang]);
      }
    }
  };

  const handleFontSizeChange = (newSize: number) => {
    setFontSize(newSize);
    setIsFontMenuOpen(false);
    if (editorInstance) {
      editorInstance.updateOptions({ fontSize: newSize });
    }
  };

  const runCodeRef = useRef<() => void>(() => {});

  const handleRunCode = useCallback(async () => {
    if (isRunning || !metaMapRef.current) return;

    const code = editorInstance
      ? editorInstance.getValue()
      : docRef.current?.getText("monaco").toString() || "";

    if (!code.trim()) {
      if (onNotify) onNotify("Code editor is empty!", "warning");
      return;
    }

    metaMapRef.current.set("isRunning", true);

    try {
      const response = await fetch(`${API_URL}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, stdin }),
      });

      const data: ExecutionResult = await response.json();
      metaMapRef.current.set("executionResult", JSON.stringify(data));
      if (onNotify) {
        onNotify(
          `Execution finished (${data.durationMs}ms)`,
          data.status === "success" ? "success" : "warning"
        );
      }
    } catch (err: any) {
      const errorResult: ExecutionResult = {
        stdout: "",
        stderr: "Failed to connect to execution engine: " + err.message,
        exitCode: 1,
        durationMs: 0,
        status: "runtime_error",
        mode: "local_isolated",
      };
      metaMapRef.current.set("executionResult", JSON.stringify(errorResult));
    } finally {
      metaMapRef.current.set("isRunning", false);
    }
  }, [isRunning, language, stdin, editorInstance, onNotify]);

  // Module 5: Automated Code Evaluation Submission
  const handleEvaluateSubmission = async () => {
    if (isEvaluating) return;
    const code = editorInstance
      ? editorInstance.getValue()
      : docRef.current?.getText("monaco").toString() || "";

    if (!code.trim()) {
      if (onNotify) onNotify("Write a solution before submitting!", "warning");
      return;
    }

    setIsEvaluating(true);
    try {
      const res = await fetch(`${API_URL}/api/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionCode: session.code,
          studentId: userId,
          studentName: userName,
          language,
          code,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Evaluation failed");

      setEvalReport(data.report);
      if (onNotify) {
        onNotify(
          `Evaluated: ${data.report.passedCount}/${data.report.totalCount} test cases passed (Score: ${data.report.score}/100)`,
          data.report.score === 100 ? "success" : "info"
        );
      }
    } catch (err: any) {
      if (onNotify) onNotify(err.message || "Submission failed", "warning");
    } finally {
      setIsEvaluating(false);
    }
  };

  useEffect(() => {
    runCodeRef.current = handleRunCode;
  }, [handleRunCode]);

  const handleDownloadCode = () => {
    if (!docRef.current) return;
    const code = docRef.current.getText("monaco").toString();
    const extMap: Record<string, string> = { javascript: "js", python: "py", cpp: "cpp" };
    const ext = extMap[language] || "txt";
    const filename = `codeclass_${session.code}_${userName}.${ext}`;
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearConsole = () => {
    if (metaMapRef.current) {
      metaMapRef.current.delete("executionResult");
    }
    setExecutionResult(null);
  };

  // Exam countdown timer & auto-submit in assessment mode
  useEffect(() => {
    if (session.mode !== "assessment" || userRole !== "student") return;

    const storageKey = `codeclass_exam_end_${session.code}_${userId}`;
    let endTime = Number(localStorage.getItem(storageKey));
    if (!endTime || Number.isNaN(endTime)) {
      endTime = Date.now() + (session.durationMinutes || 60) * 60 * 1000;
      localStorage.setItem(storageKey, String(endTime));
    }
    autoSubmittedRef.current = false;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining === 300 && onNotify) {
        onNotify("5 minutes remaining in assessment!", "warning");
      }
      if (remaining === 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        if (onNotify) onNotify("Time expired — auto-submitting solution for evaluation...", "warning");
        handleEvaluateSubmission();
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session.code, session.mode, session.durationMinutes, userId, userRole]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-3 overflow-hidden">
      {/* Left Sidebar: Problem Statement + Consent-Based Proctoring Monitor */}
      <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-3 overflow-y-auto pr-0.5">
        {/* Session & Problem Card */}
        <div className="bg-[#12121a] border border-gray-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
              {session.code}
            </span>
            {session.mode === "assessment" && userRole === "student" && (
              <span
                className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  secondsLeft <= 300
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                    : "bg-[#1a1a26] text-sky-300 border-gray-700"
                }`}
              >
                <Clock size={10} />
                {formatTimer(secondsLeft)}
              </span>
            )}
            {session.mode === "assessment" ? (
              <span className="flex items-center gap-1 text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                <Shield size={10} />
                Isolated Workspace
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                <Users size={10} />
                Shared CRDT Lab
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              <FileText size={12} className="text-indigo-400" />
              <span>Assignment Problem</span>
            </div>
            <h3 className="text-sm font-extrabold text-white">{session.problemTitle}</h3>
            <p className="text-xs text-gray-300 whitespace-pre-line mt-1.5 leading-relaxed">
              {session.problemDescription}
            </p>
          </div>

          {/* Sample Visible Test Cases */}
          <div className="space-y-1.5 pt-2 border-t border-gray-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Sample Test Cases ({session.testCases.length} Total)
            </div>
            {session.testCases
              .filter((tc) => !tc.isHidden)
              .slice(0, 2)
              .map((tc, i) => (
                <div
                  key={tc.id}
                  className="bg-[#0c0c12] border border-gray-800 rounded-xl p-2 text-[11px] font-mono space-y-1"
                >
                  <div className="text-gray-400">
                    <span className="text-indigo-400 font-bold">#{i + 1} In:</span>{" "}
                    {tc.input.replace(/\n/g, " | ").trim() || "(none)"}
                  </div>
                  <div className="text-emerald-300">
                    <span className="text-gray-400 font-bold">Out:</span> {tc.expectedOutput}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Proctoring Monitor (for Students in Assessment Mode) */}
        <ProctoringMonitor
          sessionCode={session.code}
          studentId={userId}
          studentName={userName}
          enabled={session.proctoringEnabled && userRole === "student"}
          inactivityThresholdSec={session.inactivityThresholdSec}
          onAlertToast={onNotify}
          registerPasteHandler={(fn) => {
            pasteHandlerRef.current = fn;
          }}
        />
      </aside>

      {/* Right Main Area: Presence Bar + Monaco Editor + Execution Console */}
      <div className="flex-1 flex flex-col h-full gap-2.5 overflow-hidden select-none">
        <PresenceBar
          users={activeUsers}
          currentUserName={userName}
          roomId={effectiveRoomId}
          onUpdateName={onUpdateUserName}
        />

        <div className="flex-1 flex flex-col bg-[#101017] rounded-2xl overflow-hidden border border-gray-800/90 shadow-2xl">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#15151e] border-b border-gray-800 text-sm gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Language Dropdown */}
              <div ref={langMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsLangMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 bg-[#1e1e28] hover:bg-[#252533] px-3 py-1.5 rounded-lg border border-gray-700/80 text-xs font-semibold text-gray-200 transition shadow-sm"
                >
                  <Code2 size={13} className="text-indigo-400" />
                  <span>{currentLangObj.name}</span>
                  <ChevronDown
                    size={11}
                    className={`text-gray-400 transition-transform ${isLangMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isLangMenuOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-48 bg-[#181824] border border-gray-700 rounded-xl shadow-2xl py-1 z-30 flex flex-col">
                    {LANGUAGES.map((langItem) => (
                      <button
                        key={langItem.id}
                        type="button"
                        onClick={() => handleLanguageChange(langItem.id)}
                        className={`flex items-center justify-between px-3 py-2 text-xs text-left transition ${
                          language === langItem.id
                            ? "bg-indigo-600/20 text-indigo-300 font-bold"
                            : "text-gray-200 hover:bg-[#222232]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${langItem.badgeColor}`} />
                          <span>{langItem.name}</span>
                        </div>
                        {language === langItem.id && <Check size={13} className="text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Run Code */}
              <button
                onClick={handleRunCode}
                disabled={isRunning}
                className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg text-white transition shadow-md ${
                  isRunning
                    ? "bg-gray-700 cursor-not-allowed opacity-80"
                    : "bg-[#222230] hover:bg-[#2c2c3d] border border-gray-700"
                }`}
              >
                {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                <span>{isRunning ? "Running..." : "Run Sample"}</span>
              </button>

              {/* Module 5: Submit & Evaluate */}
              <button
                onClick={handleEvaluateSubmission}
                disabled={isEvaluating}
                className={`flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-lg text-white transition shadow-md ${
                  isEvaluating
                    ? "bg-gray-700 cursor-not-allowed opacity-80"
                    : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40"
                }`}
              >
                {isEvaluating ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
                <span>{isEvaluating ? "Evaluating..." : "Submit & Evaluate"}</span>
              </button>
            </div>

            {/* Right Controls: Font Size + Download */}
            <div className="flex items-center gap-2">
              <div
                ref={fontMenuRef}
                className="relative flex items-center bg-[#1e1e28] rounded-lg border border-gray-700/80 p-0.5 text-xs text-gray-300"
              >
                <button
                  type="button"
                  onClick={() => handleFontSizeChange(Math.max(11, fontSize - 1))}
                  className="p-1 hover:text-white rounded"
                >
                  <Minus size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsFontMenuOpen((prev) => !prev)}
                  className="flex items-center gap-1 px-1.5 py-0.5 font-mono text-xs font-bold text-gray-200"
                >
                  <Type size={11} className="text-gray-400" />
                  <span>{fontSize}px</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFontSizeChange(Math.min(24, fontSize + 1))}
                  className="p-1 hover:text-white rounded"
                >
                  <Plus size={11} />
                </button>
                {isFontMenuOpen && (
                  <div className="absolute top-full right-0 mt-1.5 w-28 bg-[#181824] border border-gray-700 rounded-xl shadow-2xl py-1 z-30 flex flex-col">
                    {FONT_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handleFontSizeChange(size)}
                        className="px-3 py-1.5 text-xs text-left font-mono text-gray-300 hover:bg-[#222232]"
                      >
                        {size}px
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleDownloadCode}
                className="p-1.5 bg-[#1e1e28] hover:bg-[#282836] text-gray-300 hover:text-white rounded-lg border border-gray-700/80 transition"
                title="Download source code"
              >
                <Download size={13} />
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 min-h-[240px] relative">
            <Editor
              height="100%"
              theme="vs-dark"
              language={language}
              onMount={(editor, monaco) => {
                setEditorInstance(editor);
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                  runCodeRef.current();
                });
              }}
              options={{
                readOnly: userRole === "teacher" && session.mode === "assessment",
                automaticLayout: true,
                fontSize: fontSize,
                fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
                minimap: { enabled: false },
                wordWrap: "on",
                padding: { top: 12, bottom: 12 },
                smoothScrolling: true,
                cursorBlinking: "smooth",
              }}
            />
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between px-3.5 py-1 bg-[#121218] border-t border-gray-800 text-[11px] text-gray-400 font-mono">
            <div className="flex items-center gap-3">
              <span>
                Ln {cursorPos.lineNumber}, Col {cursorPos.column}
              </span>
              <span className="hidden sm:inline text-gray-600">|</span>
              <span className="hidden sm:inline">
                {lineCount} lines, {charCount} chars
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden md:inline text-gray-400">
                {session.mode === "assessment" ? "Isolated Workspace" : "Shared CRDT"}
              </span>
              <span className="hidden md:inline text-gray-600">|</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    status === "connected" ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
                  }`}
                />
                <span className={status === "connected" ? "text-emerald-300" : "text-amber-300"}>
                  {status === "connected" ? `Synced (${latencyMs}ms)` : status}
                </span>
              </div>
            </div>
          </div>

          {/* Execution Console */}
          <ExecutionPanel
            result={executionResult}
            isRunning={isRunning}
            stdin={stdin}
            onChangeStdin={setStdin}
            onClear={handleClearConsole}
            onNotify={onNotify}
          />
        </div>
      </div>

      {/* Module 5 Automated Evaluation Report Modal */}
      <EvaluationReportModal
        report={evalReport}
        onClose={() => setEvalReport(null)}
      />
    </div>
  );
};
