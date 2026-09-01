import React, { useEffect, useState } from "react";

interface MetricsData {
  totalExecutions: number;
  avgDurationMs: number;
  successRate: number;
  activeRooms: number;
  languageBreakdown: { name: string; value: number }[];
  statusBreakdown: { status: string; count: number }[];
  latencyHistory: { index: string; duration: number; language: string; status: string }[];
  recentLogs: {
    id: string;
    language: string;
    durationMs: number;
    status: string;
    mode: string;
    timestamp: string;
  }[];
}

const LANG_COLORS: Record<string, string> = {
  JAVASCRIPT: "#f59e0b",
  PYTHON: "#3b82f6",
  CPP: "#10b981",
};

export const MetricsDashboard: React.FC = () => {
  const [data, setData] = useState<MetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      const res = await fetch("http://localhost:1234/api/metrics");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch metrics", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2500);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce"></div>
          <span>Loading Real-Time Analytics Engine...</span>
        </div>
      </div>
    );
  }

  // Calculate max latency for SVG scaling
  const maxDuration = Math.max(
    ...(data?.latencyHistory.map((l) => l.duration) || [100]),
    500
  );

  return (
    <div className="flex-1 flex flex-col gap-5 overflow-y-auto p-2 pr-3 text-white">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#18181f] border border-gray-800 p-4 rounded-xl shadow-lg">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
            Total Executions
          </span>
          <div className="text-3xl font-extrabold text-indigo-400 mt-1">
            {data?.totalExecutions ?? 0}
          </div>
          <span className="text-[11px] text-gray-500">Across all collaborative rooms</span>
        </div>

        <div className="bg-[#18181f] border border-gray-800 p-4 rounded-xl shadow-lg">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
            Average Latency
          </span>
          <div className="text-3xl font-extrabold text-emerald-400 mt-1">
            {data?.avgDurationMs ?? 0}{" "}
            <span className="text-sm font-normal text-gray-400">ms</span>
          </div>
          <span className="text-[11px] text-gray-500">Execution turn-around time</span>
        </div>

        <div className="bg-[#18181f] border border-gray-800 p-4 rounded-xl shadow-lg">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
            Success Rate
          </span>
          <div className="text-3xl font-extrabold text-blue-400 mt-1">
            {data?.successRate ?? 100}%
          </div>
          <span className="text-[11px] text-gray-500">Zero error completion</span>
        </div>

        <div className="bg-[#18181f] border border-gray-800 p-4 rounded-xl shadow-lg">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
            Active CRDT Rooms
          </span>
          <div className="text-3xl font-extrabold text-purple-400 mt-1">
            {data?.activeRooms ?? 1}
          </div>
          <span className="text-[11px] text-gray-500">Live concurrent sessions</span>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Latency History Bar Chart */}
        <div className="bg-[#18181f] border border-gray-800 p-4 rounded-xl shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-200">
              ? Execution Latency Timeline
            </h3>
            <span className="text-[11px] text-indigo-400">Recent runs (ms)</span>
          </div>

          <div className="h-48 w-full flex items-end gap-2 pt-4 px-2 bg-[#121217] rounded-lg border border-gray-800/80">
            {data?.latencyHistory && data.latencyHistory.length > 0 ? (
              data.latencyHistory.map((item, idx) => {
                const heightPercent = Math.max(12, (item.duration / maxDuration) * 100);
                const barColor =
                  item.status === "success"
                    ? "bg-indigo-500 hover:bg-indigo-400"
                    : "bg-rose-500 hover:bg-rose-400";

                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center h-full justify-end group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition absolute -top-8 bg-gray-900 border border-gray-700 text-[10px] px-2 py-0.5 rounded shadow z-10 whitespace-nowrap">
                      {item.language.toUpperCase()}: {item.duration}ms ({item.status})
                    </div>
                    <div
                      className={`w-full rounded-t transition-all duration-300 ${barColor}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                    <span className="text-[9px] text-gray-500 mt-1 font-mono">{item.index}</span>
                  </div>
                );
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                No latency records yet
              </div>
            )}
          </div>
        </div>

        {/* Language Usage Distribution */}
        <div className="bg-[#18181f] border border-gray-800 p-4 rounded-xl shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-200">
              ?? Language Execution Distribution
            </h3>
            <span className="text-[11px] text-gray-400">Total Run Count</span>
          </div>

          <div className="h-48 flex flex-col justify-center gap-3 px-3 bg-[#121217] rounded-lg border border-gray-800/80">
            {data?.languageBreakdown && data.languageBreakdown.length > 0 ? (
              data.languageBreakdown.map((item) => {
                const total = data.totalExecutions || 1;
                const percentage = Math.round((item.value / total) * 100);
                const color = LANG_COLORS[item.name] || "#6366f1";

                return (
                  <div key={item.name} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        {item.name}
                      </span>
                      <span className="text-gray-400 font-mono">
                        {item.value} runs ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-xs text-gray-500">
                No language data recorded
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Stream Table */}
      <div className="bg-[#18181f] border border-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="px-4 py-3 bg-[#1e1e27] border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
            Real-Time Execution Audit Stream
          </h3>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Live (2.5s Polling)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#14141a] text-gray-400 border-b border-gray-800">
              <tr>
                <th className="px-4 py-2.5">Run ID</th>
                <th className="px-4 py-2.5">Language</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Duration</th>
                <th className="px-4 py-2.5">Mode</th>
                <th className="px-4 py-2.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data?.recentLogs && data.recentLogs.length > 0 ? (
                data.recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#20202b] transition">
                    <td className="px-4 py-2 text-indigo-300 font-semibold">{log.id}</td>
                    <td className="px-4 py-2 uppercase font-semibold text-gray-200">
                      {log.language}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === "success"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-300">{log.durationMs}ms</td>
                    <td className="px-4 py-2 text-gray-400">{log.mode}</td>
                    <td className="px-4 py-2 text-gray-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                    No executions recorded yet. Run some code in the editor!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
