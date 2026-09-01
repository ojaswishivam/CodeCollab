import React from "react";

export interface UserAwareness {
  id: number;
  name: string;
  color: string;
  isSelf?: boolean;
}

interface PresenceBarProps {
  users: UserAwareness[];
  currentUserName: string;
  onUpdateName: (newName: string) => void;
}

export const PresenceBar: React.FC<PresenceBarProps> = ({
  users,
  currentUserName,
  onUpdateName,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [tempName, setTempName] = React.useState(currentUserName);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      onUpdateName(tempName.trim());
      setIsEditing(false);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-[#1e1e24] px-4 py-2 rounded-lg border border-gray-800">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Collaborators ({users.length}):
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto py-1">
        {users.map((user) => {
          const initials = user.name
            ? user.name.slice(0, 2).toUpperCase()
            : "??";

          return (
            <div
              key={user.id}
              className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border shadow-sm transition-all"
              style={{
                backgroundColor: `${user.color}15`,
                borderColor: `${user.color}60`,
                color: "#f3f4f6",
              }}
              title={user.isSelf ? `${user.name} (You)` : user.name}
            >
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-black"
                style={{ backgroundColor: user.color }}
              >
                {initials[0]}
              </span>
              <span>{user.name}</span>
              {user.isSelf && (
                <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded font-mono">
                  You
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Nickname Button */}
      <div className="ml-auto flex items-center">
        {isEditing ? (
          <form onSubmit={handleSaveName} className="flex items-center gap-1.5">
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              className="bg-[#2a2a32] text-xs text-white px-2 py-1 rounded border border-indigo-500 focus:outline-none"
              autoFocus
              maxLength={20}
            />
            <button
              type="submit"
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => {
              setTempName(currentUserName);
              setIsEditing(true);
            }}
            className="text-xs text-gray-400 hover:text-indigo-400 transition underline underline-offset-2"
          >
            Change Name
          </button>
        )}
      </div>
    </div>
  );
};
