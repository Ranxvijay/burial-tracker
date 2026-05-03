import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { ArrowLeft, Briefcase, Calendar, TrendingUp, Users, RefreshCw, MapPin, ChevronLeft, ChevronRight, Sparkles, Clock3 } from 'lucide-react';
import { api } from '../api';
import { TechDetail as TechDetailType, Period } from '../types';
import PeriodSelector from '../components/PeriodSelector';
import StatCard from '../components/StatCard';
import { format, parseISO } from 'date-fns';

function formatDate(d: string) {
  try { return format(parseISO(d), 'MMM d'); } catch { return d; }
}

function ProductivityGauge({ score }: { score: number }) {
  const clamped = Math.min(Math.max(score, 0), 200);
  const color = clamped >= 120 ? '#10b981' : clamped >= 80 ? '#6366f1' : clamped >= 50 ? '#f59e0b' : '#ef4444';
  const label = clamped >= 120 ? 'High Performer' : clamped >= 80 ? 'On Track' : clamped >= 50 ? 'Below Average' : 'Needs Attention';

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="#f3f4f6" strokeWidth="12" strokeLinecap="round" />
        <path
          d="M10,60 A50,50 0 0,1 110,60"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 200) * 157} 157`}
        />
        <text x="60" y="55" textAnchor="middle" fontSize="16" fontWeight="bold" fill={color}>{score}%</text>
      </svg>
      <p className="text-xs font-medium mt-1" style={{ color }}>{label}</p>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
}

function crewLabel(id: string) {
  return `Crew ${id}`;
}

export default function TechDetail() {
  const { id } = useParams<{ id: string }>();
  const [period, setPeriod] = useState<Period>('monthly');
  const [data, setData] = useState<TechDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const d = await api.getTech(id, period, undefined, undefined, page);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load technician data');
    } finally {
      setLoading(false);
    }
  }, [id, period, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [period]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500">{error}</p>
        <Link to="/techs" className="btn-secondary mt-4 inline-flex">Back to Technicians</Link>
      </div>
    );
  }

  if (!data) return null;

  const { tech, stats, dailyJobs, weeklySummary, jobs, pagination, dateRange } = data;

  return (
    <div className="p-5 md:p-6 space-y-6">
      {/* Header */}
      <div className="card relative overflow-hidden p-5 md:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.12),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.10),transparent_30%)] pointer-events-none" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <Link to="/techs" className="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-slate-600 shadow-sm backdrop-blur-md transition-transform hover:-translate-x-0.5">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-500 to-sky-500 flex items-center justify-center text-white font-black text-lg shadow-lg">
                {getInitials(tech.name)}
              </div>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600 shadow-sm backdrop-blur-md">
                  <Sparkles className="w-3 h-3" />
                  Individual Profile
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-950">{tech.name}</h1>
                  <p className="mt-1 text-sm font-mono text-slate-400">{crewLabel(tech.id)} · ID: {tech.id}</p>
                </div>
                <p className="max-w-2xl text-sm text-slate-500">
                  Detailed performance profile with activity trends, productivity context, and a job history timeline for this technician.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-600/40 bg-slate-800/40 px-4 py-3 shadow-sm backdrop-blur-md">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">First Job</p>
              <p className="mt-1 text-sm font-semibold text-white">{stats.first_job}</p>
            </div>
            <div className="rounded-2xl border border-slate-600/40 bg-slate-800/40 px-4 py-3 shadow-sm backdrop-blur-md">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">Last Job</p>
              <p className="mt-1 text-sm font-semibold text-white">{stats.last_job}</p>
            </div>
            <PeriodSelector value={period} onChange={setPeriod} />
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-600/40 bg-slate-800/40 p-3 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300"><Briefcase className="w-3.5 h-3.5 text-indigo-500" /> Total Jobs</div>
            <p className="mt-2 text-2xl font-black text-white">{stats.total_jobs.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-slate-600/40 bg-slate-800/40 p-3 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300"><Clock3 className="w-3.5 h-3.5 text-sky-500" /> Active Days</div>
            <p className="mt-2 text-2xl font-black text-white">{stats.active_days}</p>
          </div>
          <div className="rounded-2xl border border-slate-600/40 bg-slate-800/40 p-3 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300"><Users className="w-3.5 h-3.5 text-emerald-500" /> Team Avg</div>
            <p className="mt-2 text-2xl font-black text-white">{stats.team_avg.toFixed(1)}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Jobs"
          value={stats.total_jobs.toLocaleString()}
          icon={<Briefcase className="w-5 h-5" />}
          color="indigo"
        />
        <StatCard
          title="Active Days"
          value={stats.active_days}
          icon={<Calendar className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Avg Jobs/Day"
          value={stats.avg_jobs_per_day.toFixed(1)}
          subtitle={`Target: 3/day · Team avg: ${stats.team_avg.toFixed(1)}`}
          icon={<TrendingUp className="w-5 h-5" />}
          color={stats.avg_jobs_per_day >= 3 ? 'green' : 'amber'}
        />
        <StatCard
          title="Weekly Target"
          value={weeklySummary.length > 0 ? weeklySummary[weeklySummary.length - 1].jobs : 0}
          subtitle={`Goal: 15 jobs/week ${weeklySummary.length > 0 && weeklySummary[weeklySummary.length - 1].jobs >= 15 ? '✓ $225 bonus' : ''}`}
          icon={<Users className="w-5 h-5" />}
          color={weeklySummary.length > 0 && weeklySummary[weeklySummary.length - 1].jobs >= 15 ? 'green' : (weeklySummary.length > 0 && weeklySummary[weeklySummary.length - 1].jobs >= 10 ? 'blue' : 'amber')}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily trend */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900 mb-4">Daily Job Activity</h2>
          {dailyJobs.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyJobs}>
                <defs>
                  <linearGradient id="techGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={formatDate} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number) => [v, 'Jobs']}
                  labelFormatter={formatDate}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                {stats.team_avg > 0 && (
                  <ReferenceLine
                    y={stats.avg_jobs_per_day}
                    stroke="#6366f1"
                    strokeDasharray="4 4"
                    label={{ value: 'Their avg', position: 'right', fontSize: 10, fill: '#6366f1' }}
                  />
                )}
                <Area type="monotone" dataKey="jobs" stroke="#6366f1" strokeWidth={2} fill="url(#techGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No activity in this period</div>
          )}
        </div>

        {/* Productivity gauge + weekly */}
        <div className="space-y-4">
          <div className="card p-5 flex flex-col items-center">
            <h2 className="font-semibold text-slate-900 mb-3 self-start">Productivity Score</h2>
            <ProductivityGauge score={stats.productivity_score} />
            <p className="text-xs text-slate-500 mt-2 text-center">
              Compared to team average of {stats.team_avg.toFixed(1)} jobs
            </p>
          </div>

          {weeklySummary.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold text-slate-900 mb-3 text-sm">Weekly Summary</h2>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={weeklySummary.slice(-8)} barSize={14}>
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#9ca3af' }} tickFormatter={w => w.split('-W')[1] ? `W${w.split('-W')[1]}` : w} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number) => [v, 'Jobs']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 11 }}
                  />
                  <Bar dataKey="jobs" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Jobs List */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">
            Job History
            <span className="ml-2 text-xs text-slate-400 font-normal">
              {dateRange.start} – {dateRange.end}
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            {pagination.total.toLocaleString()} total · Page {pagination.page}/{pagination.totalPages}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-4 h-4 text-brand-500 animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            No jobs recorded in this period
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {jobs.map(job => (
                  <tr key={job.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 text-slate-700 text-xs whitespace-nowrap">{formatDate(job.date)}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        {job.address}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-3 border-t border-slate-100">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <span className="text-xs text-slate-500">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
