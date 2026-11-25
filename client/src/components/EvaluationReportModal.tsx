import React from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  Terminal,
  Lock,
  FileCode2,
} from "lucide-react";
import { SubmissionReport } from "../types/codeclass";

interface EvaluationReportModalProps {
  report: SubmissionReport | null;
  onClose: () => void;
}

export const EvaluationReportModal: React.FC<EvaluationReportModalProps> = ({
  report,
  onClose,
}) => {
  if (!report) return null;

  const isCompiled = report.compilationStatus === "Successful";
  const allPassed = report.passedCount === report.totalCount && report.totalCount > 0;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-slide-down">
      <div className="bg-[#12121a] border border-gray-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative flex flex-col max-h-[88vh]">
        <button
          onClick={onClose}
          aria-label="Close Report"
          title="Close Report"
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${
              allPassed
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                : isCompiled
                ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                : "bg-rose-500/15 border-rose-500/40 text-rose-400"
            }`}
          >
            <Award size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-white">
                Automated Evaluation Report
              </h2>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                {report.statusLabel || "Submission evaluated"}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Student: <span className="text-gray-200 font-semibold">{report.studentName}</span> •
              Session: <span className="font-mono text-indigo-300">{report.sessionCode}</span> •
              Runtime: <span className="uppercase font-mono text-gray-300">{report.language}</span>
            </p>
          </div>
        </div>

        {/* Summary Metrics Grid (Matches Module 5 Specification) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-[#181824] border border-gray-800 rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
              Compilation
            </div>
            <div
              className={`text-sm font-extrabold mt-1 flex items-center gap-1.5 ${
                isCompiled ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {isCompiled ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              <span>{report.compilationStatus}</span>
            </div>
          </div>

          <div className="bg-[#181824] border border-gray-800 rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
              Test Cases
            </div>
            <div className="text-lg font-extrabold text-white mt-0.5 font-mono">
              {report.passedCount}/{report.totalCount}
            </div>
          </div>

          <div className="bg-[#181824] border border-gray-800 rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
              Execution Time
            </div>
            <div className="text-lg font-extrabold text-sky-400 mt-0.5 font-mono flex items-center gap-1">
              <Clock size={14} />
              <span>{report.executionTimeSec.toFixed(2)} sec</span>
            </div>
          </div>

          <div className="bg-[#181824] border border-gray-800 rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
              Score
            </div>
            <div
              className={`text-lg font-extrabold mt-0.5 font-mono ${
                report.score >= 80
                  ? "text-emerald-400"
                  : report.score >= 40
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            >
              {report.score}/{report.maxScore}
            </div>
          </div>
        </div>

        {/* Compilation Error Details */}
        {!isCompiled && report.compileError && (
          <div className="mb-4 bg-rose-950/30 border border-rose-500/30 rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300 mb-1.5">
              <Terminal size={13} />
              <span>Compiler / Syntax Diagnostics</span>
            </div>
            <pre className="text-xs font-mono text-rose-200 whitespace-pre-wrap max-h-36 overflow-auto">
              {report.compileError}
            </pre>
          </div>
        )}

        {/* Per-Test Case Results */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
            <FileCode2 size={13} />
            <span>Test Case Breakdown</span>
          </div>

          {report.testResults.map((tc) => (
            <div
              key={tc.testCaseId}
              className={`p-3 rounded-xl border text-xs ${
                tc.passed
                  ? "bg-emerald-950/15 border-emerald-500/25"
                  : "bg-rose-950/15 border-rose-500/25"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold">
                  {tc.passed ? (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  ) : (
                    <XCircle size={14} className="text-rose-400" />
                  )}
                  <span className="text-gray-200">Test Case #{tc.index}</span>
                  {tc.isHidden && (
                    <span className="flex items-center gap-1 text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                      <Lock size={10} /> Hidden
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="text-gray-400">{tc.durationMs}ms</span>
                  <span className={tc.passed ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                    {tc.passed ? "PASSED" : "FAILED"}
                  </span>
                </div>
              </div>

              {!tc.isHidden && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className="bg-[#0d0d13] p-2 rounded-lg border border-gray-800">
                    <div className="text-[9px] text-gray-500 uppercase mb-0.5">Input</div>
                    <pre className="text-gray-300 whitespace-pre-wrap">{tc.input?.trim() || "(empty)"}</pre>
                  </div>
                  <div className="bg-[#0d0d13] p-2 rounded-lg border border-gray-800">
                    <div className="text-[9px] text-gray-500 uppercase mb-0.5">Expected</div>
                    <pre className="text-emerald-300 whitespace-pre-wrap">{tc.expectedOutput || "(empty)"}</pre>
                  </div>
                  <div className="bg-[#0d0d13] p-2 rounded-lg border border-gray-800">
                    <div className="text-[9px] text-gray-500 uppercase mb-0.5">Actual</div>
                    <pre className={`${tc.passed ? "text-emerald-300" : "text-rose-300"} whitespace-pre-wrap`}>
                      {tc.actualOutput ?? tc.error ?? "(empty)"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
