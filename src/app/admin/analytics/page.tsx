'use client';

import React, { useEffect, useState, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import AdminNavRail from '@/components/admin/AdminNavRail';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Users,
  ShieldCheck,
  Calendar,
  Layers,
  RefreshCw,
  Download,
  AlertTriangle,
  Award,
  Sparkles,
  ArrowUpRight,
  Filter,
} from 'lucide-react';

interface DailyTrendItem {
  date: string;
  present: number;
  wfh: number;
  halfDay: number;
  onLeave: number;
  absent: number;
  presenceRate: number;
  tasksCreated: number;
  tasksCompleted: number;
}

interface SquadAnalyticsItem {
  id: string;
  name: string;
  departmentName: string;
  leaderName: string;
  membersCount: number;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  blockedTasks: number;
}

interface AnalyticsData {
  timeframeDays: number;
  summary: {
    totalWorkforce: number;
    overallProductivityScore: number;
    avgPresenceRate: number;
    taskCompletionRate: number;
    totalTasks: number;
    completedTasks: number;
    overdueTasksCount: number;
    totalPunchesInPeriod: number;
  };
  dailyTrends: DailyTrendItem[];
  taskStatusCounts: {
    done: number;
    in_progress: number;
    in_review: number;
    blocked: number;
    todo: number;
  };
  taskPriorityCounts: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  squadAnalytics: SquadAnalyticsItem[];
}

