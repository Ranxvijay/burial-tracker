import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowUpDown, ChevronUp, ChevronDown, Users, RefreshCw, Briefcase, TrendingUp, Calendar, ArrowRight, Sparkles } from 'lucide-react';
import { api } from '../api';
import { Tech, Period } from '../types';
import PeriodSelector from '../components/PeriodSelector';

function ProductivityBadge({ score }: { score: number }) {
  if (score >= 120) return <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-100">High</span>;
  if (score >= 80) return <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-100">On Track</span>;
  if (score >= 50) return <span className="badge bg-amber-50 text-amber-700 border border-amber-100">Low</span>;
  return <span className="badge bg-rose-50 text-rose-700 border border-rose-100">Critical</span>;
}

function ProductivityBar({ score }: { score: number }) {
  const pct = Math.min(score, 200) / 2;
  const color = score >= 120 ? 'bg-green-500' : score >= 80 ? 'bg-blue-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{score}%</span>
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

function avatarGradient(index: number) {
  const styles = [
    'from-cyan-500 to-teal-500',
    'from-teal-500 to-emerald-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-orange-500 to-rose-500',
    'from-slate-700 to-cyan-700',
  ];
  return styles[index % styles.length];
}

function crewLabel(id: string) {
  return `Crew ${id}`;
}

type SortField = 'jobs' | 'name';
type SortOrder = 'asc' | 'desc';

export default function Techs() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortField>('jobs');
  const [order, setOrder] = useState<SortOrder>('desc');
  const [techs, setTechs] = useState<Tech[]>([]);
  const [teamAvg, setTeamAvg] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getTechs({ period, sort, order, search });
      setTechs(data.techs);
      setTeamAvg(data.teamAvg);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load technicians');
    } finally {
      setLoading(false);
    }
  }, [period, sort, order, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  function toggleSort(field: SortField) {
    if (sort === field) setOrder(o => o === 'desc' ? 'asc' : 'desc');
    else { setSort(field); setOrder('desc'); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
    return order === 'desc' ? <ChevronDown className="w-3.5 h-3.5 text-brand-500" /> : <ChevronUp className="w-3.5 h-3.5 text-brand-500" />;
  }

  return (
    <div className="p-5 md:p-6 space-y-5">
      <div className="lux-panel relative overflow-hidden p-5 md:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.16),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.12),transparent_30%)] pointer-events-none" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-700 shadow-sm backdrop-blur-md">
              <Sparkles className="w-3 h-3" />
              Team Profiles
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-950">Technicians</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">A profile-first overview of each technician, with performance, activity, and direct access to their individual page.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {teamAvg > 0 && (
              <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-md">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Team Avg</p>
                <p className="text-lg font-extrabold text-slate-950">{teamAvg} jobs</p>
              </div>
            )}
            <PeriodSelector value={period} onChange={setPeriod} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search technicians..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400 font-bold">Sort by</div>
          <button
            onClick={() => toggleSort('name')}
            className={`btn-secondary text-xs ${sort === 'name' ? 'ring-1 ring-cyan-200' : ''}`}
          >
            Technician <SortIcon field="name" />
          </button>
          <button
            onClick={() => toggleSort('jobs')}
            className={`btn-secondary text-xs ${sort === 'jobs' ? 'ring-1 ring-cyan-200' : ''}`}
          >
            Jobs <SortIcon field="jobs" />
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="w-5 h-5 text-brand-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-gray-500 text-sm">{error}</p>
            <button onClick={load} className="btn-secondary text-xs">Retry</button>
          </div>
        ) : techs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Users className="w-8 h-8 text-gray-300" />
            <p className="text-gray-500 text-sm">
              {search ? 'No technicians match your search' : 'No technicians found. Upload data to get started.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {techs.map((tech, index) => (
              <Link
                key={tech.id}
                to={`/techs/${encodeURIComponent(tech.id)}`}
                className="group card-hover card-3d card-holo p-5 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarGradient(index)} flex items-center justify-center text-white font-black shadow-lg shrink-0 float-orb`}>
                      {getInitials(tech.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Technician Profile</p>
                      <h3 className="mt-1 text-lg font-extrabold text-slate-950 truncate">{tech.name}</h3>
                      <p className="text-xs text-slate-400 font-mono">{crewLabel(tech.id)} · ID: {tech.id}</p>
                    </div>
                  </div>
                  <ProductivityBadge score={tech.productivity_score} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-800/40 p-3 border border-slate-600/40">
                    <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold uppercase tracking-wide">
                      <Briefcase className="w-3.5 h-3.5" /> Jobs
                    </div>
                    <p className="mt-2 text-2xl font-black text-white">{tech.total_jobs.toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-800/40 p-3 border border-slate-600/40">
                    <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold uppercase tracking-wide">
                      <Calendar className="w-3.5 h-3.5" /> Active Days
                    </div>
                    <p className="mt-2 text-2xl font-black text-white">{tech.active_days}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wide"><TrendingUp className="w-3.5 h-3.5" /> Avg/Day</span>
                    <span className="font-bold text-slate-700">{tech.avg_jobs_per_day.toFixed(1)}</span>
                  </div>
                  <ProductivityBar score={tech.productivity_score} />
                </div>

                <div className="mt-auto flex items-center justify-between pt-1">
                  <div className="text-xs text-slate-400">Open full profile</div>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-cyan-700 transition-transform group-hover:translate-x-0.5">
                    View <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
