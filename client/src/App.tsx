import { useState } from "react";
import {
  Code2,
  Activity,
  Plus,
  LogIn,
  LogOut,
  FolderGit2,
  Info,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { CollabEditor } from "./components/CollabEditor";
import { MetricsDashboard } from "./components/MetricsDashboard";
import { AuthModal } from "./components/AuthModal";
import { ProjectsModal } from "./components/ProjectsModal";

interface ToastMessage {
  id: string;
  text: string;
  type: "info" | "success" | "warning";
}

export default function App() {
  const getInitialRoom = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("room") || "major-project-demo";
  };

  const [roomId, setRoomId] = useState<string>(getInitialRoom);
  const [inputRoom, setInputRoom] = useState<string>(roomId);
  const [currentView, setCurrentView] = useState<"editor" | "analytics">("editor");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Auth State
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("collab_token"));
  const [currentUser, setCurrentUser] = useState<{ displayName: string; email: string } | null>(() => {
    const saved = localStorage.getItem("collab_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [userName, setUserName] = useState<string>(() => {
    const savedUser = localStorage.getItem("collab_user");
    if (savedUser) {
      try {
        return JSON.parse(savedUser).displayName;
      } catch (_) {}
    }
    const saved = localStorage.getItem("collab_username");
    return saved || `Dev-${Math.floor(100 + Math.random() * 900)}`;
  });

  const addToast = (text: string, type: "info" | "success" | "warning" = "info") => {
    const id = "toast_" + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleUpdateUserName = (newName: string) => {
    setUserName(newName);
    localStorage.setItem("collab_username", newName);
    addToast(`Display name updated to "${newName}"`, "success");
  };

  const switchRoom = (targetRoom: string) => {
    if (!targetRoom.trim()) return;
    const cleanRoom = targetRoom.trim();
    setRoomId(cleanRoom);
    setInputRoom(cleanRoom);

    const newUrl = `${window.location.pathname}?room=${encodeURIComponent(cleanRoom)}`;
    window.history.pushState({ path: newUrl }, "", newUrl);
    addToast(`Joined room: ${cleanRoom}`, "info");
  };

  const createNewRandomRoom = () => {
    const randomId = "room-" + Math.random().toString(36).substring(2, 9);
    switchRoom(randomId);
  };

  const handleAuthSuccess = (user: { displayName: string; email: string }, userToken: string) => {
    setCurrentUser(user);
    setToken(userToken);
    setUserName(user.displayName);
    addToast(`Welcome back, ${user.displayName}!`, "success");
  };

  const handleLogout = () => {
    localStorage.removeItem("collab_token");
    localStorage.removeItem("collab_user");
    setToken(null);
    setCurrentUser(null);
    addToast("Logged out successfully", "info");
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#07070a] text-white overflow-hidden font-sans">
      {/* Top Navigation Header */}
      <header className="px-5 py-2.5 bg-[#0f0f16] border-b border-gray-800 flex items-center justify-between shadow-lg z-10 shrink-0">
        <div className="flex items-center gap-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Code2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold tracking-tight text-white">
                  CodeCollab Studio
                </h1>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-mono px-1.5 py-0.2 rounded border border-indigo-500/30">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-gray-400">
                CRDT Real-Time IDE & Cloud Sandbox
              </p>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-[#171722] p-1 rounded-xl border border-gray-700/80">
            <button
              onClick={() => setCurrentView("editor")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                currentView === "editor"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Code2 size={13} />
              <span>Studio Editor</span>
            </button>
            <button
              onClick={() => setCurrentView("analytics")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                currentView === "analytics"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Activity size={13} />
              <span>Live Telemetry</span>
            </button>
          </div>
        </div>

        {/* Right Controls: Room Switcher & User Auth */}
        <div className="flex items-center gap-3">
          {currentView === "editor" && (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={inputRoom}
                onChange={(e) => setInputRoom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && switchRoom(inputRoom)}
                className="bg-[#171722] text-xs text-white px-3 py-1.5 rounded-xl border border-gray-700 focus:outline-none focus:border-indigo-500 font-mono w-40 sm:w-48 placeholder-gray-500"
                placeholder="Enter Room ID"
              />
              <button
                onClick={() => switchRoom(inputRoom)}
                className="bg-indigo-600 hover:bg-indigo-500 text-xs font-bold px-3 py-1.5 rounded-xl text-white transition shadow active:scale-95"
              >
                Join
              </button>
              <button
                onClick={createNewRandomRoom}
                className="flex items-center gap-1 bg-[#171722] hover:bg-[#232330] text-gray-300 hover:text-white text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-gray-700 transition"
                title="Create New Instant Room"
              >
                <Plus size={12} />
                <span>New</span>
              </button>
            </div>
          )}

          {/* User Profile & Projects Button */}
          <div className="flex items-center gap-2 pl-3 border-l border-gray-800">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsProjectsOpen(true)}
                  className="flex items-center gap-1.5 bg-[#171722] hover:bg-[#232330] text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-xl border border-indigo-500/30 transition shadow-sm"
                >
                  <FolderGit2 size={13} />
                  <span>My Workspaces</span>
                </button>
                <div className="flex items-center gap-1.5 bg-[#14141c] px-3 py-1 rounded-xl border border-gray-700/80 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]"></span>
                  <span className="font-semibold text-gray-200">
                    {currentUser.displayName}
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
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold px-3.5 py-1.5 rounded-xl text-white transition shadow-md shadow-indigo-600/30 active:scale-95"
              >
                <LogIn size={13} />
                <span>Sign In / Demo</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 p-3 overflow-hidden flex flex-col relative">
        {currentView === "editor" ? (
          <CollabEditor
            roomId={roomId}
            userName={userName}
            onUpdateUserName={handleUpdateUserName}
            onNotify={addToast}
          />
        ) : (
          <MetricsDashboard />
        )}

        {/* Floating Toast Notification System */}
        <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 pointer-events-none">
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
              {toast.type === "success" && <CheckCircle size={14} className="text-emerald-400 shrink-0" />}
              {toast.type === "warning" && <AlertCircle size={14} className="text-amber-400 shrink-0" />}
              {toast.type === "info" && <Info size={14} className="text-indigo-400 shrink-0" />}
              <span>{toast.text}</span>
            </div>
          ))}
        </div>
      </main>

      {/* Auth & Projects Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />
      <ProjectsModal
        isOpen={isProjectsOpen}
        onClose={() => setIsProjectsOpen(false)}
        onSelectProject={switchRoom}
        token={token}
      />
    </div>
  );
}
