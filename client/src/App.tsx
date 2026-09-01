import React, { useState, useEffect } from "react";
import { CollabEditor } from "./components/CollabEditor";
import { MetricsDashboard } from "./components/MetricsDashboard";
import { AuthModal } from "./components/AuthModal";
import { ProjectsModal } from "./components/ProjectsModal";

export default function App() {
  const getInitialRoom = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("room") || "major-project-demo";
  };

  const [roomId, setRoomId] = useState<string>(getInitialRoom);
  const [inputRoom, setInputRoom] = useState<string>(roomId);
  const [currentView, setCurrentView] = useState<"editor" | "analytics">("editor");

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
      try { return JSON.parse(savedUser).displayName; } catch (_) {}
    }
    const saved = localStorage.getItem("collab_username");
    return saved || `Dev-${Math.floor(100 + Math.random() * 900)}`;
  });

  const handleUpdateUserName = (newName: string) => {
    setUserName(newName);
    localStorage.setItem("collab_username", newName);
  };

  const switchRoom = (targetRoom: string) => {
    if (!targetRoom.trim()) return;
    setRoomId(targetRoom.trim());
    setInputRoom(targetRoom.trim());

    const newUrl = `${window.location.pathname}?room=${encodeURIComponent(targetRoom.trim())}`;
    window.history.pushState({ path: newUrl }, "", newUrl);
  };

  const createNewRandomRoom = () => {
    const randomId = "room-" + Math.random().toString(36).substring(2, 9);
    switchRoom(randomId);
  };

  const handleAuthSuccess = (user: { displayName: string; email: string }, userToken: string) => {
    setCurrentUser(user);
    setToken(userToken);
    setUserName(user.displayName);
  };

  const handleLogout = () => {
    localStorage.removeItem("collab_token");
    localStorage.removeItem("collab_user");
    setToken(null);
    setCurrentUser(null);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f0f12] text-white overflow-hidden">
      {/* Top Navbar */}
      <header className="px-6 py-3 bg-[#17171c] border-b border-gray-800 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-sm shadow-md">
              {"</>"}
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-gray-100">
                CodeCollab Studio
              </h1>
              <p className="text-[10px] text-gray-400">
                CRDT-Synced Collaborative IDE & Sandbox
              </p>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-[#23232c] p-1 rounded-lg border border-gray-700">
            <button
              onClick={() => setCurrentView("editor")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                currentView === "editor"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              ?? Code Editor
            </button>
            <button
              onClick={() => setCurrentView("analytics")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                currentView === "analytics"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              ?? Live Metrics
            </button>
          </div>
        </div>

        {/* Right Section: Room Controls & User Auth */}
        <div className="flex items-center gap-3">
          {currentView === "editor" && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputRoom}
                onChange={(e) => setInputRoom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && switchRoom(inputRoom)}
                className="bg-[#24242d] text-sm text-white px-3 py-1.5 rounded-lg border border-gray-700 focus:outline-none focus:border-indigo-500 font-mono text-xs w-44"
                placeholder="Enter Room Name"
              />
              <button
                onClick={() => switchRoom(inputRoom)}
                className="bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition shadow"
              >
                Join
              </button>
              <button
                onClick={createNewRandomRoom}
                className="bg-[#24242d] hover:bg-[#30303b] text-gray-300 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-700 transition"
              >
                + New
              </button>
            </div>
          )}

          {/* User Profile & Projects Button */}
          <div className="flex items-center gap-2 pl-3 border-l border-gray-800">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsProjectsOpen(true)}
                  className="bg-[#24242d] hover:bg-[#30303b] text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-500/30 transition shadow-sm"
                >
                  ?? My Projects
                </button>
                <div className="flex items-center gap-1.5 bg-[#1e1e26] px-2.5 py-1 rounded-lg border border-gray-700 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="font-semibold text-gray-200">{currentUser.displayName}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-xs text-gray-400 hover:text-rose-400 transition ml-1"
                  title="Sign Out"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold px-3.5 py-1.5 rounded-lg text-white transition shadow"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 overflow-hidden flex flex-col">
        {currentView === "editor" ? (
          <CollabEditor
            roomId={roomId}
            userName={userName}
            onUpdateUserName={handleUpdateUserName}
          />
        ) : (
          <MetricsDashboard />
        )}
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
