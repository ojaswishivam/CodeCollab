import React, { useEffect, useState, useMemo } from "react";
import {
  X,
  FolderGit2,
  Plus,
  Search,
  ExternalLink,
  Trash2,
  Code2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { API_URL } from "../config";

interface Project {
  id: string;
  room_id?: string;
  roomId?: string;
  name: string;
  language: string;
  created_at?: string;
  createdAt?: string;
}

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (roomId: string) => void;
  token: string | null;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  onSelectProject,
  token,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newLanguage, setNewLanguage] = useState("javascript");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchProjects = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.projects) setProjects(data.projects);
    } catch (err) {
      console.error("Failed to load projects", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      setError("");
    }
  }, [isOpen, token]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const langMatch = p.language.toLowerCase().includes(searchQuery.toLowerCase());
      const rId = (p.room_id || p.roomId || "").toLowerCase();
      return nameMatch || langMatch || rId.includes(searchQuery.toLowerCase());
    });
  }, [projects, searchQuery]);

  if (!isOpen) return null;

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !token) return;

    setActionLoading(true);
    setError("");
    const generatedRoomId = "proj-" + Math.random().toString(36).substring(2, 9);

    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newProjectName.trim(),
          roomId: generatedRoomId,
          language: newLanguage,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create project");

      if (data.project) {
        setNewProjectName("");
        await fetchProjects();
        onSelectProject(generatedRoomId);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Failed to create workspace");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    if (!window.confirm("Are you sure you want to delete this workspace?")) return;

    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      }
    } catch (err) {
      console.error("Failed to delete project", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-slide-down">
      <div className="bg-[#12121a] border border-gray-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl relative flex flex-col max-h-[88vh] overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
          title="Close Modal"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <FolderGit2 size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Collaborative Projects & Workspaces
            </h2>
            <p className="text-xs text-gray-400">
              Save, organize, and rejoin persistent real-time CRDT sessions.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs px-3 py-2 rounded-xl mb-3 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Create Project Form */}
        <form
          onSubmit={handleCreateProject}
          className="bg-[#181822] p-4 rounded-2xl border border-gray-700/80 mb-4 flex flex-col gap-2.5 shadow-sm"
        >
          <span className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
            <Plus size={13} className="text-indigo-400" />
            <span>Create New Workspace</span>
          </span>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project Name (e.g. Distributed Consensus Engine)"
              className="flex-1 bg-[#101017] text-xs text-white px-3 py-2.5 rounded-xl border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
            <select
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
              className="bg-[#101017] text-xs text-indigo-300 font-semibold px-3 py-2.5 rounded-xl border border-gray-700 focus:outline-none cursor-pointer"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
            </select>
            <button
              type="submit"
              disabled={actionLoading}
              className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white px-4 py-2.5 rounded-xl transition shadow active:scale-95 whitespace-nowrap"
            >
              {actionLoading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Plus size={13} />
              )}
              <span>Create & Open</span>
            </button>
          </div>
        </form>

        {/* Search Filter */}
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Saved Workspaces ({filteredProjects.length})
          </span>
          <div className="flex items-center bg-[#181822] px-2.5 py-1 rounded-lg border border-gray-700 text-xs">
            <Search size={12} className="text-gray-400 mr-1.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="bg-transparent text-gray-200 placeholder-gray-500 text-xs focus:outline-none w-32"
            />
          </div>
        </div>

        {/* Saved Projects List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-xs text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin text-indigo-400" />
              <span>Loading saved workspaces...</span>
            </div>
          ) : filteredProjects.length > 0 ? (
            filteredProjects.map((p) => {
              const rId = p.room_id || p.roomId || "demo";
              const rawDate = p.created_at || p.createdAt;
              const dateStr = rawDate ? new Date(rawDate).toLocaleDateString() : "Active";

              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3.5 bg-[#181822] hover:bg-[#1f1f2c] border border-gray-800 hover:border-gray-700 rounded-2xl transition group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                      <Code2 size={16} />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-sm font-semibold text-gray-100 truncate">
                        {p.name}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                        <span className="bg-indigo-900/40 text-indigo-300 px-1.5 py-0.2 rounded uppercase font-mono font-bold text-[9px]">
                          {p.language}
                        </span>
                        <span className="text-gray-500">|</span>
                        <span>
                          Room: <code className="text-gray-300 font-mono">{rId}</code>
                        </span>
                        <span className="hidden sm:inline text-gray-500">|</span>
                        <span className="hidden sm:inline text-gray-500">{dateStr}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        onSelectProject(rId);
                        onClose();
                      }}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition shadow active:scale-95"
                    >
                      <span>Open</span>
                      <ExternalLink size={12} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteProject(p.id, e)}
                      className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      title="Delete Workspace"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-xs text-gray-500 bg-[#14141c] rounded-2xl border border-gray-800/60 p-4">
              <p>No saved projects match your query.</p>
              <p className="text-[11px] text-gray-600 mt-1">
                Create a new collaborative project using the form above!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
