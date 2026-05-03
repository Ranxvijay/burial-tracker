import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

function getDateRange(period: string, start?: string, end?: string): { start: string; end: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  if (start && end) return { start, end };
  if (period === 'daily') return { start: fmt(today), end: fmt(today) };
  if (period === 'weekly') {
    const day = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return { start: fmt(mon), end: fmt(today) };
  }
  if (period === 'monthly') {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: fmt(monthStart), end: fmt(today) };
  }
  return { start: '2000-01-01', end: fmt(today) };
}

// GET /api/techs?period=&start=&end=&sort=jobs|name&order=asc|desc&search=
router.get('/', (req: Request, res: Response) => {
  const period = (req.query.period as string) || 'monthly';
  const { start, end } = getDateRange(period, req.query.start as string, req.query.end as string);
  const sort = (req.query.sort as string) || 'jobs';
  const order = (req.query.order as string) === 'asc' ? 'ASC' : 'DESC';
  const search = (req.query.search as string) || '';

  const techs = db.prepare(`
    SELECT
      t.id,
      t.name,
      COUNT(j.id) as total_jobs,
      COUNT(DISTINCT j.job_date) as active_days,
      MIN(j.job_date) as first_job,
      MAX(j.job_date) as last_job
    FROM techs t
    LEFT JOIN jobs j ON t.id = j.tech_id AND j.job_date BETWEEN ? AND ?
    WHERE (? = '' OR t.name LIKE ? OR t.id LIKE ?)
    GROUP BY t.id
    ORDER BY ${sort === 'name' ? 't.name' : 'total_jobs'} ${order}
  `).all(start, end, search, `%${search}%`, `%${search}%`) as Array<{
    id: string;
    name: string;
    total_jobs: number;
    active_days: number;
    first_job: string;
    last_job: string;
  }>;

  // Calculate average for productivity scoring
  const activeTechs = techs.filter(t => t.total_jobs > 0);
  const avg = activeTechs.length > 0
    ? activeTechs.reduce((sum, t) => sum + t.total_jobs, 0) / activeTechs.length
    : 0;

  const result = techs.map(t => ({
    ...t,
    avg_jobs_per_day: t.active_days > 0 ? Math.round((t.total_jobs / t.active_days) * 10) / 10 : 0,
    productivity_score: avg > 0 ? Math.round((t.total_jobs / avg) * 100) : 0,
  }));

  res.json({ techs: result, teamAvg: Math.round(avg * 10) / 10, dateRange: { start, end } });
});

// GET /api/techs/:id?period=&start=&end=
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const period = (req.query.period as string) || 'monthly';
  const { start, end } = getDateRange(period, req.query.start as string, req.query.end as string);

  const tech = db.prepare('SELECT * FROM techs WHERE id = ?').get(id) as {
    id: string; name: string; created_at: string;
  } | undefined;

  if (!tech) {
    res.status(404).json({ error: 'Technician not found' });
    return;
  }

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_jobs,
      COUNT(DISTINCT job_date) as active_days,
      MIN(job_date) as first_job,
      MAX(job_date) as last_job
    FROM jobs WHERE tech_id = ? AND job_date BETWEEN ? AND ?
  `).get(id, start, end) as {
    total_jobs: number;
    active_days: number;
    first_job: string;
    last_job: string;
  };

  // Daily breakdown for chart
  const dailyJobs = db.prepare(`
    SELECT job_date as date, COUNT(*) as jobs
    FROM jobs WHERE tech_id = ? AND job_date BETWEEN ? AND ?
    GROUP BY job_date ORDER BY job_date
  `).all(id, start, end) as Array<{ date: string; jobs: number }>;

  // Recent jobs list (paginated)
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  const jobs = db.prepare(`
    SELECT id, address, job_date as date, upload_id
    FROM jobs WHERE tech_id = ? AND job_date BETWEEN ? AND ?
    ORDER BY job_date DESC LIMIT ? OFFSET ?
  `).all(id, start, end, limit, offset) as Array<{
    id: number; address: string; date: string; upload_id: number;
  }>;

  const jobCount = (db.prepare(`
    SELECT COUNT(*) as count FROM jobs WHERE tech_id = ? AND job_date BETWEEN ? AND ?
  `).get(id, start, end) as { count: number }).count;

  // Team average for comparison
  const teamAvg = db.prepare(`
    SELECT AVG(job_count) as avg FROM (
      SELECT COUNT(*) as job_count FROM jobs
      WHERE job_date BETWEEN ? AND ?
      GROUP BY tech_id
    )
  `).get(start, end) as { avg: number | null };

  // Weekly summary
  const weeklySummary = db.prepare(`
    SELECT
      strftime('%Y-W%W', job_date) as week,
      COUNT(*) as jobs
    FROM jobs WHERE tech_id = ? AND job_date BETWEEN ? AND ?
    GROUP BY week ORDER BY week
  `).all(id, start, end) as Array<{ week: string; jobs: number }>;

  res.json({
    tech,
    stats: {
      ...stats,
      avg_jobs_per_day: stats.active_days > 0
        ? Math.round((stats.total_jobs / stats.active_days) * 10) / 10
        : 0,
      team_avg: Math.round((teamAvg.avg || 0) * 10) / 10,
      productivity_score: teamAvg.avg
        ? Math.round((stats.total_jobs / teamAvg.avg) * 100)
        : 0,
    },
    dailyJobs,
    weeklySummary,
    jobs,
    pagination: {
      page,
      limit,
      total: jobCount,
      totalPages: Math.ceil(jobCount / limit),
    },
    dateRange: { start, end },
  });
});

export default router;
