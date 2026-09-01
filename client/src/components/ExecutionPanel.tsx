import React from "react";

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
  onClear: () => void;
}

export const ExecutionPanel: React.FC<ExecutionPanelProps> = ({
  result,
  isRunning,
  onClear,
}) => {
  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <span className="flex items-center gap-1.5 text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full font-medium animate-pulse">
          <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
          Running...
        </span>
      );
    }
    if (!result) return null;

    switch (result.status) {
      case "success":
        return (
          <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-medium">
            ? Success ({result.durationMs}ms)
          </span>
        );
      case "timed_out":
        return (
          <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-medium">
            ? Timed Out (5s limit)
          </span>
        );
      case "compile_error":
        return (
          <span className="text-xs bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full font-medium">
            ?? Compile Error
          </span>
        );
      case "runtime_error":
        return (
          <span className="text-xs bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full font-medium">
            ? Runtime Error
          </span>
        );
    }
  };

  return (
    <div className="h-64 bg-[#141418] border-t border-gray-800 flex flex-col font-mono text-xs">
      {/* Console Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1b1b22] border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-300 tracking-wider text-[11px] uppercase">
            Terminal Output
          </span>
          {getStatusBadge()}
          {result && (
            <span className="text-[10px] text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded">
              Mode: {result.mode}
            </span>
          )}
        </div>

        <button
          onClick={onClear}
          className="text-gray-400 hover:text-gray-200 text-xs px-2 py-0.5 rounded hover:bg-gray-800 transition"
        >
          Clear
        </button>
      </div>

      {/* Output Stream Content */}
      <div className="flex-1 p-3 overflow-auto space-y-1 select-text">
        {isRunning && (
          <div className="text-gray-400 italic">Executing code in sandbox...</div>
        )}

        {!isRunning && !result && (
          <div className="text-gray-400">
            Click &quot;? Run Code&quot; to execute your collaborative script and view output here.
          </div>
        )}

        {result && (
          <>
            {result.stdout && (
              <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed m-0">
                {result.stdout}
              </pre>
            )}

            {result.stderr && (
              <pre className="text-rose-400 whitespace-pre-wrap leading-relaxed m-0">
                {result.stderr}
              </pre>
            )}

            {!result.stdout && !result.stderr && (
              <div className="text-gray-400 italic">
                (Process finished with no output — Exit code: {result.exitCode ?? 0})
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
