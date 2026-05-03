import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function generateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + 'T12:00:00');
  const endD = new Date(end + 'T12:00:00');
  while (cur <= endD) {
    dates.push(fmt(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function prevPeriod(start: string, end: string): { start: string; end: string } {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  const prevEnd = new Date(s.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
  return { start: fmt(prevStart), end: fmt(prevEnd) };
}

function getCoreStats(start: string, end: string) {
  const totalJobs = (db.prepare(
    'SELECT COUNT(*) as c FROM jobs WHERE job_date BETWEEN ? AND ?'
  ).get(start, end) as { c: number }).c;

  const totalTechs = (db.prepare(
    'SELECT COUNT(DISTINCT tech_id) as c FROM jobs WHERE job_date BETWEEN ? AND ?'
  ).get(start, end) as { c: number }).c;

  const activeDays = (db.prepare(
    'SELECT COUNT(DISTINCT job_date) as c FROM jobs WHERE job_date BETWEEN ? AND ?'
  ).get(start, end) as { c: number }).c;

  return { totalJobs, totalTechs, activeDays };
}

router.get('/', (req: Request, res: Response) => {
  const today = fmt(new Date());
  const period = (req.query.period as string) || 'weekly';

  let start = (req.query.start as string) || '';
  let end = (req.query.end as string) || '';

  if (!start || !end) {
    const now = new Date();
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    start = fmt(mon);
    end = fmt(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6));
  }

  const jobsPage = Math.max(1, parseInt((req.query.jobsPage as string) || '1', 10));
  const filterTech = (req.query.filterTech as string) || '';
  const jobSearch = ((req.query.jobSearch as string) || '').trim();
  const JOBS_PER_PAGE = 50;

  // ── Core stats ──────────────────────────────────────────────────────────────
  const { totalJobs, totalTechs, activeDays } = getCoreStats(start, end);
  const avgJobsPerTech = totalTechs > 0 ? Math.round((totalJobs / totalTechs) * 10) / 10 : 0;
  const avgJobsPerDay = activeDays > 0 ? Math.round((totalJobs / activeDays) * 10) / 10 : 0;

  const topPerformer = db.prepare(`
    SELECT t.name, j.tech_id, COUNT(*) as job_count
    FROM jobs j JOIN techs t ON j.tech_id = t.id
    WHERE j.job_date BETWEEN ? AND ?
    GROUP BY j.tech_id ORDER BY job_count DESC LIMIT 1
  `).get(start, end) as { name: string; tech_id: string; job_count: number } | undefined;

  const bottomPerformer = db.prepare(`
    SELECT t.name, j.tech_id, COUNT(*) as job_count
    FROM jobs j JOIN techs t ON j.tech_id = t.id
    WHERE j.job_date BETWEEN ? AND ?
    GROUP BY j.tech_id ORDER BY job_count ASC LIMIT 1
  `).get(start, end) as { name: string; tech_id: string; job_count: number } | undefined;

  const bestDay = db.prepare(`
    SELECT job_date as date, COUNT(*) as jobs
    FROM jobs WHERE job_date BETWEEN ? AND ?
    GROUP BY job_date ORDER BY jobs DESC LIMIT 1
  `).get(start, end) as { date: string; jobs: number } | undefined;

  // ── Comparison: previous equivalent period ──────────────────────────────────
  const prev = prevPeriod(start, end);
  const prevCore = getCoreStats(prev.start, prev.end);
  const prevAvgJobsPerTech = prevCore.totalTechs > 0
    ? Math.round((prevCore.totalJobs / prevCore.totalTechs) * 10) / 10 : 0;

  // ── Trend data (filled) ────────────────────────────────────────────────────
  const rawTrend = db.prepare(`
    SELECT job_date as date, COUNT(*) as jobs
    FROM jobs WHERE job_date BETWEEN ? AND ?
    GROUP BY job_date ORDER BY job_date
  `).all(start, end) as Array<{ date: string; jobs: number }>;

  const allDates = generateDates(start, end);
  const trendMap = new Map(rawTrend.map(r => [r.date, r.jobs]));
  const trendData = allDates.map(d => ({ date: d, jobs: trendMap.get(d) ?? 0 }));

  // ── Day headers strip ─────────────────────────────────────────────────────
  const dayHeaders = allDates.map(date => {
    const d = new Date(date + 'T12:00:00');
    return {
      date,
      dayName: DAY_NAMES[d.getDay()],
      dayNum: d.getDate(),
      monthName: MONTH_NAMES[d.getMonth()],
      fullLabel: `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`,
      jobs: trendMap.get(date) ?? 0,
      isToday: date === today,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    };
  });

  // ── Tech breakdown ─────────────────────────────────────────────────────────
  const rawTechs = db.prepare(`
    SELECT t.id, t.name, COUNT(*) as jobs, COUNT(DISTINCT j.job_date) as active_days
    FROM jobs j JOIN techs t ON j.tech_id = t.id
    WHERE j.job_date BETWEEN ? AND ?
    GROUP BY j.tech_id ORDER BY jobs DESC
  `).all(start, end) as Array<{ id: string; name: string; jobs: number; active_days: number }>;

  const teamAvg = totalTechs > 0 ? totalJobs / totalTechs : 0;
  const techBreakdown = rawTechs.map((t, i) => ({
    rank: i + 1,
    id: t.id,
    name: t.name,
    jobs: t.jobs,
    activeDays: t.active_days,
    avgPerDay: t.active_days > 0 ? Math.round((t.jobs / t.active_days) * 10) / 10 : 0,
    productivity: teamAvg > 0 ? Math.round((t.jobs / teamAvg) * 100) : 0,
  }));

  // ── Municipality / city breakdown ─────────────────────────────────────────
  const municipalities = db.prepare(`
    SELECT
      CASE
        WHEN INSTR(address, ',') > 0
          THEN TRIM(UPPER(SUBSTR(address, INSTR(address, ',') + 1)))
        ELSE 'Other'
      END as city,
      COUNT(*) as jobs
    FROM jobs
    WHERE job_date BETWEEN ? AND ?
    GROUP BY city
    ORDER BY jobs DESC
    LIMIT 12
  `).all(start, end) as Array<{ city: string; jobs: number }>;

  // ── Day of week distribution ───────────────────────────────────────────────
  const rawDow = db.prepare(`
    SELECT strftime('%w', job_date) as dow, COUNT(*) as jobs
    FROM jobs WHERE job_date BETWEEN ? AND ?
    GROUP BY dow ORDER BY dow
  `).all(start, end) as Array<{ dow: string; jobs: number }>;

  const dowDistribution = DAY_NAMES.map((label, i) => ({
    day: label,
    jobs: rawDow.find(d => parseInt(d.dow) === i)?.jobs ?? 0,
  }));

  // ── Hourly pattern (from date only, no time stored — skip) ─────────────────

  // ── Jobs list (paginated) ─────────────────────────────────────────────────
  const jobsFilters: string[] = ['j.job_date BETWEEN ? AND ?'];
  const jobsArgs: (string | number)[] = [start, end];

  if (filterTech) {
    jobsFilters.push('j.tech_id = ?');
    jobsArgs.push(filterTech);
  }

  if (jobSearch) {
    const search = `%${jobSearch}%`;
    jobsFilters.push('(j.address LIKE ? OR j.tech_id LIKE ? OR t.name LIKE ?)');
    jobsArgs.push(search, search, search);
  }

  const jobsWhere = `WHERE ${jobsFilters.join(' AND ')}`;

  const jobsList = db.prepare(`
    SELECT j.id, j.tech_id, t.name as tech_name, j.address, j.job_date as date
    FROM jobs j JOIN techs t ON j.tech_id = t.id
    ${jobsWhere}
    ORDER BY j.job_date DESC, t.name ASC
    LIMIT ${JOBS_PER_PAGE} OFFSET ${(jobsPage - 1) * JOBS_PER_PAGE}
  `).all(...jobsArgs) as Array<{
    id: number; tech_id: string; tech_name: string; address: string; date: string;
  }>;

  const jobsTotal = (db.prepare(`
    SELECT COUNT(*) as c FROM jobs j ${jobsWhere}
  `).get(...jobsArgs) as { c: number }).c;

  // ── Data range (for "no data" hint) ───────────────────────────────────────
  const dataRange = db.prepare(
    'SELECT MIN(job_date) as s, MAX(job_date) as e FROM jobs'
  ).get() as { s: string | null; e: string | null };

  // ── Recent uploads ─────────────────────────────────────────────────────────
  const recentUploads = db.prepare(
    'SELECT id, filename, uploaded_at, job_count, date_range_start, date_range_end FROM uploads ORDER BY uploaded_at DESC LIMIT 5'
  ).all();

  res.json({
    period,
    dateRange: { start, end },
    dataRange: dataRange.s ? { start: dataRange.s, end: dataRange.e } : null,
    stats: {
      totalJobs,
      totalTechs,
      avgJobsPerTech,
      avgJobsPerDay,
      activeDays,
      topPerformer: topPerformer ?? null,
      bottomPerformer: bottomPerformer ?? null,
      bestDay: bestDay ?? null,
    },
    comparison: {
      totalJobs: prevCore.totalJobs,
      totalTechs: prevCore.totalTechs,
      avgJobsPerTech: prevAvgJobsPerTech,
      period: prev,
    },
    trendData,
    dayHeaders,
    techBreakdown,
    municipalities,
    dowDistribution,
    jobs: {
      data: jobsList,
      total: jobsTotal,
      page: jobsPage,
      totalPages: Math.ceil(jobsTotal / JOBS_PER_PAGE) || 1,
    },
    recentUploads,
  });
});

export default router;
