import React, { useEffect, useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import type { editor } from "monaco-editor";
import { PresenceBar, UserAwareness } from "./PresenceBar";
import { ExecutionPanel, ExecutionResult } from "./ExecutionPanel";

interface CollabEditorProps {
  roomId: string;
  userName: string;
  onUpdateUserName: (name: string) => void;
}

const USER_COLORS = [
  "#f87171", "#fb923c", "#facc15", "#4ade80", 
  "#38bdf8", "#818cf8", "#c084fc", "#f472b6"
];

const CODE_TEMPLATES: Record<string, string> = {
  javascript: `// Real-Time Collaborative JavaScript\nconsole.log("Hello from collaborative editor!");\n\nfunction calculate() {\n  return 20 + 22;\n}\n\nconsole.log("Result:", calculate());\n`,
  python: `# Real-Time Collaborative Python\ndef greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("Collaborator"))\nprint("Calculated:", sum([10, 20, 30]))\n`,
  cpp: `// Real-Time Collaborative C++\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello from C++ sandbox!" << endl;\n    return 0;\n}\n`,
};

export const CollabEditor: React.FC<CollabEditorProps> = ({
  roomId,
  userName,
  onUpdateUserName,
}) => {
  const [editorInstance, setEditorInstance] = useState<editor.IStandaloneCodeEditor | null>(null);
  const [activeUsers, setActiveUsers] = useState<UserAwareness[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [language, setLanguage] = useState<string>("javascript");
  const [copied, setCopied] = useState(false);

  // Synchronized Execution state across the room
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  const providerRef = useRef<WebsocketProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const metaMapRef = useRef<Y.Map<any> | null>(null);

  const [userColor] = useState(() => 
    USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]
  );

  useEffect(() => {
    if (!editorInstance) return;

    const ydoc = new Y.Doc();
    docRef.current = ydoc;

    const wsUrl = "ws://localhost:1234";
    const provider = new WebsocketProvider(wsUrl, roomId, ydoc);
    providerRef.current = provider;

    const handleStatus = (event: { status: "connecting" | "connected" | "disconnected" }) => {
      setStatus(event.status);
    };
    provider.on("status", handleStatus);
    if (provider.wsconnected) setStatus("connected");

    // Room Metadata & Synced Execution Map
    const metaMap = ydoc.getMap("room-meta");
    metaMapRef.current = metaMap;

    const updateFromMetaMap = () => {
      const syncedLang = metaMap.get("language");
      if (syncedLang && typeof syncedLang === "string") {
        setLanguage(syncedLang);
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

    // Awareness Setup
    provider.awareness.setLocalStateField("user", {
      name: userName,
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

    // Bind Monaco editor Model
    const model = editorInstance.getModel();
    let binding: MonacoBinding | null = null;
    if (model) {
      const ytext = ydoc.getText("monaco");

      provider.on("sync", (isSynced: boolean) => {
        if (isSynced) {
          updateFromMetaMap();
          // If the room document is totally empty, populate starter template
          if (ytext.toString().length === 0) {
            const currentLang = (metaMap.get("language") as string) || "javascript";
            metaMap.set("language", currentLang);
            if (CODE_TEMPLATES[currentLang]) {
              ytext.insert(0, CODE_TEMPLATES[currentLang]);
            }
          }
        }
      });

      binding = new MonacoBinding(
        ytext,
        model,
        new Set([editorInstance]),
        provider.awareness
      );
    }

    return () => {
      provider.off("status", handleStatus);
      provider.awareness.off("change", updateAwareness);
      binding?.destroy();
      provider.destroy();
      ydoc.destroy();
    };
  }, [editorInstance, roomId]);

  useEffect(() => {
    if (providerRef.current) {
      providerRef.current.awareness.setLocalStateField("user", {
        name: userName,
        color: userColor,
      });
    }
  }, [userName, userColor]);

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    if (metaMapRef.current) {
      metaMapRef.current.set("language", newLang);
    }
  };

  const handleRunCode = async () => {
    if (!docRef.current || isRunning || !metaMapRef.current) return;

    const code = docRef.current.getText("monaco").toString();
    metaMapRef.current.set("isRunning", true);

    try {
      const response = await fetch("http://localhost:1234/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code }),
      });

      const data: ExecutionResult = await response.json();
      metaMapRef.current.set("executionResult", JSON.stringify(data));
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
  };

  const handleClearConsole = () => {
    if (metaMapRef.current) {
      metaMapRef.current.delete("executionResult");
    }
    setExecutionResult(null);
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <PresenceBar
        users={activeUsers}
        currentUserName={userName}
        onUpdateName={onUpdateUserName}
      />

      <div className="flex-1 flex flex-col bg-[#1e1e24] rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#17171c] border-b border-gray-800 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">
              Language:
            </span>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-[#26262e] text-indigo-300 font-medium text-xs px-3 py-1.5 rounded-md border border-gray-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="python">Python 3</option>
              <option value="cpp">C++ (GCC)</option>
            </select>

            <button
              onClick={handleRunCode}
              disabled={isRunning}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-md text-white transition shadow-md ${
                isRunning
                  ? "bg-gray-600 cursor-not-allowed opacity-75"
                  : "bg-emerald-600 hover:bg-emerald-500 active:scale-95"
              }`}
            >
              <span>{isRunning ? "? Executing..." : "? Run Code"}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={copyRoomLink}
              className="flex items-center gap-1.5 bg-[#26262e] hover:bg-[#32323d] text-gray-200 text-xs font-medium px-3 py-1.5 rounded-md border border-gray-700 transition"
              title="Copy invite link"
            >
              <span>{copied ? "? Copied!" : "?? Share Invite"}</span>
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-gray-700">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  status === "connected"
                    ? "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                    : "bg-amber-500 animate-pulse"
                }`}
              />
              <span className="text-xs text-gray-400 capitalize">{status}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-[300px]">
          <Editor
            height="100%"
            theme="vs-dark"
            language={language}
            onMount={(editor) => setEditorInstance(editor)}
            options={{
              automaticLayout: true,
              fontSize: 14,
              minimap: { enabled: true },
              wordWrap: "on",
              padding: { top: 12 },
              smoothScrolling: true,
              cursorBlinking: "smooth",
            }}
          />
        </div>

        <ExecutionPanel
          result={executionResult}
          isRunning={isRunning}
          onClear={handleClearConsole}
        />
      </div>
    </div>
  );
};