export default function AdminAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<number>(30);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async (days = timeframe) => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/admin/analytics?days=${days}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('[ANALYTICS FETCH ERROR]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(timeframe);
  }, [timeframe]);

  // Handle Export Telemetry as CSV
  const handleExportCSV = () => {
    if (!data?.dailyTrends) return;
    const headers = 'Date,Present,WFH,HalfDay,OnLeave,Absent,PresenceRate(%),TasksCreated,TasksCompleted\n';
    const rows = data.dailyTrends
      .map(
        (t) =>
          `${t.date},${t.present},${t.wfh},${t.halfDay},${t.onLeave},${t.absent},${t.presenceRate},${t.tasksCreated},${t.tasksCompleted}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cruvels-telemetry-${timeframe}d.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // SVG Chart Computations for Task Velocity Line/Area Chart
  const trendSvgData = useMemo(() => {
    if (!data?.dailyTrends || data.dailyTrends.length === 0) return null;
    const trends = data.dailyTrends;
    const maxVal = Math.max(
      ...trends.map((t) => Math.max(t.tasksCreated, t.tasksCompleted, 1)),
      5
    );
    const width = 800;
    const height = 200;
    const paddingX = 40;
    const paddingY = 25;
    const graphWidth = width - paddingX * 2;
    const graphHeight = height - paddingY * 2;

    const pointsCreated: [number, number][] = [];
    const pointsCompleted: [number, number][] = [];

    trends.forEach((t, i) => {
      const x = paddingX + (i / (trends.length - 1 || 1)) * graphWidth;
      const yCreated = height - paddingY - (t.tasksCreated / maxVal) * graphHeight;
      const yCompleted = height - paddingY - (t.tasksCompleted / maxVal) * graphHeight;
      pointsCreated.push([x, yCreated]);
      pointsCompleted.push([x, yCompleted]);
    });

    const pathCreated = pointsCreated.reduce(
      (acc, [x, y], i) => (i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`),
      ''
    );
    const pathCompleted = pointsCompleted.reduce(
      (acc, [x, y], i) => (i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`),
      ''
    );

    const areaCompleted = `${pathCompleted} L ${pointsCompleted[pointsCompleted.length - 1][0]} ${
      height - paddingY
    } L ${pointsCompleted[0][0]} ${height - paddingY} Z`;

    return {
      pointsCreated,
      pointsCompleted,
      pathCreated,
      pathCompleted,
      areaCompleted,
      maxVal,
      width,
      height,
      paddingX,
      paddingY,
    };
  }, [data?.dailyTrends]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Navigation Rail for Admin Modules */}
        <AdminNavRail currentSection="analytics" />

        {/* Hero Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Activity className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1
                  className="text-xl sm:text-2xl font-black tracking-tight truncate"
                  style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
                >
                  Admin Analytics &amp; Productivity Pipeline
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <ShieldCheck className="h-3 w-3" /> Admin Supervisor
                </span>
              </div>
              <p className="text-xs truncate sm:text-clip" style={{ color: 'var(--muted)' }}>
                Real-time workforce attendance telemetry, task velocity curves &amp; squad performance indices
              </p>
            </div>
          </div>

          {/* Timeframe & Action Controls */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            {/* Timeframe Selector */}
            <div
              className="flex rounded-xl p-1 border text-xs font-bold"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}
            >
              {[
                { label: '7D', days: 7 },
                { label: '14D', days: 14 },
                { label: '30D', days: 30 },
              ].map((tf) => (
                <button
                  key={tf.days}
                  onClick={() => setTimeframe(tf.days)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    timeframe === tf.days
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchAnalytics(timeframe)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold shadow-xs transition-all hover:bg-[var(--surface-hover)] active:scale-95 cursor-pointer touch-manipulation"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              title="Refresh Telemetry Pipeline"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-blue-500' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="glow-btn-primary flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer"
              title="Export Telemetry Data"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-24 space-y-3">
            <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
            <p className="text-xs font-medium text-[var(--muted)]">Aggregating telemetry pipeline data...</p>
          </div>
        ) : !data ? (
          <div
            className="rounded-3xl p-12 text-center border"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <AlertTriangle className="h-10 w-10 mx-auto mb-2 text-amber-500" />
            <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
              Unable to load analytics pipeline
            </h3>
            <p className="text-xs mt-1 text-[var(--muted)]">Please verify connection or check user privileges.</p>
          </div>
        ) : (
          <>
            {/* ─── 1. Executive Telemetry KPI Cards ─────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Overall Productivity Score */}
              <div
                className="rounded-3xl p-5 border shadow-xs space-y-2 relative overflow-hidden"
                style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Productivity Index
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-3xl font-black tracking-tight" style={{ color: 'var(--ink)' }}>
                  {data.summary.overallProductivityScore}%
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Optimal Performance Band</span>
                </div>
              </div>

              {/* Attendance Presence Rate */}
              <div
                className="rounded-3xl p-5 border shadow-xs space-y-2 relative overflow-hidden"
                style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Presence Rate
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                  {data.summary.avgPresenceRate}%
                </div>
                <div className="text-[11px] text-[var(--muted)] font-medium">
                  {data.summary.totalPunchesInPeriod} total punches verified
                </div>
              </div>

              {/* Task Completion Velocity */}
              <div
                className="rounded-3xl p-5 border shadow-xs space-y-2 relative overflow-hidden"
                style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Task Completion Rate
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-3xl font-black tracking-tight text-purple-600 dark:text-purple-400">
                  {data.summary.taskCompletionRate}%
                </div>
                <div className="text-[11px] text-[var(--muted)] font-medium">
                  {data.summary.completedTasks} of {data.summary.totalTasks} tasks resolved
                </div>
              </div>

              {/* Overdue & Risk Indicator */}
              <div
                className="rounded-3xl p-5 border shadow-xs space-y-2 relative overflow-hidden"
                style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Active Workforce
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-3xl font-black tracking-tight" style={{ color: 'var(--ink)' }}>
                  {data.summary.totalWorkforce}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)]">
                  <span>{data.summary.overdueTasksCount} overdue tasks flagged</span>
                </div>
              </div>
            </div>

            {/* ─── 2. Interactive Task Velocity & Productivity Timeline Chart ─── */}
            <div
              className="rounded-3xl p-6 border shadow-xs space-y-4"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h3
                    className="text-base font-bold tracking-tight"
                    style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
                  >
                    Task Completion Velocity Curve (Last {timeframe} Days)
                  </h3>
                  <p className="text-xs text-[var(--muted)]">
                    Comparative tracking of tasks created vs tasks finalized over time
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                    <span>Tasks Completed</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                    <span>Tasks Created</span>
                  </span>
                </div>
              </div>

              {/* SVG Area/Line Chart */}
              {trendSvgData && (
                <div className="relative w-full overflow-x-auto select-none pt-2">
                  <svg
                    viewBox={`0 0 ${trendSvgData.width} ${trendSvgData.height}`}
                    className="w-full h-48 sm:h-56 overflow-visible"
                  >
                    <defs>
                      <linearGradient id="completedAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Gridlines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                      const y =
                        trendSvgData.height -
                        trendSvgData.paddingY -
                        pct * (trendSvgData.height - trendSvgData.paddingY * 2);
                      const val = Math.round(pct * trendSvgData.maxVal);
                      return (
                        <g key={idx}>
                          <line
                            x1={trendSvgData.paddingX}
                            y1={y}
                            x2={trendSvgData.width - trendSvgData.paddingX}
                            y2={y}
                            stroke="var(--line-soft)"
                            strokeDasharray="4 4"
                          />
                          <text
                            x={trendSvgData.paddingX - 10}
                            y={y + 3}
                            textAnchor="end"
                            fontSize="9"
                            fill="var(--muted)"
                          >
                            {val}
                          </text>
                        </g>
                      );
                    })}

                    {/* Shaded Area for Completed */}
                    <path d={trendSvgData.areaCompleted} fill="url(#completedAreaGrad)" />

                    {/* Created Line (dashed slate) */}
                    <path
                      d={trendSvgData.pathCreated}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />

                    {/* Completed Line (solid blue) */}
                    <path
                      d={trendSvgData.pathCompleted}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="3"
                    />

                    {/* Interactive Hover Nodes */}
                    {trendSvgData.pointsCompleted.map(([x, y], idx) => {
                      const isHovered = hoveredTrendIndex === idx;
                      return (
                        <g
                          key={idx}
                          onMouseEnter={() => setHoveredTrendIndex(idx)}
                          onMouseLeave={() => setHoveredTrendIndex(null)}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={x}
                            cy={y}
                            r={isHovered ? 6 : 3}
                            fill="#2563eb"
                            stroke="#ffffff"
                            strokeWidth="2"
                            className="transition-all"
                          />
                          {/* Invisible hit target for easy mouse hover */}
                          <rect
                            x={x - 12}
                            y={0}
                            width={24}
                            height={trendSvgData.height}
                            fill="transparent"
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Active Tooltip */}
                  {hoveredTrendIndex !== null && data.dailyTrends[hoveredTrendIndex] && (
                    <div
                      className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-xl px-3 py-2 text-xs shadow-xl pointer-events-none flex items-center gap-3 animate-in fade-in z-20"
                    >
                      <div className="font-bold">{data.dailyTrends[hoveredTrendIndex].date}</div>
                      <div>
                        Completed:{' '}
                        <span className="font-bold text-blue-400">
                          {data.dailyTrends[hoveredTrendIndex].tasksCompleted}
                        </span>
                      </div>
                      <div>
                        Created:{' '}
                        <span className="font-bold text-slate-300">
                          {data.dailyTrends[hoveredTrendIndex].tasksCreated}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ─── 3. Stacked Daily Attendance Distribution ─────────────── */}
            <div
              className="rounded-3xl p-6 border shadow-xs space-y-4"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h3
                    className="text-base font-bold tracking-tight"
                    style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
                  >
                    Daily Attendance Presence Breakdown
                  </h3>
                  <p className="text-xs text-[var(--muted)]">
                    Real-time presence distribution across onsite, WFH, leave &amp; half-day shifts
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs font-semibold flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span>Present</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span>WFH</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span>Half Day</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    <span>Leave</span>
                  </span>
                </div>
              </div>

              {/* Stacked Bars */}
              <div className="pt-2">
                <div className="flex items-end gap-1.5 sm:gap-2 h-44 w-full select-none">
                  {data.dailyTrends.map((d, idx) => {
                    const isHovered = hoveredBarIndex === idx;
                    const total = d.present + d.wfh + d.halfDay + d.onLeave + d.absent || 1;
                    const presentPct = (d.present / total) * 100;
                    const wfhPct = (d.wfh / total) * 100;
                    const halfDayPct = (d.halfDay / total) * 100;
                    const leavePct = (d.onLeave / total) * 100;

                    return (
                      <div
                        key={d.date}
                        onMouseEnter={() => setHoveredBarIndex(idx)}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                        className="flex-1 flex flex-col justify-end h-full relative cursor-pointer group"
                      >
                        {/* Hover Tooltip */}
                        {isHovered && (
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-xl px-2.5 py-1.5 text-[10px] shadow-xl pointer-events-none whitespace-nowrap z-30">
                            <div className="font-bold border-b border-white/20 pb-0.5">{d.date}</div>
                            <div>Present: {d.present}</div>
                            <div>WFH: {d.wfh}</div>
                            <div>Half Day: {d.halfDay}</div>
                            <div>Leave: {d.onLeave}</div>
                            <div className="text-emerald-400 font-bold mt-0.5">Rate: {d.presenceRate}%</div>
                          </div>
                        )}

                        <div className="w-full rounded-t-lg overflow-hidden flex flex-col-reverse transition-transform group-hover:scale-105">
                          {/* Present Segment */}
                          <div
                            style={{ height: `${presentPct}%` }}
                            className="bg-emerald-500 transition-all"
                          />
                          {/* WFH Segment */}
                          <div
                            style={{ height: `${wfhPct}%` }}
                            className="bg-blue-500 transition-all"
                          />
                          {/* Half Day Segment */}
                          <div
                            style={{ height: `${halfDayPct}%` }}
                            className="bg-amber-500 transition-all"
                          />
                          {/* Leave Segment */}
                          <div
                            style={{ height: `${leavePct}%` }}
                            className="bg-rose-500 transition-all"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Date Axis Sample Labels */}
                <div className="flex justify-between text-[10px] text-[var(--muted)] font-mono mt-2 pt-1 border-t border-[var(--line-soft)]">
                  <span>{data.dailyTrends[0]?.date}</span>
                  <span>{data.dailyTrends[Math.floor(data.dailyTrends.length / 2)]?.date}</span>
                  <span>{data.dailyTrends[data.dailyTrends.length - 1]?.date}</span>
                </div>
              </div>
            </div>

            {/* ─── 4. Squad Velocity Leaderboard & Task Status Distribution ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Squad Leaderboard (2 cols) */}
              <div
                className="lg:col-span-2 rounded-3xl p-6 border shadow-xs space-y-4"
                style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3
                      className="text-base font-bold tracking-tight"
                      style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
                    >
                      Squad Velocity &amp; Completion Ranking
                    </h3>
                    <p className="text-xs text-[var(--muted)]">
                      Productivity rate comparisons across operational teams
                    </p>
                  </div>
                  <Award className="h-5 w-5 text-amber-500" />
                </div>

                <div className="space-y-3 pt-1">
                  {data.squadAnalytics.length === 0 ? (
                    <p className="text-xs text-[var(--muted)] py-4 text-center">No squad data available.</p>
                  ) : (
                    data.squadAnalytics.map((squad, i) => (
                      <div
                        key={squad.id}
                        className="rounded-2xl p-3.5 border transition-all hover:shadow-xs"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white text-[11px] font-black">
                              {i + 1}
                            </span>
                            <div>
                              <div className="text-xs font-bold" style={{ color: 'var(--ink)' }}>
                                {squad.name}
                              </div>
                              <div className="text-[10px] text-[var(--muted)]">
                                {squad.departmentName} • Lead: {squad.leaderName}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                              {squad.completionRate}%
                            </span>
                            <div className="text-[10px] text-[var(--muted)]">
                              {squad.completedTasks}/{squad.totalTasks} Done
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
                            style={{ width: `${squad.completionRate}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Task Lifecycle Breakdown (1 col) */}
              <div
                className="rounded-3xl p-6 border shadow-xs space-y-4"
                style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
              >
                <div>
                  <h3
                    className="text-base font-bold tracking-tight"
                    style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
                  >
                    Task Pipeline Status
                  </h3>
                  <p className="text-xs text-[var(--muted)]">Current stage distribution across all squads</p>
                </div>

                <div className="space-y-2.5 pt-2">
                  {[
                    { label: 'Completed (Done)', count: data.taskStatusCounts.done, color: 'bg-emerald-500' },
                    { label: 'In Progress', count: data.taskStatusCounts.in_progress, color: 'bg-blue-500' },
                    { label: 'In Review', count: data.taskStatusCounts.in_review, color: 'bg-purple-500' },
                    { label: 'To Do', count: data.taskStatusCounts.todo, color: 'bg-slate-400' },
                    { label: 'Blocked', count: data.taskStatusCounts.blocked, color: 'bg-rose-500' },
                  ].map((item) => {
                    const pct = Math.round((item.count / (data.summary.totalTasks || 1)) * 100);
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span style={{ color: 'var(--ink)' }}>{item.label}</span>
                          <span className="text-[var(--muted)]">
                            {item.count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.color} transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Priority Breakdown */}
                <div className="pt-4 border-t border-[var(--line-soft)] space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    Workload by Priority
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2.5 rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
                      <div className="text-base font-black text-rose-500">{data.taskPriorityCounts.urgent}</div>
                      <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Urgent</div>
                    </div>
                    <div className="p-2.5 rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
                      <div className="text-base font-black text-amber-500">{data.taskPriorityCounts.high}</div>
                      <div className="text-[10px] font-bold text-[var(--muted)] uppercase">High</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
