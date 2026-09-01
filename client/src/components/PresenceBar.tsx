import React, { useState } from "react";
import { Users, Edit2, Check, X, Share2 } from "lucide-react";

export interface UserAwareness {
  id: number;
  name: string;
  color: string;
  isSelf?: boolean;
}

interface PresenceBarProps {
  users: UserAwareness[];
  currentUserName: string;
  roomId: string;
  onUpdateName: (newName: string) => void;
}

export const PresenceBar: React.FC<PresenceBarProps> = ({
  users,
  currentUserName,
  roomId,
  onUpdateName,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(currentUserName);
  const [copied, setCopied] = useState(false);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      onUpdateName(tempName.trim());
      setIsEditing(false);
    }
  };

  const handleCopyInvite = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId || "major-project-demo")}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between bg-[#101017]/95 backdrop-blur-md px-4 py-2 rounded-xl border border-gray-800/80 shadow-lg">
      {/* Left: Collaborator Badges */}
      <div className="flex items-center gap-3 overflow-x-auto py-0.5 max-w-[70%]">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 shrink-0">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Users size={13} />
          </div>
          <span className="tracking-wide">
            Live Collaborators ({users.length}):
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          {users.map((user) => {
            const initials = user.name
              ? user.name.slice(0, 2).toUpperCase()
              : "US";

            return (
              <div
                key={user.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
                  user.isSelf
                    ? "ring-1 ring-indigo-400/40 shadow-sm"
                    : "hover:scale-105"
                }`}
                style={{
                  backgroundColor: `${user.color}18`,
                  borderColor: `${user.color}55`,
                  color: "#f3f4f6",
                }}
                title={user.isSelf ? `${user.name} (You)` : `${user.name} (Peer #${user.id})`}
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-black shrink-0"
                  style={{ backgroundColor: user.color }}
                >
                  {initials[0]}
                </span>
                <span className="truncate max-w-[120px]">{user.name}</span>
                {user.isSelf && (
                  <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded-full font-mono font-semibold">
                    You
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Quick Name Edit & Share Link */}
      <div className="flex items-center gap-2 shrink-0 pl-3 border-l border-gray-800">
        {isEditing ? (
          <form onSubmit={handleSaveName} className="flex items-center gap-1.5">
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              className="bg-[#1b1b24] text-xs text-white px-2.5 py-1 rounded-lg border border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-32 font-medium"
              autoFocus
              maxLength={24}
              placeholder="Your Name"
            />
            <button
              type="submit"
              className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition shadow"
              title="Save Name"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="p-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
              title="Cancel"
            >
              <X size={14} />
            </button>
          </form>
        ) : (
          <button
            onClick={() => {
              setTempName(currentUserName);
              setIsEditing(true);
            }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-300 bg-gray-800/60 hover:bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-700/60 transition"
            title="Edit your display nickname"
          >
            <Edit2 size={12} />
            <span>Rename</span>
          </button>
        )}

        <button
          onClick={handleCopyInvite}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg border transition shadow-sm ${
            copied
              ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/40"
              : "bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/30"
          }`}
          title="Copy room link to share with collaborators"
        >
          {copied ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
          <span>{copied ? "Link Copied!" : "Invite Peers"}</span>
        </button>
      </div>
    </div>
  );
};
