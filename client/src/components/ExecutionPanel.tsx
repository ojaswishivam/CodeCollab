import React, { useState, useMemo } from "react";
import {
  Terminal,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Loader2,
  Copy,
  Check,
  Download,
  Trash2,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Cpu,
  Lightbulb,
} from "lucide-react";

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  status: "success" | "runtime_error" | "compile_error" | "timed_out";
  mode: "docker" | "local_isolated";
}

interface ExecutionPanelProps {
  result: ExecutionResult | null;
  isRunning: boolean;
  stdin: string;
  onChangeStdin: (val: string) => void;
  onClear: () => void;
}

export const ExecutionPanel: React.FC<ExecutionPanelProps> = ({
  result,
  isRunning,
  stdin,
  onChangeStdin,
  onClear,
}) => {
  const [activeTab, setActiveTab] = useState<"output" | "stdin">("output");
  const [copied, setCopied] = useState(false);
  const [heightMode, setHeightMode] = useState<"compact" | "normal" | "tall">("normal");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleCopyOutput = () => {
    if (!result) return;
    const textToCopy = `${result.stdout}\n${result.stderr}`.trim();
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadOutput = () => {
    if (!result) return;
    const content = `=== CODECOLLAB EXECUTION LOG ===\nStatus: ${result.status.toUpperCase()}\nDuration: ${result.durationMs}ms\nMode: ${result.mode}\nExit Code: ${result.exitCode ?? 0}\nTimestamp: ${new Date().toISOString()}\n\n--- STDOUT ---\n${result.stdout}\n\n--- STDERR ---\n${result.stderr}\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `execution_log_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Parse stderr and any intelligent hint
  const { cleanErrorText, hintText } = useMemo(() => {
    if (!result?.stderr) return { cleanErrorText: "", hintText: null };

    // Strip any raw temporary directory references on the client as a defense-in-depth guarantee
    let raw = result.stderr
      .replace(/[a-zA-Z]:\\[^\n\r"]+\\(main\.\w+)/g, "$1")
      .replace(/\/tmp\/collab_exec\/[^/]+\/(main\.\w+)/g, "$1");

    const hintSplit = raw.split("💡 Hint:");
    if (hintSplit.length > 1) {
      return {
        cleanErrorText: hintSplit[0].trim(),
        hintText: hintSplit.slice(1).join("💡 Hint:").trim(),
      };
    }

    return { cleanErrorText: raw.trim(), hintText: null };
  }, [result?.stderr]);

  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <span className="flex items-center gap-1.5 text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full font-medium animate-pulse">
          <Loader2 size={12} className="animate-spin" />
          Running Sandbox...
        </span>
      );
    }
    if (!result) return null;

    switch (result.status) {
      case "success":
        return (
          <span className="flex items-center gap-1 text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-medium">
            <CheckCircle2 size={12} className="text-emerald-400" />
            Success ({result.durationMs}ms)
          </span>
        );
      case "timed_out":
        return (
          <span className="flex items-center gap-1 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-medium">
            <Clock size={12} className="text-amber-400" />
            Timed Out (5s limit)
          </span>
        );
      case "compile_error":
        return (
          <span className="flex items-center gap-1 text-xs bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full font-medium">
            <AlertOctagon size={12} className="text-rose-400" />
            Compile Error
          </span>
        );
      case "runtime_error":
        return (
          <span className="flex items-center gap-1 text-xs bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full font-medium">
            <AlertTriangle size={12} className="text-rose-400" />
            Runtime Error
          </span>
        );
    }
  };

  const getHeightClass = () => {
    if (isCollapsed) return "h-10";
    if (heightMode === "compact") return "h-40";
    if (heightMode === "normal") return "h-64";
    return "h-96";
  };

  const containerClasses = isFullscreen
    ? "fixed inset-4 z-50 bg-[#0e0e14] border border-gray-700 rounded-2xl shadow-2xl flex flex-col font-mono text-xs overflow-hidden"
    : `${getHeightClass()} bg-[#0e0e14] border-t border-gray-800 flex flex-col font-mono text-xs transition-all duration-200`;

  return (
    <div className={containerClasses}>
      {/* Panel Top Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#14141c] border-b border-gray-800 select-none">
        {/* Left: Tab Selectors & Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#1e1e28] p-0.5 rounded-lg border border-gray-700/80">
            <button
              onClick={() => {
                setActiveTab("output");
                if (isCollapsed) setIsCollapsed(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition ${
                activeTab === "output"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Terminal size={12} />
              <span>Terminal Output</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("stdin");
                if (isCollapsed) setIsCollapsed(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition ${
                activeTab === "stdin"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Sliders size={12} />
              <span>Custom Input (stdin)</span>
              {stdin && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              )}
            </button>
          </div>

          {getStatusBadge()}

          {result && (
            <span className="hidden md:flex items-center gap-1 text-[11px] text-gray-500 bg-gray-900/60 px-2 py-0.5 rounded border border-gray-800">
              {result.mode === "docker" ? (
                <>
                  <ShieldCheck size={11} className="text-emerald-400" />
                  <span>Docker Sandbox</span>
                </>
              ) : (
                <>
                  <Cpu size={11} className="text-amber-400" />
                  <span>Isolated Process</span>
                </>
              )}
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {activeTab === "output" && result && (
            <>
              <button
                onClick={handleCopyOutput}
                className="flex items-center gap-1 text-gray-400 hover:text-gray-100 hover:bg-gray-800/80 px-2 py-1 rounded-md transition text-xs"
                title="Copy Terminal Output"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
              </button>

              <button
                onClick={handleDownloadOutput}
                className="flex items-center gap-1 text-gray-400 hover:text-gray-100 hover:bg-gray-800/80 px-2 py-1 rounded-md transition text-xs"
                title="Download Execution Log"
              >
                <Download size={12} />
                <span className="hidden sm:inline">Export</span>
              </button>

              <button
                onClick={onClear}
                className="flex items-center gap-1 text-gray-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 py-1 rounded-md transition text-xs"
                title="Clear Output"
              >
                <Trash2 size={12} />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </>
          )}

          {/* Size Cycle / Collapse / Fullscreen */}
          <div className="flex items-center gap-0.5 pl-1.5 border-l border-gray-800 text-gray-400">
            {!isFullscreen && (
              <button
                onClick={() => {
                  if (isCollapsed) {
                    setIsCollapsed(false);
                  } else {
                    setHeightMode((prev) =>
                      prev === "compact" ? "normal" : prev === "normal" ? "tall" : "compact"
                    );
                  }
                }}
                className="p-1 hover:text-gray-100 hover:bg-gray-800/80 rounded transition text-[10px] font-bold uppercase px-1.5"
                title="Cycle height (compact / normal / tall)"
              >
                {heightMode === "compact" ? "S" : heightMode === "normal" ? "M" : "L"}
              </button>
            )}

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1 hover:text-gray-100 hover:bg-gray-800/80 rounded transition"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Output"}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            {!isFullscreen && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 hover:text-gray-100 hover:bg-gray-800/80 rounded transition"
                title={isCollapsed ? "Expand Panel" : "Collapse Panel"}
              >
                {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Panel Body */}
      {!isCollapsed && (
        <div className="flex-1 p-3 pb-10 overflow-auto space-y-1 select-text bg-[#0a0a0f]">
          {activeTab === "output" ? (
            <>
              {isRunning && (
                <div className="flex items-center gap-2 text-indigo-400 italic py-2">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Executing code inside isolated sandbox container...</span>
                </div>
              )}

              {!isRunning && !result && (
                <div className="text-gray-500 py-3 flex flex-col gap-1">
                  <p>Ready. Press <kbd className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded text-[11px] font-mono border border-gray-700">Ctrl + Enter</kbd> or click <strong className="text-emerald-400">&quot;Run Code&quot;</strong> to execute in the cloud sandbox.</p>
                  <p className="text-[11px] text-gray-600">Standard output and error streams will stream below in real time.</p>
                </div>
              )}

              {result && (
                <div className="space-y-2">
                  {result.stdout && (
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">
                        [STDOUT]
                      </span>
                      <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed m-0 font-mono text-[12px] bg-[#0f1412] p-2.5 rounded-lg border border-emerald-900/30 shadow-inner">
                        {result.stdout}
                      </pre>
                    </div>
                  )}

                  {cleanErrorText && (
                    <div>
                      <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block mb-0.5">
                        [STDERR]
                      </span>
                      <pre className="text-rose-300 whitespace-pre-wrap leading-relaxed m-0 font-mono text-[12px] bg-[#1a0f12] p-2.5 rounded-lg border border-rose-900/40 shadow-inner">
                        {cleanErrorText}
                      </pre>
                    </div>
                  )}

                  {hintText && (
                    <div className="flex items-start gap-2.5 bg-indigo-950/40 border border-indigo-500/40 rounded-lg p-3 text-xs text-indigo-200 shadow-lg animate-slide-down">
                      <Lightbulb size={16} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                      <div className="space-y-1">
                        <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                          <span>Runtime Mismatch Detected</span>
                        </div>
                        <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {hintText}
                        </p>
                      </div>
                    </div>
                  )}

                  {!result.stdout && !result.stderr && (
                    <div className="text-gray-500 italic py-2">
                      (Process completed with no console output &mdash; Exit Code: {result.exitCode ?? 0})
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Custom Stdin Tab */
            <div className="flex flex-col h-full gap-2">
              <div className="flex items-center justify-between text-gray-400 text-xs">
                <span>Standard Input (stdin) passed to interactive programs (<code className="text-indigo-300">input()</code>, <code className="text-indigo-300">cin</code>, etc.):</span>
                {stdin && (
                  <button
                    onClick={() => onChangeStdin("")}
                    className="text-[11px] text-rose-400 hover:underline"
                  >
                    Clear Input
                  </button>
                )}
              </div>
              <textarea
                value={stdin}
                onChange={(e) => onChangeStdin(e.target.value)}
                placeholder="Enter input lines to feed into stdin when running code (e.g. 42 or user strings on separate lines)..."
                className="w-full flex-1 bg-[#12121a] border border-gray-700/80 rounded-lg p-2.5 text-gray-200 font-mono text-xs focus:outline-none focus:border-indigo-500 resize-none min-h-[100px]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
