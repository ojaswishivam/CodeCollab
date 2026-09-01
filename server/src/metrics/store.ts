export interface MetricEntry {
  id: string;
  language: string;
  durationMs: number;
  status: "success" | "runtime_error" | "compile_error" | "timed_out";
  mode: "docker" | "local_isolated";
  timestamp: string;
}

// In-memory metrics log (with Postgres schema readiness)
const executionLogs: MetricEntry[] = [
  {
    id: "init_1",
    language: "javascript",
    durationMs: 124,
    status: "success",
    mode: "local_isolated",
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: "init_2",
    language: "python",
    durationMs: 245,
    status: "success",
    mode: "local_isolated",
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    id: "init_3",
    language: "cpp",
    durationMs: 512,
    status: "success",
    mode: "local_isolated",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
];

export function logExecutionMetric(entry: Omit<MetricEntry, "id" | "timestamp">) {
  const newLog: MetricEntry = {
    ...entry,
    id: "exec_" + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
  };

  executionLogs.unshift(newLog);
  // Keep last 100 entries in memory
  if (executionLogs.length > 100) {
    executionLogs.pop();
  }
}

export function getMetricsSummary(activeRoomsCount: number) {
  const total = executionLogs.length;
  if (total === 0) {
    return {
      totalExecutions: 0,
      avgDurationMs: 0,
      successRate: 100,
      activeRooms: activeRoomsCount,
      languageBreakdown: [],
      statusBreakdown: [],
      latencyHistory: [],
      recentLogs: [],
    };
  }

  const successCount = executionLogs.filter((l) => l.status === "success").length;
  const avgDuration = Math.round(
    executionLogs.reduce((acc, curr) => acc + curr.durationMs, 0) / total
  );

  // Language counts
  const langCounts: Record<string, number> = {};
  executionLogs.forEach((l) => {
    langCounts[l.language] = (langCounts[l.language] || 0) + 1;
  });

  const languageBreakdown = Object.entries(langCounts).map(([name, count]) => ({
    name: name.toUpperCase(),
    value: count,
  }));

  // Status counts
  const statusCounts: Record<string, number> = {};
  executionLogs.forEach((l) => {
    statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
  });

  const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
  }));

  // Latency History (chronological order)
  const latencyHistory = [...executionLogs]
    .reverse()
    .slice(-15)
    .map((l, idx) => ({
      index: `#${idx + 1}`,
      duration: l.durationMs,
      language: l.language,
      status: l.status,
    }));

  return {
    totalExecutions: total,
    avgDurationMs: avgDuration,
    successRate: Math.round((successCount / total) * 100),
    activeRooms: activeRoomsCount,
    languageBreakdown,
    statusBreakdown,
    latencyHistory,
    recentLogs: executionLogs.slice(0, 10),
  };
}
