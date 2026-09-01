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
} from "lucide-react";
import { PresenceBar, UserAwareness } from "./PresenceBar";
import { ExecutionPanel, ExecutionResult } from "./ExecutionPanel";
import { API_URL, WS_URL } from "../config";

interface CollabEditorProps {
  roomId: string;
  userName: string;
  onUpdateUserName: (name: string) => void;
  onNotify?: (message: string, type?: "info" | "success" | "warning") => void;
}

const USER_COLORS = [
  "#f87171", "#fb923c", "#facc15", "#4ade80", 
  "#38bdf8", "#818cf8", "#c084fc", "#f472b6"
];

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 22];

interface LanguageOption {
  id: string;
  name: string;
  runtime: string;
  badgeColor: string;
}

const LANGUAGES: LanguageOption[] = [
  { id: "javascript", name: "JavaScript", runtime: "Node.js (v20+)", badgeColor: "bg-amber-400" },
  { id: "python", name: "Python", runtime: "Python 3 (v3.11+)", badgeColor: "bg-sky-400" },
  { id: "cpp", name: "C++", runtime: "GCC (C++17)", badgeColor: "bg-pink-400" },
];

const CODE_TEMPLATES: Record<string, string> = {
  javascript: `// Real-Time Collaborative JavaScript (Node.js)
console.log("Welcome to CodeCollab Studio!");

function fibonacci(n) {
  const sequence = [0, 1];
  for (let i = 2; i < n; i++) {
    sequence.push(sequence[i - 1] + sequence[i - 2]);
  }
  return sequence;
}

const terms = 10;
console.log(\`First \${terms} Fibonacci numbers:\`, fibonacci(terms));
`,
  python: `# Real-Time Collaborative Python 3
import sys

def greet(name: str) -> str:
    return f"Hello, {name}! Ready for collaborative development."

print(greet("Collaborator"))

# Example calculations
numbers = [12, 45, 78, 23, 56, 89]
print("Dataset:", numbers)
print("Sum:", sum(numbers))
print("Max:", max(numbers))
print("Average:", round(sum(numbers) / len(numbers), 2))
`,
  cpp: `// Real-Time Collaborative C++ (GCC)
#include <iostream>
#include <vector>
#include <numeric>

using namespace std;

int main() {
    cout << "=== CodeCollab C++ Sandbox ===" << endl;
    
    vector<int> data = {10, 20, 30, 40, 50};
    int total = accumulate(data.begin(), data.end(), 0);
    
    cout << "Element count: " << data.size() << endl;
    cout << "Sum of elements: " << total << endl;
    
    return 0;
}
`,
};

