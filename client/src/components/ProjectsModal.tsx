import React, { useEffect, useState } from "react";

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
  const [loading, setLoading] = useState(false);

  const fetchProjects = async () => {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:1234/api/projects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.projects) setProjects(data.projects);
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  };

  useEffect(() => {
    if (isOpen) fetchProjects();
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !token) return;

    setLoading(true);
    const generatedRoomId = "proj-" + Math.random().toString(36).substring(2, 9);

    try {
      const res = await fetch("http://localhost:1234/api/projects", {
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
      if (data.project) {
        setNewProjectName("");
        fetchProjects();
        onSelectProject(generatedRoomId);
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#18181f] border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg"
        >
          ?
        </button>

        <h2 className="text-xl font-bold text-white mb-1">Collaborative Projects</h2>
        <p className="text-xs text-gray-400 mb-4">
          Save, manage, and jump into your persistent collaborative workspaces.
        </p>

        {/* Create Project Form */}
        <form onSubmit={handleCreateProject} className="bg-[#20202a] p-3.5 rounded-xl border border-gray-700/80 mb-4 flex flex-col gap-2.5">
          <span className="text-xs font-semibold text-gray-300">Create New Project</span>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project Name (e.g. Distributed Sorting)"
              className="flex-1 bg-[#14141a] text-xs text-white px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
            <select
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
              className="bg-[#14141a] text-xs text-indigo-300 font-semibold px-2.5 py-2 rounded-lg border border-gray-700"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white px-3.5 py-2 rounded-lg transition"
            >
              + Create
            </button>
          </div>
        </form>

        {/* Saved Projects List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
            Saved Workspaces ({projects.length})
          </span>

          {projects.length > 0 ? (
            projects.map((p) => {
              const rId = p.room_id || p.roomId || "demo";
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-[#202029] hover:bg-[#282833] border border-gray-800 rounded-xl transition group"
                >
                  <div>
                    <h4 className="text-sm font-semibold text-gray-200">{p.name}</h4>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                      <span className="bg-indigo-900/40 text-indigo-300 px-1.5 py-0.2 rounded uppercase font-mono">
                        {p.language}
                      </span>
                      <span>Room: <code className="text-gray-300">{rId}</code></span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onSelectProject(rId);
                      onClose();
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  >
                    Open ?
                  </button>
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 text-xs text-gray-500">
              No saved projects yet. Create your first one above!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
