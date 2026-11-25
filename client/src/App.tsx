import { useState, useEffect, useCallback } from "react";
import {
  Code2,
  Activity,
  LogIn,
  LogOut,
  Info,
  CheckCircle,
  AlertCircle,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import { CollabEditor } from "./components/CollabEditor";
import { MetricsDashboard } from "./components/MetricsDashboard";
import { TeacherDashboard } from "./components/TeacherDashboard";
import { AuthModal } from "./components/AuthModal";
import { API_URL } from "./config";
import { ClassroomSession, UserProfile } from "./types/codeclass";

interface ToastMessage {
  id: string;
  text: string;
  type: "info" | "success" | "warning";
}

export default function App() {
  const getInitialSessionCode = () => {
    const params = new URLSearchParams(window.location.search);
    return (params.get("session") || params.get("room") || "CS301-EXAM").toUpperCase();
  };

  const [sessions, setSessions] = useState<ClassroomSession[]>([]);
  const [activeSessionCode, setActiveSessionCode] = useState<string>(getInitialSessionCode);
  const [joinInput, setJoinInput] = useState<string>(activeSessionCode);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Auth State (per-tab sessionStorage so Teacher and Student tabs never overwrite each other)
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem("collab_token"));
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = sessionStorage.getItem("collab_user");
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });

  const [guestId] = useState<string>(() => {
    const saved = sessionStorage.getItem("codeclass_guest_id");
    if (saved) return saved;
    const id = "stu_" + Math.random().toString(36).substring(2, 8);
    sessionStorage.setItem("codeclass_guest_id", id);
    return id;
  });

  const [userName, setUserName] = useState<string>(() => {
    const savedUser = sessionStorage.getItem("collab_user");
    if (savedUser) {
      try {
        return JSON.parse(savedUser).displayName;
      } catch (_) {}
    }
    const saved = sessionStorage.getItem("collab_username");
    return saved || `Student-${Math.floor(100 + Math.random() * 900)}`;
  });

  const [currentView, setCurrentView] = useState<"workspace" | "teacher" | "analytics">(() =>
    currentUser?.role === "teacher" ? "teacher" : "workspace"
  );

  const addToast = useCallback((text: string, type: "info" | "success" | "warning" = "info") => {
    const id = "toast_" + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/api/sessions`, { headers });
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error("Failed to load classroom sessions", err);
    }
  }, [token]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleUpdateUserName = (newName: string) => {
    setUserName(newName);
    sessionStorage.setItem("collab_username", newName);
    addToast(`Display name updated to "${newName}"`, "success");
  };

  const switchSession = (targetCode: string) => {
    const cleanCode = targetCode.trim().toUpperCase();
    if (!cleanCode) return;
    setActiveSessionCode(cleanCode);
    setJoinInput(cleanCode);
    const newUrl = `${window.location.pathname}?session=${encodeURIComponent(cleanCode)}`;
    window.history.pushState({ path: newUrl }, "", newUrl);
    addToast(`Switched to session: ${cleanCode}`, "info");
  };

  const handleAuthSuccess = (user: UserProfile, userToken: string) => {
    setCurrentUser(user);
    setToken(userToken);
    setUserName(user.displayName);
    setCurrentView(user.role === "teacher" ? "teacher" : "workspace");
    addToast(`Signed in as ${user.displayName} (${user.role})`, "success");
  };

  const handleLogout = () => {
    sessionStorage.removeItem("collab_token");
    sessionStorage.removeItem("collab_user");
    setToken(null);
    setCurrentUser(null);
    setUserName(sessionStorage.getItem("collab_username") || `Student-${Math.floor(100 + Math.random() * 900)}`);
    setCurrentView("workspace");
    addToast("Logged out successfully", "info");
  };

  const activeSession =
    sessions.find((s) => s.code === activeSessionCode) || sessions[0] || null;
  const effectiveUserId = currentUser?.id || guestId;
  const effectiveRole = currentUser?.role || "student";

  return (
    <div className="h-screen w-screen flex flex-col bg-[#07070a] text-white overflow-hidden font-sans">
      {/* Top Navigation Header */}
      <header className="px-5 py-2.5 bg-[#0f0f16] border-b border-gray-800 flex items-center justify-between shadow-lg z-10 shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-5">
          {/* CodeClass Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <GraduationCap size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold tracking-tight text-white">
                  CodeClass
                </h1>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-mono px-1.5 py-0.2 rounded border border-indigo-500/30">
                  Proctored IDE
                </span>
              </div>
              <p className="text-[10px] text-gray-400">
                Collaborative Coding, Automated Evaluation & Online Proctoring
              </p>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-[#171722] p-1 rounded-xl border border-gray-700/80">
            <button
              onClick={() => setCurrentView("workspace")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                currentView === "workspace"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Code2 size={13} />
              <span>Student Workspace</span>
            </button>

            {effectiveRole === "teacher" && (
              <button
                onClick={() => setCurrentView("teacher")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  currentView === "teacher"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <BookOpen size={13} />
                <span>Teacher Dashboard</span>
              </button>
            )}

            <button
              onClick={() => setCurrentView("analytics")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                currentView === "analytics"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Activity size={13} />
              <span>Telemetry</span>
            </button>
          </div>
        </div>

        {/* Right Controls: Session Joiner & Auth */}
        <div className="flex items-center gap-3">
          {currentView === "workspace" && (
            <div className="flex items-center gap-1.5">
              <select
                value={activeSessionCode}
                onChange={(e) => switchSession(e.target.value)}
                className="bg-[#171722] text-xs text-indigo-300 font-bold px-2.5 py-1.5 rounded-xl border border-gray-700 focus:outline-none focus:border-indigo-500"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.code} ({s.mode === "assessment" ? "Exam" : "Collab"})
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && switchSession(joinInput)}
                className="bg-[#171722] text-xs text-white px-2.5 py-1.5 rounded-xl border border-gray-700 focus:outline-none focus:border-indigo-500 font-mono w-28 placeholder-gray-500"
                placeholder="Code"
              />
              <button
                onClick={() => switchSession(joinInput)}
                className="bg-indigo-600 hover:bg-indigo-500 text-xs font-bold px-3 py-1.5 rounded-xl text-white transition shadow"
              >
                Join
              </button>
            </div>
          )}

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-3 border-l border-gray-800">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-[#14141c] px-3 py-1 rounded-xl border border-gray-700/80 text-xs">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      currentUser.role === "teacher" ? "bg-purple-400" : "bg-emerald-400"
                    }`}
                  />
                  <span className="font-semibold text-gray-200">{currentUser.displayName}</span>
                  <span className="text-[10px] uppercase font-mono text-gray-400">
                    ({currentUser.role})
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                  title="Sign Out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold px-3.5 py-1.5 rounded-xl text-white transition shadow-md shadow-indigo-600/30"
              >
                <LogIn size={13} />
                <span>Sign In / Role Demo</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 p-3 overflow-hidden flex flex-col relative">
        {currentView === "teacher" && effectiveRole === "teacher" ? (
          <TeacherDashboard
            token={token}
            sessions={sessions}
            activeSessionCode={activeSessionCode}
            onSelectSession={switchSession}
            onSessionsUpdated={fetchSessions}
            onNotify={addToast}
          />
        ) : currentView === "analytics" ? (
          <MetricsDashboard />
        ) : activeSession ? (
          <CollabEditor
            session={activeSession}
            userId={effectiveUserId}
            userName={userName}
            userRole={effectiveRole}
            onUpdateUserName={handleUpdateUserName}
            onNotify={addToast}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Loading classroom session...
          </div>
        )}

        {/* Floating Toast Notification System */}
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-2xl backdrop-blur-md border pointer-events-auto animate-slide-down ${
                toast.type === "success"
                  ? "bg-[#0d1c16]/95 border-emerald-500/40 text-emerald-300"
                  : toast.type === "warning"
                  ? "bg-[#1c160d]/95 border-amber-500/40 text-amber-300"
                  : "bg-[#12121e]/95 border-indigo-500/40 text-indigo-200"
              }`}
            >
              {toast.type === "success" && (
                <CheckCircle size={14} className="text-emerald-400 shrink-0" />
              )}
              {toast.type === "warning" && (
                <AlertCircle size={14} className="text-amber-400 shrink-0" />
              )}
              {toast.type === "info" && (
                <Info size={14} className="text-indigo-400 shrink-0" />
              )}
              <span>{toast.text}</span>
            </div>
          ))}
        </div>
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
