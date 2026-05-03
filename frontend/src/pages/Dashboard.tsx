import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import {
  Briefcase, Users, TrendingUp, Award, ChevronLeft, ChevronRight,
  Calendar, CalendarDays, RefreshCw, AlertCircle, Star, MapPin,
  Search, Upload, Download, Lightbulb, CheckCircle, AlertTriangle,
  Info, BarChart2, Map, Zap, Clock,
} from 'lucide-react';
import {
  format, parseISO, addDays, addWeeks, addMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
} from 'date-fns';
import toast from 'react-hot-toast';
import { api } from '../api';
import { DashboardData, DashboardJob, TechRow, Period } from '../types';
import StatCard from '../components/StatCard';

// ── Date helpers ──────────────────────────────────────────────────────────────
const todayStr = format(new Date(), 'yyyy-MM-dd');

function calcRange(period: Period, anchor: string): { start: string; end: string } {
  if (period === 'all') return { start: '', end: '' };
  const d = parseISO(anchor);
  if (period === 'daily') return { start: anchor, end: anchor };
  if (period === 'weekly') {
    const mon = startOfWeek(d, { weekStartsOn: 1 });
    return { start: format(mon, 'yyyy-MM-dd'), end: format(endOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
  }
  return { start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd') };
}

function nav(period: Period, anchor: string, dir: -1 | 1): string {
  const d = parseISO(anchor);
  if (period === 'daily') return format(addDays(d, dir), 'yyyy-MM-dd');
  if (period === 'weekly') return format(addWeeks(d, dir), 'yyyy-MM-dd');
  if (period === 'monthly') return format(addMonths(d, dir), 'yyyy-MM-dd');
  return anchor;
}

function periodLabel(period: Period, start: string, end: string): string {
  if (period === 'all' || !start) return 'All Time';
  const s = parseISO(start);
  const e = parseISO(end);
  if (period === 'daily') return format(s, 'EEEE, MMMM d, yyyy');
  if (period === 'weekly') return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
  return format(s, 'MMMM yyyy');
}

function fmtD(d: string, pat = 'MMM d') {
  try { return format(parseISO(d), pat); } catch { return d; }
}

// ── Auto insights ─────────────────────────────────────────────────────────────
function buildInsights(data: DashboardData) {
  const insights: Array<{ type: 'positive' | 'warning' | 'info'; text: string }> = [];

  if (data.stats.topPerformer && data.stats.avgJobsPerTech > 0) {
    const pct = Math.round(
      ((data.stats.topPerformer.job_count - data.stats.avgJobsPerTech) / data.stats.avgJobsPerTech) * 100
    );
    if (pct > 30)
      insights.push({ type: 'positive', text: `${data.stats.topPerformer.name} leads with ${data.stats.topPerformer.job_count} jobs — ${pct}% above team average` });
  }

  const lowTechs = data.techBreakdown.filter(t => t.productivity < 60 && t.jobs > 0);
  if (lowTechs.length > 0)
    insights.push({ type: 'warning', text: `${lowTechs.length} tech${lowTechs.length > 1 ? 's' : ''} below 60% of team average: ${lowTechs.slice(0, 3).map(t => t.name).join(', ')}` });

  if (data.stats.bestDay && data.stats.activeDays > 1)
    insights.push({ type: 'info', text: `Best day: ${fmtD(data.stats.bestDay.date, 'EEEE, MMM d')} with ${data.stats.bestDay.jobs} jobs completed` });

  if (data.municipalities?.length > 0) {
    const top = data.municipalities[0];
    const pct = Math.round((top.jobs / data.stats.totalJobs) * 100);
    insights.push({ type: 'info', text: `${top.city} had the highest volume — ${top.jobs} jobs (${pct}% of total)` });
  }

  if (data.comparison.totalJobs > 0) {
    const change = data.stats.totalJobs - data.comparison.totalJobs;
    const pct = Math.round((change / data.comparison.totalJobs) * 100);
    if (Math.abs(pct) >= 5)
      insights.push({
        type: pct > 0 ? 'positive' : 'warning',
        text: `${Math.abs(pct)}% ${pct > 0 ? 'more' : 'fewer'} jobs than previous period (${data.comparison.totalJobs} → ${data.stats.totalJobs})`,
      });
  }

  return insights.slice(0, 4);
}

// ── PIE colours ───────────────────────────────────────────────────────────────
const PIE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#64748b', '#ec4899', '#14b8a6', '#f97316'];
const PERIODS: { value: Period; label: string }[] = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
  { value: 'all', label: 'All Time' },
];

function ProdBar({ score }: { score: number }) {
  const w = Math.min(score, 200) / 2;
  const c = score >= 120 ? 'bg-emerald-500' : score >= 80 ? 'bg-indigo-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${c}`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-7 text-right">{score}%</span>
    </div>
  );
}

function ProdBadge({ score }: { score: number }) {
  if (score >= 120) return <span className="badge bg-emerald-400/10 text-emerald-200 border border-emerald-400/20">High</span>;
  if (score >= 80) return <span className="badge bg-cyan-400/10 text-cyan-200 border border-cyan-400/20">On Track</span>;
  if (score >= 50) return <span className="badge bg-amber-400/10 text-amber-200 border border-amber-400/20">Low</span>;
  return <span className="badge bg-rose-400/10 text-rose-200 border border-rose-400/20">Critical</span>;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [period, setPeriod] = useState<Period>('weekly');
  const [anchor, setAnchor] = useState(todayStr);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobsPage, setJobsPage] = useState(1);
  const [filterTech, setFilterTech] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const loadRef = useRef<(() => void) | null>(null);

  const { start, end } = calcRange(period, anchor);

  const load = useCallback(async (pg = 1, ft = filterTech, search = '') => {
    setLoading(true);
    try {
      const d = await api.getDashboard({ period, start, end, jobsPage: pg, filterTech: ft, jobSearch: search });
      setData(d);
      setLastUpdated(new Date());
    } catch {
      // keep existing data, just show stale indicator
    } finally {
      setLoading(false);
    }
  }, [period, start, end, filterTech]);

  useEffect(() => { loadRef.current = load; }, [load]);

  // Initial load + period/anchor changes
  useEffect(() => {
    setJobsPage(1);
    setFilterTech('');
    setSearchInput('');
    setJobSearch('');
  }, [period, anchor]);

  useEffect(() => { load(1, '', ''); }, [load]);

  useEffect(() => {
    const nextSearch = searchInput.trim();
    const timer = setTimeout(() => {
      setJobSearch(nextSearch);
      setJobsPage(1);
      load(1, filterTech, nextSearch);
    }, nextSearch ? 250 : 0);
    return () => clearTimeout(timer);
  }, [searchInput, filterTech, load]);

  // ── SSE live updates ────────────────────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onopen = () => setIsLive(true);
    es.onerror = () => setIsLive(false);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'connected') setIsLive(true);
        if (msg.type === 'upload') {
          loadRef.current?.();
          setCountdown(30);
          toast.success(`New data imported — ${msg.jobsImported} jobs`, { icon: '📊' });
        }
      } catch { /* ignore parse errors */ }
    };
    return () => es.close();
  }, []);

  // ── Auto-refresh countdown ──────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          loadRef.current?.();
          return 30;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  function jumpToLatest() {
    if (!data?.dataRange) return;
    setAnchor(data.dataRange.end);
    if (period === 'all') setPeriod('daily');
  }

  function changePeriod(p: Period) {
    setPeriod(p);
    if (data?.dataRange && todayStr > data.dataRange.end) setAnchor(data.dataRange.end);
    else setAnchor(todayStr);
  }

  function updateFilterTech(nextTech: string) {
    setFilterTech(nextTech);
    setJobsPage(1);
  }

  function resetJobFilters() {
    setFilterTech('');
    setSearchInput('');
    setJobSearch('');
    setJobsPage(1);
  }

  const hasData = (data?.stats.totalJobs ?? 0) > 0;
  const label = periodLabel(period, start, end);
  const insights = data && hasData ? buildInsights(data) : [];
  const filteredJobs = data?.jobs.data ?? [];
  const visibleJobs = showAllJobs ? filteredJobs : filteredJobs.slice(0, 6);
  const selectedTech = filterTech && data ? data.techBreakdown.find(t => t.id === filterTech) : null;
  const topCity = data?.municipalities?.[0];
  const bestDayText = data?.stats.bestDay ? fmtD(data.stats.bestDay.date, 'EEE, MMM d') : '—';

  // ── Skeleton ─────────────────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="p-5 space-y-5">
        <div className="skeleton h-8 w-48 rounded-xl" />
        <div className="skeleton h-14 w-full rounded-2xl" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="skeleton h-56 rounded-2xl col-span-2" />
          <div className="skeleton h-56 rounded-2xl" />
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4 min-h-screen">

      {/* ─── Top header ────────────────────────────────────────────── */}
      <div className="lux-panel relative overflow-hidden p-5 md:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.14),transparent_30%)] pointer-events-none" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200 shadow-sm backdrop-blur-md">
              <Star className="w-3 h-3" />
              Executive Overview
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-50">Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                A clear, high-signal view of job volume, technician performance, and live import status.
              </p>
            </div>
            {data?.dataRange && (
              <p className="text-xs font-medium text-slate-400">
                Dataset: {data.dataRange.start} → {data.dataRange.end}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Live indicator */}
            <div className={`glass-chip flex items-center gap-1.5 px-3 py-2 text-xs font-semibold ${
              isLive ? 'bg-emerald-50/90 border-emerald-200 text-emerald-700' : 'bg-white/70 border-white/70 text-slate-500'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 live-dot' : 'bg-slate-400'}`} />
              {isLive ? 'Live' : 'Offline'}
              {isLive && <span className="text-emerald-500/70 ml-1">· {countdown}s</span>}
            </div>

            {/* Last updated */}
            <span className="glass-chip text-xs text-slate-400 flex items-center gap-1 px-3 py-2">
              <Clock className="w-3 h-3" />
              {format(lastUpdated, 'HH:mm:ss')}
            </span>

            {/* Export */}
            {hasData && start && (
              <button
                onClick={() => api.exportJobsCsv(start, end, filterTech || undefined)}
                className="btn-secondary text-xs py-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}

            {hasData && period === 'daily' && start && (
              <button
                onClick={() => api.exportDailySummaryExcel(start)}
                className="btn-secondary text-xs py-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Daily Excel
              </button>
            )}

            {/* Refresh */}
            <button onClick={() => load(jobsPage, filterTech, jobSearch)} className="btn-ghost">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link to="/upload" className="btn-primary text-xs">
              <Upload className="w-3.5 h-3.5" /> Upload
            </Link>
          </div>
        </div>
      </div>

        {hasData && data && (
          <div className="dashboard-summary mt-5 relative">
            <div className="dashboard-summary-card">
              <div className="dashboard-summary-label">Total Jobs</div>
              <div className="dashboard-summary-value">{data.stats.totalJobs.toLocaleString()}</div>
              <div className="dashboard-summary-sub">{data.stats.activeDays} active day{data.stats.activeDays === 1 ? '' : 's'}</div>
            </div>
            <div className="dashboard-summary-card">
              <div className="dashboard-summary-label">Top Tech</div>
              <div className="dashboard-summary-value">{data.stats.topPerformer?.name ?? '—'}</div>
              <div className="dashboard-summary-sub">{data.stats.topPerformer ? `${data.stats.topPerformer.job_count} jobs` : 'No ranking yet'}</div>
            </div>
            <div className="dashboard-summary-card">
              <div className="dashboard-summary-label">Best Day</div>
              <div className="dashboard-summary-value">{bestDayText}</div>
              <div className="dashboard-summary-sub">{data.stats.bestDay ? `${data.stats.bestDay.jobs} jobs completed` : 'No peak day'}</div>
            </div>
            <div className="dashboard-summary-card">
              <div className="dashboard-summary-label">Top City</div>
              <div className="dashboard-summary-value">{topCity?.city ?? '—'}</div>
              <div className="dashboard-summary-sub">{topCity ? `${topCity.jobs} jobs (${Math.round((topCity.jobs / data.stats.totalJobs) * 100)}%)` : 'No location data'}</div>
            </div>
          </div>
        )}

      {/* ─── Period selector + date navigation ─────────────────────── */}
      <div className="lux-panel dashboard-toolbar p-3 flex flex-wrap items-center gap-3 mt-4">
        <div className="inline-flex rounded-2xl p-1 bg-white/5 border border-white/10 shadow-inner">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => changePeriod(p.value)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-xl transition-all ${
                period === p.value ? 'bg-gradient-to-r from-emerald-300 via-cyan-300 to-amber-300 text-slate-950 shadow-sm ring-1 ring-cyan-200/70' : 'text-slate-300 hover:text-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period !== 'all' && (
          <>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAnchor(a => nav(period, a, -1))}
                className="dashboard-action p-1.5 transition-all backdrop-blur-md hover:bg-white/10"
              >
                <ChevronLeft className="w-4 h-4 text-slate-200" />
              </button>
              <div className="min-w-48 text-center px-2">
                <p className="text-sm font-bold text-slate-50 whitespace-nowrap">{label}</p>
              </div>
              <button
                onClick={() => setAnchor(a => nav(period, a, 1))}
                className="dashboard-action p-1.5 transition-all backdrop-blur-md hover:bg-white/10"
              >
                <ChevronRight className="w-4 h-4 text-slate-200" />
              </button>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <Calendar className="w-3.5 h-3.5 text-slate-300" />
              <input
                type="date"
                value={anchor}
                onChange={e => e.target.value && setAnchor(e.target.value)}
                className="dashboard-input text-xs rounded-xl px-2 py-1.5 backdrop-blur-md"
              />
            </label>

            <button
              onClick={() => setAnchor(todayStr)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                anchor === todayStr ? 'border-amber-300/50 bg-amber-300/10 text-amber-200' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              Today
            </button>
          </>
        )}
      </div>

      {/* ─── No data ────────────────────────────────────────────────── */}
      {!loading && !hasData && data && (
        <div className="card p-6 border-white/10 bg-white/5 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-400/10 rounded-full flex items-center justify-center flex-shrink-0 border border-amber-400/20">
            <AlertCircle className="w-5 h-5 text-amber-200" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-50">No jobs in this period</p>
            <p className="text-sm text-slate-300 mt-0.5">
              {data.dataRange
                ? `Your data covers ${data.dataRange.start} → ${data.dataRange.end}. Click below to jump there.`
                : 'Upload an Excel file to get started.'}
            </p>
          </div>
          {data.dataRange ? (
            <button onClick={jumpToLatest} className="btn-primary flex-shrink-0 text-xs">
              <CalendarDays className="w-4 h-4" /> Go to latest data
            </button>
          ) : (
            <Link to="/upload" className="btn-primary flex-shrink-0 text-xs">
              <Upload className="w-4 h-4" /> Upload Data
            </Link>
          )}
        </div>
      )}

      {/* ─── Day Strip ──────────────────────────────────────────────── */}
      {data?.dayHeaders && data.dayHeaders.length > 0 && data.dayHeaders.length <= 31 && (
        <div className="card p-4 fade-in highlight-section">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-indigo-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {period === 'daily' ? 'Selected Day' : period === 'weekly' ? 'Week at a Glance' : 'Month at a Glance'}
            </p>
            {hasData && (
              <span className="ml-auto text-xs text-gray-400">
                Click a day to drill down
              </span>
            )}
          </div>
          <div className={`grid gap-1.5 ${
            data.dayHeaders.length <= 7 ? 'grid-cols-7' : 'grid-cols-7'
          }`}>
            {data.dayHeaders.map(day => {
              const isSelected = day.date === anchor && period === 'daily';
              return (
                <button
                  key={day.date}
                  onClick={() => { setAnchor(day.date); setPeriod('daily'); }}
                  title={`${day.fullLabel}: ${day.jobs} jobs`}
                  data-jobs={day.jobs}
                  data-today={day.isToday}
                  data-selected={isSelected}
                  className={`rounded-xl p-2 text-center transition-all duration-150 border group ${
                    isSelected
                      ? 'bg-transparent border-transparent shadow-md shadow-indigo-200'
                      : day.isToday
                      ? 'border-transparent bg-transparent ring-1 ring-amber-300/50'
                      : day.jobs > 0
                      ? 'border-transparent bg-transparent hover:bg-white/5 hover:shadow-sm'
                      : 'border-transparent bg-transparent hover:bg-white/10'
                  }`}
                >
                  <p className={`text-xs font-semibold ${
                    isSelected ? 'text-slate-900' : day.isWeekend ? 'text-slate-400' : 'text-slate-300'
                  }`}>{day.dayName}</p>
                  <p className={`text-base font-black leading-tight ${
                    isSelected ? 'text-slate-950' : day.isToday ? 'text-amber-300' : day.jobs > 0 ? 'text-cyan-300' : 'text-slate-400'
                  }`}>{day.dayNum}</p>
                  {day.jobs > 0 ? (
                    <p className={`text-xs font-bold mt-0.5 ${isSelected ? 'text-slate-900' : 'text-cyan-300'}`}>{day.jobs}</p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-0.5">–</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Stat Cards ────────────────────────────────────────────── */}
      {hasData && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
            <StatCard
              title="Total Jobs"
              value={data.stats.totalJobs}
              subtitle={data.stats.activeDays > 1 ? `${data.stats.activeDays} active days` : undefined}
              icon={<Briefcase className="w-5 h-5" />}
              iconBg="bg-indigo-50 text-indigo-600"
              comparison={{ curr: data.stats.totalJobs, prev: data.comparison.totalJobs }}
            />
            <StatCard
              title="Active Technicians"
              value={data.stats.totalTechs}
              icon={<Users className="w-5 h-5" />}
              iconBg="bg-blue-50 text-blue-600"
              comparison={{ curr: data.stats.totalTechs, prev: data.comparison.totalTechs }}
            />
            <StatCard
              title={period === 'daily' ? 'Jobs per Tech' : 'Avg Jobs / Day'}
              value={period === 'daily' ? data.stats.avgJobsPerTech : data.stats.avgJobsPerDay}
              subtitle={period !== 'daily' ? `${data.stats.avgJobsPerTech.toFixed(1)} per tech` : undefined}
              icon={<TrendingUp className="w-5 h-5" />}
              iconBg="bg-emerald-50 text-emerald-600"
              comparison={{ curr: data.stats.avgJobsPerTech, prev: data.comparison.avgJobsPerTech }}
            />
            <StatCard
              title="Top Performer"
              value={data.stats.topPerformer ? `${data.stats.topPerformer.name} · Crew ${data.stats.topPerformer.tech_id}` : '—'}
              subtitle={data.stats.topPerformer ? `${data.stats.topPerformer.job_count} jobs${period === 'weekly' && data.stats.topPerformer.job_count >= 15 ? ' • $225 BONUS ✓' : ''}` : undefined}
              icon={<Award className="w-5 h-5" />}
              iconBg="bg-amber-50 text-amber-600"
            />
          </div>

          {/* ─── Insights banner ─────────────────────────────────────── */}
          {insights.length > 0 && (
            <div className="card p-4 bg-gradient-to-r from-white/5 via-white/5 to-white/5 border-white/10 fade-in">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-amber-400/10 rounded-lg flex items-center justify-center border border-amber-400/20">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-200" />
                </div>
                <p className="text-xs font-bold text-slate-200 uppercase tracking-wide">Quick Insights</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {insights.map((ins, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {ins.type === 'positive' && <CheckCircle className="w-4 h-4 text-emerald-300 flex-shrink-0 mt-0.5" />}
                    {ins.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-200 flex-shrink-0 mt-0.5" />}
                    {ins.type === 'info' && <Info className="w-4 h-4 text-cyan-200 flex-shrink-0 mt-0.5" />}
                    <p className="text-sm text-slate-300">{ins.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Performance Targets ────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4 border-l-4 border-emerald-400 bg-emerald-400/5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Daily Target</p>
                  <p className="text-2xl font-black text-emerald-900 mt-1">3 jobs/day</p>
                  <p className="text-xs text-emerald-700 mt-2">Standard daily productivity goal</p>
                </div>
                <div className="text-3xl">📋</div>
              </div>
            </div>
            <div className="card p-4 border-l-4 border-cyan-400 bg-cyan-400/5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-cyan-600">Weekly Bonus</p>
                  <p className="text-2xl font-black text-cyan-900 mt-1">$225 for 15 jobs</p>
                  <p className="text-xs text-cyan-700 mt-2">Reach 15 jobs per week for bonus</p>
                </div>
                <div className="text-3xl">🎁</div>
              </div>
            </div>
          </div>

          {/* ─── Charts Row 1 ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Trend */}
            <div className="card p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  <h2 className="font-bold text-gray-900 text-sm">
                    {period === 'daily' ? "Today's Job Activity" :
                     period === 'weekly' ? 'Jobs by Day This Week' :
                     'Jobs by Day This Month'}
                  </h2>
                </div>
                {data.stats.bestDay && period !== 'daily' && (
                  <span className="text-xs text-gray-400">
                    Peak: <span className="font-semibold text-indigo-600">{fmtD(data.stats.bestDay.date)}</span> ({data.stats.bestDay.jobs})
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.trendData} margin={{ left: -15, right: 5 }}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={d => fmtD(d, 'EEE d')}
                    interval={data.trendData.length > 14 ? Math.ceil(data.trendData.length / 7) - 1 : 0}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number) => [v, 'Jobs']}
                    labelFormatter={l => fmtD(l, 'EEEE, MMM d yyyy')}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e0e7ff', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  />
                  <Area type="monotone" dataKey="jobs" stroke="#6366f1" strokeWidth={2.5} fill="url(#trendGrad)"
                    dot={data.trendData.length <= 7 ? { fill: '#6366f1', strokeWidth: 0, r: 4 } : false}
                    activeDot={{ r: 6, fill: '#6366f1' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Day of week */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-amber-400" />
                <h2 className="font-bold text-gray-900 text-sm">Jobs by Weekday</h2>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.dowDistribution} barSize={22} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number) => [v, 'Jobs']}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e0e7ff', fontSize: 12 }}
                  />
                  <Bar dataKey="jobs" radius={[5, 5, 0, 0]}>
                    {data.dowDistribution.map((d, i) => (
                      <Cell key={i} fill={d.day === 'Sat' || d.day === 'Sun' ? '#e0e7ff' : '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ─── Charts Row 2 — Municipality breakdown ─────────────────── */}
          {data.municipalities?.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Horizontal bar */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Map className="w-4 h-4 text-emerald-500" />
                  <h2 className="font-bold text-gray-900 text-sm">Jobs by City / Municipality</h2>
                </div>
                <div className="space-y-2.5">
                  {data.municipalities.slice(0, 8).map((m, i) => {
                    const pct = Math.round((m.jobs / data.stats.totalJobs) * 100);
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700 truncate max-w-40">{m.city}</span>
                          <span className="text-gray-500 font-semibold ml-2">{m.jobs} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              background: `hsl(${220 + i * 15}, 70%, ${60 - i * 3}%)`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pie chart */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-indigo-400" />
                  <h2 className="font-bold text-gray-900 text-sm">Geographic Distribution</h2>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.municipalities.slice(0, 8)}
                      dataKey="jobs"
                      nameKey="city"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={35}
                      paddingAngle={2}
                    >
                      {data.municipalities.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, name: string) => [v, name]}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e0e7ff', fontSize: 12 }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ─── Technician Breakdown Table ─────────────────────────────── */}
          <div className="card overflow-hidden highlight-section">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <h2 className="font-bold text-gray-900 text-sm">
                  All Technicians
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {data.techBreakdown.length} techs · avg {data.stats.avgJobsPerTech.toFixed(1)} jobs
                  </span>
                </h2>
              </div>
              <button onClick={() => api.exportTechsCsv(start || todayStr, end || todayStr)} className="btn-ghost text-xs">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    {['#', 'Technician', 'Tech ID', 'Jobs', 'Days', 'Avg/Day', 'Productivity', 'Status', ''].map((h, i) => (
                      <th key={i} className={`px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide ${
                        i >= 4 && i <= 5 ? 'hidden md:table-cell' : i === 6 ? 'hidden lg:table-cell' : i === 7 ? 'hidden sm:table-cell' : ''
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.techBreakdown.map((tech: TechRow) => (
                    <tr key={tech.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="px-4 py-3 w-8">
                        {tech.rank === 1
                          ? <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          : <span className="text-xs text-gray-400">{tech.rank}</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{tech.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-indigo-600 bg-indigo-50/0 group-hover:bg-indigo-50 transition-colors rounded">{tech.id}</td>
                      <td className="px-4 py-3 font-bold text-gray-900 text-base">{tech.jobs}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{tech.activeDays}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell font-medium">{tech.avgPerDay}</td>
                      <td className="px-4 py-3 hidden lg:table-cell w-44"><ProdBar score={tech.productivity} /></td>
                      <td className="px-4 py-3 hidden sm:table-cell"><ProdBadge score={tech.productivity} /></td>
                      <td className="px-4 py-3">
                        <Link to={`/techs/${encodeURIComponent(tech.id)}`}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Jobs List ───────────────────────────────────────────────── */}
          <div className="card overflow-hidden highlight-section">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-400" />
                  <h2 className="font-bold text-gray-900 text-sm">
                    Job Records
                    <span className="ml-2 text-xs font-normal text-gray-400">{data.jobs.total.toLocaleString()} total</span>
                  </h2>
                </div>
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search address, technician, or crew number..."
                      value={searchInput}
                      onChange={e => setSearchInput(e.target.value)}
                      className="dashboard-input pl-8 pr-8 py-1.5 text-xs w-64 transition-colors"
                    />
                    {searchInput && (
                      <button
                        onClick={() => setSearchInput('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <select
                      value={filterTech}
                      onChange={e => updateFilterTech(e.target.value)}
                      className="dashboard-filter-chip text-xs px-2 py-1.5 pr-8"
                    >
                      <option value="">All Technicians</option>
                      {data.techBreakdown.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    {filterTech && (
                      <button
                        onClick={() => updateFilterTech('')}
                        title="Clear filter"
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 px-2 py-0.5"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <button
                    onClick={resetJobFilters}
                    className="dashboard-action px-2.5 py-1.5 text-xs font-semibold"
                  >
                    Reset
                  </button>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {data.jobs.total.toLocaleString()} matching · Pg {data.jobs.page}/{data.jobs.totalPages}
                    {selectedTech && ` · ${selectedTech.name}`}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 md:p-5">
              <div className="grid gap-3 lg:grid-cols-2">
                {visibleJobs.map((job: DashboardJob) => (
                  <article key={job.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all hover:bg-white/10 hover:border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                          <span>{fmtD(job.date, 'EEE')}</span>
                          <span>•</span>
                          <span>{fmtD(job.date)}</span>
                        </div>
                        <h3 className="mt-1 text-sm font-bold text-slate-50 truncate">{job.tech_name}</h3>
                        <p className="mt-1 text-xs font-mono text-cyan-200/90 inline-flex items-center gap-2">
                          <span className="rounded-md border border-cyan-300/15 bg-cyan-400/10 px-1.5 py-0.5">Crew {job.tech_id}</span>
                          <span className="text-slate-500">Crew number</span>
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 whitespace-nowrap">
                        Job #{job.id}
                      </span>
                    </div>
                    <div className="mt-3 flex items-start gap-2 text-sm text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                      <span className="leading-5 break-words">{job.address}</span>
                    </div>
                  </article>
                ))}
              </div>

              {filteredJobs.length > 6 && (
                <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                  <button
                    onClick={() => setShowAllJobs(v => !v)}
                    className="dashboard-action px-3 py-2 text-xs font-semibold"
                  >
                    {showAllJobs ? 'Show fewer' : `Show all ${filteredJobs.length} on this page`}
                  </button>
                  <span className="text-xs text-slate-400">
                    Showing {visibleJobs.length} of {filteredJobs.length} records on this page
                  </span>
                </div>
              )}
            </div>

            {/* Pagination */}
            {data.jobs.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
                <button
                  onClick={() => { const pg = Math.max(1, jobsPage - 1); setJobsPage(pg); load(pg, filterTech, jobSearch); }}
                  disabled={jobsPage === 1}
                  className="btn-secondary text-xs py-1.5 disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(data.jobs.totalPages, 7) }, (_, i) => i + 1).map(pg => (
                    <button
                      key={pg}
                      onClick={() => { setJobsPage(pg); load(pg, filterTech, jobSearch); }}
                      className={`w-8 h-8 text-xs rounded-lg font-bold transition-all ${
                        pg === jobsPage ? 'bg-gradient-to-r from-emerald-300 via-cyan-300 to-amber-300 text-slate-950 shadow-sm shadow-cyan-200/20' : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {pg}
                    </button>
                  ))}
                  {data.jobs.totalPages > 7 && <span className="text-slate-500 text-xs px-1">···</span>}
                </div>
                <button
                  onClick={() => { const pg = Math.min(data.jobs.totalPages, jobsPage + 1); setJobsPage(pg); load(pg, filterTech, jobSearch); }}
                  disabled={jobsPage === data.jobs.totalPages}
                  className="btn-secondary text-xs py-1.5 disabled:opacity-40"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* All-time empty */}
      {!loading && !hasData && !data?.dataRange && (
        <div className="card p-14 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5">
            <Upload className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">No data yet</h3>
          <p className="text-gray-500 mt-2 text-sm max-w-sm">Upload your first Excel payroll report to see the dashboard come alive with charts, rankings, and insights.</p>
          <Link to="/upload" className="btn-primary mt-5">Upload First Report</Link>
        </div>
      )}
    </div>
  );
}
