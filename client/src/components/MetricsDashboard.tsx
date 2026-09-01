import React, { useEffect, useState, useMemo } from "react";
import {
  Activity,
  Zap,
  Clock,
  CheckCircle2,
  Users,
  BarChart3,
  PieChart,
  Search,
  Filter,
  RefreshCw,
  Download,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  Loader2,
} from "lucide-react";
import { API_URL } from "../config";

interface MetricLog {
  id: string;
  language: string;
  durationMs: number;
  status: "success" | "runtime_error" | "compile_error" | "timed_out";
  mode: "docker" | "local_isolated";
  timestamp: string;
}

interface MetricsData {
  totalExecutions: number;
  avgDurationMs: number;
  successRate: number;
  activeRooms: number;
  languageBreakdown: { name: string; value: number }[];
  statusBreakdown: { status: string; count: number }[];
  latencyHistory: { index: string; duration: number; language: string; status: string }[];
  recentLogs: MetricLog[];
}

const LANG_COLORS: Record<string, string> = {
  JAVASCRIPT: "#facc15",
  PYTHON: "#38bdf8",
  CPP: "#f472b6",
  NODE: "#4ade80",
};

export const MetricsDashboard: React.FC = () => {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(3000);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchMetrics = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/api/metrics`);
      const json: MetricsData = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch metrics", err);
    } finally {
      setLoading(false);
      if (isManual) setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchMetrics();
    if (refreshInterval <= 0) return;

    const timer = setInterval(() => {
      fetchMetrics();
    }, refreshInterval);

    return () => clearInterval(timer);
  }, [refreshInterval]);

  const maxDuration = useMemo(() => {
    if (!data?.latencyHistory || data.latencyHistory.length === 0) return 100;
    return Math.max(...data.latencyHistory.map((item) => item.duration), 100);
  }, [data]);

  const filteredLogs = useMemo(() => {
    if (!data?.recentLogs) return [];
    return data.recentLogs.filter((log) => {
      const matchesSearch =
        log.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.language.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.mode.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || log.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [data, searchQuery, statusFilter]);

  const handleExportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codecollab_metrics_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-gray-400 gap-2 bg-[#09090d]">
        <Loader2 size={20} className="animate-spin text-indigo-500" />
        <span className="text-sm font-medium">Loading telemetry metrics...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-5 bg-[#09090d]">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111118] p-4 rounded-2xl border border-gray-800/80 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              System Telemetry & Sandbox Analytics
            </h2>
            <p className="text-xs text-gray-400">
              Real-time monitoring of sandboxed runtimes, execution latency, and CRDT sync.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Polling Interval Switcher */}
          <div className="flex items-center gap-1.5 bg-[#1a1a24] px-2.5 py-1.5 rounded-lg border border-gray-700/80 text-xs">
            <span className="text-gray-400">Refresh:</span>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-indigo-300 font-semibold focus:outline-none cursor-pointer"
            >
              <option value={2000} className="bg-[#1a1a24]">2 sec</option>
              <option value={3000} className="bg-[#1a1a24]">3 sec</option>
              <option value={5000} className="bg-[#1a1a24]">5 sec</option>
              <option value={0} className="bg-[#1a1a24]">Paused</option>
            </select>
          </div>

          <button
            onClick={() => fetchMetrics(true)}
            className="flex items-center gap-1.5 bg-[#1a1a24] hover:bg-[#252533] text-gray-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-700 transition"
            title="Refresh metrics immediately"
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin text-indigo-400" : ""} />
            <span>Sync</span>
          </button>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-500/30 transition shadow-sm"
            title="Download JSON Report"
          >
            <Download size={13} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#12121c] to-[#171724] border border-gray-800 p-4 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Zap size={16} />
          </div>
          <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block">
            Total Executions
          </span>
          <div className="text-3xl font-extrabold text-white mt-1.5 font-mono">
            {data?.totalExecutions ?? 0}
          </div>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Sandboxed runs logged
          </span>
        </div>

        <div className="bg-gradient-to-br from-[#12121c] to-[#171724] border border-gray-800 p-4 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Clock size={16} />
          </div>
          <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block">
            Average Latency
          </span>
          <div className="text-3xl font-extrabold text-emerald-400 mt-1.5 font-mono">
            {data?.avgDurationMs ?? 0}
            <span className="text-sm font-medium text-gray-400 ml-1">ms</span>
          </div>
          <span className="text-[11px] text-gray-400 block mt-1">
            Engine start + execution duration
          </span>
        </div>

        <div className="bg-gradient-to-br from-[#12121c] to-[#171724] border border-gray-800 p-4 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <CheckCircle2 size={16} />
          </div>
          <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block">
            Success Rate
          </span>
          <div className="text-3xl font-extrabold text-blue-400 mt-1.5 font-mono">
            {data?.successRate ?? 100}%
          </div>
          <span className="text-[11px] text-gray-400 block mt-1">
            Zero-crash execution completion
          </span>
        </div>

        <div className="bg-gradient-to-br from-[#12121c] to-[#171724] border border-gray-800 p-4 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Users size={16} />
          </div>
          <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block">
            Active CRDT Rooms
          </span>
          <div className="text-3xl font-extrabold text-purple-400 mt-1.5 font-mono">
            {data?.activeRooms ?? 1}
          </div>
          <span className="text-[11px] text-gray-400 block mt-1">
            Live collaborative workspaces
          </span>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Latency History Timeline Bar Chart */}
        <div className="bg-[#111118] border border-gray-800 p-4 rounded-2xl shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={15} className="text-indigo-400" />
              <h3 className="text-sm font-bold text-gray-100">
                Execution Latency Timeline
              </h3>
            </div>
            <span className="text-[11px] text-indigo-400 font-mono">Recent runs (ms)</span>
          </div>

          <div className="h-52 w-full flex items-end gap-2 pt-6 px-3 bg-[#0a0a0f] rounded-xl border border-gray-800/80">
            {data?.latencyHistory && data.latencyHistory.length > 0 ? (
              data.latencyHistory.map((item, idx) => {
                const heightPercent = Math.max(14, (item.duration / maxDuration) * 100);
                const barColor =
                  item.status === "success"
                    ? "bg-indigo-500 hover:bg-indigo-400 shadow-indigo-500/20"
                    : "bg-rose-500 hover:bg-rose-400 shadow-rose-500/20";

                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center h-full justify-end group relative"
                  >
                    {/* Hover Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition absolute -top-9 bg-gray-900 border border-gray-700 text-[10px] text-white px-2 py-1 rounded-md shadow-xl z-20 whitespace-nowrap pointer-events-none">
                      <span className="font-bold text-indigo-300">{item.language.toUpperCase()}</span>: {item.duration}ms ({item.status})
                    </div>
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 shadow ${barColor}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                    <span className="text-[9px] text-gray-500 mt-1.5 font-mono">{item.index}</span>
                  </div>
                );
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                No latency records yet. Run code to populate the chart.
              </div>
            )}
          </div>
        </div>

        {/* Language Breakdown Distribution */}
        <div className="bg-[#111118] border border-gray-800 p-4 rounded-2xl shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PieChart size={15} className="text-purple-400" />
              <h3 className="text-sm font-bold text-gray-100">
                Language Execution Distribution
              </h3>
            </div>
            <span className="text-[11px] text-gray-400">Total Run Counts</span>
          </div>

          <div className="h-52 flex flex-col justify-center gap-3.5 px-4 bg-[#0a0a0f] rounded-xl border border-gray-800/80">
            {data?.languageBreakdown && data.languageBreakdown.length > 0 ? (
              data.languageBreakdown.map((item) => {
                const total = data.totalExecutions || 1;
                const percentage = Math.round((item.value / total) * 100);
                const color = LANG_COLORS[item.name] || "#6366f1";

                return (
                  <div key={item.name} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="flex items-center gap-2 text-gray-200">
                        <span
                          className="w-2.5 h-2.5 rounded-full shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                        {item.name}
                      </span>
                      <span className="text-gray-400 font-mono text-[11px]">
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
                No language executions recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Searchable Execution Audit Logs Table */}
      <div className="bg-[#111118] border border-gray-800 rounded-2xl overflow-hidden shadow-lg flex flex-col">
        {/* Table Controls */}
        <div className="p-4 bg-[#14141d] border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
              <span>Real-Time Execution Audit Stream</span>
              <span className="text-gray-500 text-[11px]">({filteredLogs.length} entries)</span>
            </h3>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search filter */}
            <div className="flex items-center bg-[#1d1d28] px-2.5 py-1 rounded-lg border border-gray-700/80 text-xs">
              <Search size={12} className="text-gray-400 mr-1.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by ID, language..."
                className="bg-transparent text-gray-200 placeholder-gray-500 focus:outline-none text-xs w-36 sm:w-44"
              />
            </div>

            {/* Status Dropdown Filter */}
            <div className="flex items-center bg-[#1d1d28] px-2.5 py-1 rounded-lg border border-gray-700/80 text-xs">
              <Filter size={12} className="text-gray-400 mr-1.5" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-gray-300 font-medium text-xs focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#1d1d28]">All Statuses</option>
                <option value="success" className="bg-[#1d1d28]">Success</option>
                <option value="runtime_error" className="bg-[#1d1d28]">Runtime Error</option>
                <option value="compile_error" className="bg-[#1d1d28]">Compile Error</option>
                <option value="timed_out" className="bg-[#1d1d28]">Timed Out</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0e0e14] text-gray-400 border-b border-gray-800">
              <tr>
                <th className="px-4 py-2.5">Run ID</th>
                <th className="px-4 py-2.5">Language</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Duration</th>
                <th className="px-4 py-2.5">Isolation Mode</th>
                <th className="px-4 py-2.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#181824] transition">
                    <td className="px-4 py-2.5 text-indigo-400 font-semibold">{log.id}</td>
                    <td className="px-4 py-2.5 uppercase font-bold text-gray-200">
                      {log.language}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === "success"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : log.status === "timed_out"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {log.status === "success" && <CheckCircle2 size={10} />}
                        {log.status === "timed_out" && <Clock size={10} />}
                        {log.status.includes("error") && <AlertTriangle size={10} />}
                        {log.status.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-300">{log.durationMs}ms</td>
                    <td className="px-4 py-2.5 text-gray-400 flex items-center gap-1">
                      {log.mode === "docker" ? (
                        <>
                          <ShieldCheck size={12} className="text-indigo-400" />
                          <span>Docker Sandbox</span>
                        </>
                      ) : (
                        <>
                          <Cpu size={12} className="text-amber-400" />
                          <span>Isolated Local</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    No executions matching current filter criteria.
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