export const CollabEditor: React.FC<CollabEditorProps> = ({
  roomId,
  userName,
  onUpdateUserName,
  onNotify,
}) => {
  const [editorInstance, setEditorInstance] = useState<editor.IStandaloneCodeEditor | null>(null);
  const [activeUsers, setActiveUsers] = useState<UserAwareness[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [language, setLanguage] = useState<string>("javascript");
  const [isLangMenuOpen, setIsLangMenuOpen] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<number>(14);
  const [isFontMenuOpen, setIsFontMenuOpen] = useState<boolean>(false);

  // Synchronized Execution & Input State
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [stdin, setStdin] = useState<string>("");

  // Editor Cursor & Metrics State
  const [cursorPos, setCursorPos] = useState({ lineNumber: 1, column: 1 });
  const [charCount, setCharCount] = useState<number>(0);
  const [lineCount, setLineCount] = useState<number>(1);
  const [latencyMs, setLatencyMs] = useState<number>(18);

  const providerRef = useRef<WebsocketProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const metaMapRef = useRef<Y.Map<any> | null>(null);
  const langMenuRef = useRef<HTMLDivElement | null>(null);
  const fontMenuRef = useRef<HTMLDivElement | null>(null);

  const [userColor] = useState(() => 
    USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]
  );

  const currentLangObj = useMemo(() => {
    return LANGUAGES.find((l) => l.id === language) || LANGUAGES[0];
  }, [language]);

  // Close menus on outside click
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

  // Initialize Yjs and WebSocket synchronization
  useEffect(() => {
    if (!editorInstance) return;

    const ydoc = new Y.Doc();
    docRef.current = ydoc;

    const provider = new WebsocketProvider(WS_URL, roomId, ydoc);
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

    // Room Metadata Map
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
    let binding: any = null;
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
          setCharCount(model.getValueLength());
          setLineCount(model.getLineCount());
        }
      });

      binding = new MonacoBinding(
        ytext,
        model,
        new Set([editorInstance]),
        provider.awareness
      );

      // Track cursor position and metrics
      const cursorDisposable = editorInstance.onDidChangeCursorPosition((e) => {
        setCursorPos({ lineNumber: e.position.lineNumber, column: e.position.column });
      });

      const contentDisposable = model.onDidChangeContent(() => {
        setCharCount(model.getValueLength());
        setLineCount(model.getLineCount());
      });

      return () => {
        cursorDisposable.dispose();
        contentDisposable.dispose();
        provider.off("status", handleStatus);
        provider.awareness.off("change", updateAwareness);
        if (binding && typeof binding.destroy === "function") {
          binding.destroy();
        }
        provider.destroy();
        ydoc.destroy();
      };
    }

    return () => {
      provider.off("status", handleStatus);
      provider.awareness.off("change", updateAwareness);
      if (binding && typeof binding.destroy === "function") {
        binding.destroy();
      }
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
    setIsLangMenuOpen(false);
    if (metaMapRef.current) {
      metaMapRef.current.set("language", newLang);
    }
    if (onNotify) {
      const selected = LANGUAGES.find((l) => l.id === newLang)?.name || newLang;
      onNotify(`Switched language to ${selected}`, "info");
    }
  };

  const handleFontSizeChange = (newSize: number) => {
    setFontSize(newSize);
    setIsFontMenuOpen(false);
    if (editorInstance) {
      editorInstance.updateOptions({ fontSize: newSize });
    }
  };

  const handleRunCode = useCallback(async () => {
    if (!docRef.current || isRunning || !metaMapRef.current) return;

    const code = docRef.current.getText("monaco").toString();
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
      if (onNotify) onNotify(`Execution finished (${data.durationMs}ms)`, data.status === "success" ? "success" : "warning");
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
      if (onNotify) onNotify("Execution server connection error", "warning");
    } finally {
      metaMapRef.current.set("isRunning", false);
    }
  }, [isRunning, language, stdin, onNotify]);

  // Keyboard shortcut listener: Ctrl+Enter (Run) & Ctrl+S (Sync)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRunCode();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (onNotify) onNotify("Code is synchronized in real-time via CRDT!", "info");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRunCode, onNotify]);

  const handleDownloadCode = () => {
    if (!docRef.current) return;
    const code = docRef.current.getText("monaco").toString();
    const extMap: Record<string, string> = {
      javascript: "js",
      python: "py",
      cpp: "cpp",
    };
    const ext = extMap[language] || "txt";
    const filename = `codecollab_${roomId}_main.${ext}`;
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    if (onNotify) onNotify(`Downloaded ${filename}`, "success");
  };

  const handleClearConsole = () => {
    if (metaMapRef.current) {
      metaMapRef.current.delete("executionResult");
    }
    setExecutionResult(null);
  };

  return (
    <div className="flex flex-col h-full gap-2.5 select-none">
      {/* Collaborator Presence Header (contains the Invite Peers button) */}
      <PresenceBar
        users={activeUsers}
        currentUserName={userName}
        roomId={roomId}
        onUpdateName={onUpdateUserName}
      />

      {/* Main Studio Frame */}
      <div className="flex-1 flex flex-col bg-[#101017] rounded-2xl overflow-hidden border border-gray-800/90 shadow-2xl">
        {/* Editor Controls Topbar */}
        <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#15151e] border-b border-gray-800 text-sm gap-2">
          {/* Left: Instant Zero-Lag Language Dropdown & Execution */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Custom Fast Language Dropdown */}
            <div ref={langMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsLangMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 bg-[#1e1e28] hover:bg-[#252533] px-3 py-1.5 rounded-lg border border-gray-700/80 text-xs font-semibold text-gray-200 transition active:scale-95 shadow-sm"
                title="Select language runtime"
              >
                <Code2 size={13} className="text-indigo-400" />
                <span>{currentLangObj.name}</span>
                <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                  ({currentLangObj.runtime.split(" ")[0]})
                </span>
                <ChevronDown
                  size={11}
                  className={`text-gray-400 transition-transform ${isLangMenuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Instant Zero-Lag Popover */}
              {isLangMenuOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-48 bg-[#181824] border border-gray-700 rounded-xl shadow-2xl py-1 z-30 animate-slide-down flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-1 block border-b border-gray-800">
                    Execution Runtimes
                  </span>
                  {LANGUAGES.map((langItem) => (
                    <button
                      key={langItem.id}
                      type="button"
                      onClick={() => handleLanguageChange(langItem.id)}
                      className={`flex items-center justify-between px-3 py-2 text-xs text-left transition ${
                        language === langItem.id
                          ? "bg-indigo-600/20 text-indigo-300 font-bold"
                          : "text-gray-200 hover:bg-[#222232] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${langItem.badgeColor}`} />
                        <div>
                          <div className="font-semibold">{langItem.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{langItem.runtime}</div>
                        </div>
                      </div>
                      {language === langItem.id && <Check size={13} className="text-indigo-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleRunCode}
              disabled={isRunning}
              className={`flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-lg text-white transition-all shadow-md active:scale-95 ${
                isRunning
                  ? "bg-gray-700 cursor-not-allowed opacity-80"
                  : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40"
              }`}
              title="Run Code (Ctrl + Enter)"
            >
              {isRunning ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Play size={13} className="fill-white" />
                  <span>Run (Ctrl+Enter)</span>
                </>
              )}
            </button>
          </div>

          {/* Right: Instant Font Size Stepper & Popover, Download */}
          <div className="flex items-center gap-2">
            {/* Zero-Lag Fast Font Size Control */}
            <div ref={fontMenuRef} className="relative flex items-center bg-[#1e1e28] rounded-lg border border-gray-700/80 p-0.5 text-xs text-gray-300">
              <button
                type="button"
                onClick={() => handleFontSizeChange(Math.max(11, fontSize - 1))}
                disabled={fontSize <= 11}
                className="p-1 hover:text-white hover:bg-gray-700/60 rounded disabled:opacity-40 disabled:hover:bg-transparent transition"
                title="Decrease Font Size"
              >
                <Minus size={11} />
              </button>

              <button
                type="button"
                onClick={() => setIsFontMenuOpen((prev) => !prev)}
                className="flex items-center gap-1 px-1.5 py-0.5 font-mono text-xs font-bold text-gray-200 hover:text-indigo-300 hover:bg-gray-700/40 rounded transition"
                title="Choose font size preset"
              >
                <Type size={11} className="text-gray-400" />
                <span>{fontSize}px</span>
                <ChevronDown size={10} className={`text-gray-400 transition-transform ${isFontMenuOpen ? "rotate-180" : ""}`} />
              </button>

              <button
                type="button"
                onClick={() => handleFontSizeChange(Math.min(24, fontSize + 1))}
                disabled={fontSize >= 24}
                className="p-1 hover:text-white hover:bg-gray-700/60 rounded disabled:opacity-40 disabled:hover:bg-transparent transition"
                title="Increase Font Size"
              >
                <Plus size={11} />
              </button>

              {/* Instant Zero-Lag Dropdown Popover */}
              {isFontMenuOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-28 bg-[#181824] border border-gray-700 rounded-xl shadow-2xl py-1 z-30 animate-slide-down flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2.5 py-1 block border-b border-gray-800">
                    Font Size
                  </span>
                  {FONT_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handleFontSizeChange(size)}
                      className={`flex items-center justify-between px-3 py-1.5 text-xs text-left font-mono transition ${
                        fontSize === size
                          ? "bg-indigo-600/20 text-indigo-300 font-bold"
                          : "text-gray-300 hover:bg-[#222232] hover:text-white"
                      }`}
                    >
                      <span>{size}px</span>
                      {fontSize === size && <Check size={12} className="text-indigo-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Download Code Button */}
            <button
              onClick={handleDownloadCode}
              className="p-1.5 bg-[#1e1e28] hover:bg-[#282836] text-gray-300 hover:text-white rounded-lg border border-gray-700/80 transition"
              title="Download source code"
            >
              <Download size={13} />
            </button>
          </div>
        </div>

        {/* Monaco Editor Container */}
        <div className="flex-1 min-h-[280px] relative">
          <Editor
            height="100%"
            theme="vs-dark"
            language={language}
            onMount={(editor) => setEditorInstance(editor)}
            options={{
              automaticLayout: true,
              fontSize: fontSize,
              fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
              minimap: { enabled: true, maxColumn: 80 },
              wordWrap: "on",
              padding: { top: 12, bottom: 12 },
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              renderLineHighlight: "all",
              lineNumbersMinChars: 3,
            }}
          />
        </div>

        {/* Editor Status Bar */}
        <div className="flex items-center justify-between px-3.5 py-1 bg-[#121218] border-t border-gray-800 text-[11px] text-gray-400 font-mono select-none">
          <div className="flex items-center gap-3">
            <span>
              Ln {cursorPos.lineNumber}, Col {cursorPos.column}
            </span>
            <span className="hidden sm:inline text-gray-600">|</span>
            <span className="hidden sm:inline">
              {lineCount} lines, {charCount} chars
            </span>
            <span className="hidden sm:inline text-gray-600">|</span>
            <span className="hidden sm:inline uppercase text-gray-300 font-semibold">
              {language}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline">UTF-8</span>
            <span className="hidden md:inline text-gray-600">|</span>
            <div className="flex items-center gap-1.5">
              {status === "connected" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]"></span>
                  <span className="text-emerald-300 font-medium capitalize">
                    Synced ({latencyMs}ms)
                  </span>
                </>
              ) : status === "connecting" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  <span className="text-amber-300 capitalize">Connecting...</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span className="text-rose-400 capitalize">Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Terminal Execution Panel */}
        <ExecutionPanel
          result={executionResult}
          isRunning={isRunning}
          stdin={stdin}
          onChangeStdin={setStdin}
          onClear={handleClearConsole}
        />
      </div>
    </div>
  );
};
