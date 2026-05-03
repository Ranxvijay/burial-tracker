import { Router, Request, Response } from 'express';
import db from '../db';
import { analyzeTeamPerformanceSafe, answerQuerySafe, TechStats } from '../services/groq';

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

// POST /api/ai/analyze
router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  if (!process.env.GROQ_API_KEY) {
    res.status(400).json({ error: 'Groq API key not configured. Add GROQ_API_KEY to backend/.env' });
    return;
  }

  const period = (req.body.period as string) || 'monthly';
  const { start, end } = getDateRange(period, req.body.start as string, req.body.end as string);

  try {
    const totalJobs = (db.prepare(`
      SELECT COUNT(*) as count FROM jobs WHERE job_date BETWEEN ? AND ?
    `).get(start, end) as { count: number }).count;

    const totalTechs = (db.prepare(`
      SELECT COUNT(DISTINCT tech_id) as count FROM jobs WHERE job_date BETWEEN ? AND ?
    `).get(start, end) as { count: number }).count;

    if (totalJobs === 0) {
      res.status(400).json({ error: 'No job data found for the selected period. Please upload data first.' });
      return;
    }

    // Get per-tech stats with trend calculation
    const techRows = db.prepare(`
      SELECT
        j.tech_id,
        t.name,
        COUNT(*) as total_jobs,
        COUNT(DISTINCT j.job_date) as active_days
      FROM jobs j JOIN techs t ON j.tech_id = t.id
      WHERE j.job_date BETWEEN ? AND ?
      GROUP BY j.tech_id
      ORDER BY total_jobs DESC
    `).all(start, end) as Array<{
      tech_id: string;
      name: string;
      total_jobs: number;
      active_days: number;
    }>;

    // Calculate trend for each tech (compare first half vs second half of period)
    const midDate = new Date((new Date(start).getTime() + new Date(end).getTime()) / 2);
    const midStr = midDate.toISOString().split('T')[0];

    const techs: TechStats[] = techRows.map(row => {
      const firstHalf = (db.prepare(`
        SELECT COUNT(*) as c FROM jobs WHERE tech_id = ? AND job_date BETWEEN ? AND ?
      `).get(row.tech_id, start, midStr) as { c: number }).c;

      const secondHalf = (db.prepare(`
        SELECT COUNT(*) as c FROM jobs WHERE tech_id = ? AND job_date BETWEEN ? AND ?
      `).get(row.tech_id, midStr, end) as { c: number }).c;

      const trend: 'up' | 'down' | 'stable' =
        secondHalf > firstHalf * 1.1 ? 'up' :
        secondHalf < firstHalf * 0.9 ? 'down' : 'stable';

      return {
        techId: row.tech_id,
        name: row.name,
        totalJobs: row.total_jobs,
        avgJobsPerDay: row.active_days > 0 ? row.total_jobs / row.active_days : 0,
        activeDays: row.active_days,
        trend,
      };
    });

    const avgJobsPerTech = totalTechs > 0 ? totalJobs / totalTechs : 0;

    const result = await analyzeTeamPerformanceSafe({
      period: `${start} to ${end}`,
      totalJobs,
      totalTechs,
      avgJobsPerTech,
      techs,
      topPerformer: techs[0] || null,
      bottomPerformer: techs[techs.length - 1] || null,
    });

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI analysis failed';
    if (message.includes('API key')) {
      res.status(401).json({ error: 'Invalid Groq API key. Get a free key at console.groq.com' });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

// POST /api/ai/query
router.post('/query', async (req: Request, res: Response): Promise<void> => {
  if (!process.env.GROQ_API_KEY) {
    res.status(400).json({ error: 'Groq API key not configured' });
    return;
  }

  const { question, period } = req.body as { question: string; period?: string };
  if (!question?.trim()) {
    res.status(400).json({ error: 'Question is required' });
    return;
  }

  const { start, end } = getDateRange(period || 'monthly');

  try {
    const stats = db.prepare(`
      SELECT COUNT(*) as total_jobs, COUNT(DISTINCT tech_id) as total_techs
      FROM jobs WHERE job_date BETWEEN ? AND ?
    `).get(start, end) as { total_jobs: number; total_techs: number };

    const techStats = db.prepare(`
      SELECT t.name, j.tech_id, COUNT(*) as jobs, COUNT(DISTINCT j.job_date) as days
      FROM jobs j JOIN techs t ON j.tech_id = t.id
      WHERE j.job_date BETWEEN ? AND ?
      GROUP BY j.tech_id ORDER BY jobs DESC
    `).all(start, end) as Array<{ name: string; tech_id: string; jobs: number; days: number }>;

    const context = `
Period: ${start} to ${end}
Total Jobs: ${stats.total_jobs}
Total Active Technicians: ${stats.total_techs}
Average Jobs per Tech: ${stats.total_techs > 0 ? (stats.total_jobs / stats.total_techs).toFixed(1) : 0}

Technician Performance:
${techStats.map(t => `- ${t.name} (${t.tech_id}): ${t.jobs} jobs over ${t.days} active days (${t.days > 0 ? (t.jobs / t.days).toFixed(1) : 0} avg/day)`).join('\n')}
    `.trim();

    const answer = await answerQuerySafe(question, context);
    res.json({ answer });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query failed';
    res.status(500).json({ error: message });
  }
});

export default router;
