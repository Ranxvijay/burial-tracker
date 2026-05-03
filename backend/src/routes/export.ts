import { Router, Request, Response } from 'express';
import db from '../db';
import XLSX from 'xlsx';

const router = Router();

function escCsv(v: string | number): string {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// GET /api/export/jobs?start=&end=&tech_id=&format=csv
router.get('/jobs', (req: Request, res: Response) => {
  const { start, end, tech_id } = req.query as Record<string, string>;

  if (!start || !end) {
    res.status(400).json({ error: 'start and end date required' });
    return;
  }

  const where = tech_id
    ? 'WHERE j.job_date BETWEEN ? AND ? AND j.tech_id = ?'
    : 'WHERE j.job_date BETWEEN ? AND ?';
  const args: string[] = tech_id ? [start, end, tech_id] : [start, end];

  const jobs = db.prepare(`
    SELECT j.job_date as date, j.tech_id, t.name as tech_name, j.address
    FROM jobs j JOIN techs t ON j.tech_id = t.id
    ${where}
    ORDER BY j.job_date DESC, t.name ASC
  `).all(...args) as Array<{ date: string; tech_id: string; tech_name: string; address: string }>;

  const rows = [
    ['Date', 'Tech ID', 'Technician', 'Address'].map(escCsv).join(','),
    ...jobs.map(j =>
      [j.date, j.tech_id, j.tech_name, j.address].map(escCsv).join(',')
    ),
  ];

  const filename = tech_id
    ? `jobs-${tech_id}-${start}-${end}.csv`
    : `jobs-${start}-${end}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + rows.join('\n')); // BOM for Excel compatibility
});

// GET /api/export/techs?start=&end=
router.get('/techs', (req: Request, res: Response) => {
  const { start, end } = req.query as Record<string, string>;

  if (!start || !end) {
    res.status(400).json({ error: 'start and end date required' });
    return;
  }

  const techs = db.prepare(`
    SELECT
      t.id as tech_id,
      t.name,
      COUNT(*) as total_jobs,
      COUNT(DISTINCT j.job_date) as active_days,
      ROUND(CAST(COUNT(*) AS FLOAT) / NULLIF(COUNT(DISTINCT j.job_date), 0), 1) as avg_per_day,
      MIN(j.job_date) as first_job,
      MAX(j.job_date) as last_job
    FROM jobs j JOIN techs t ON j.tech_id = t.id
    WHERE j.job_date BETWEEN ? AND ?
    GROUP BY j.tech_id
    ORDER BY total_jobs DESC
  `).all(start, end) as Array<{
    tech_id: string; name: string; total_jobs: number; active_days: number;
    avg_per_day: number; first_job: string; last_job: string;
  }>;

  const rows = [
    ['Tech ID', 'Name', 'Total Jobs', 'Active Days', 'Avg Per Day', 'First Job', 'Last Job'].map(escCsv).join(','),
    ...techs.map(t =>
      [t.tech_id, t.name, t.total_jobs, t.active_days, t.avg_per_day, t.first_job, t.last_job]
        .map(escCsv).join(',')
    ),
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="technicians-${start}-${end}.csv"`);
  res.send('﻿' + rows.join('\n'));
});

// GET /api/export/daily-summary?date=YYYY-MM-DD
router.get('/daily-summary', (req: Request, res: Response) => {
  const date = (req.query.date as string) || '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'date is required in YYYY-MM-DD format' });
    return;
  }

  const summary = db.prepare(`
    SELECT
      j.tech_id as techId,
      t.name as technician,
      COUNT(*) as jobsCompleted,
      COUNT(DISTINCT j.address) as uniqueAddresses
    FROM jobs j
    JOIN techs t ON j.tech_id = t.id
    WHERE j.job_date = ?
    GROUP BY j.tech_id
    ORDER BY jobsCompleted DESC, technician ASC
  `).all(date) as Array<{
    techId: string;
    technician: string;
    jobsCompleted: number;
    uniqueAddresses: number;
  }>;

  const jobs = db.prepare(`
    SELECT
      j.job_date as date,
      j.tech_id as techId,
      t.name as technician,
      j.address as address,
      COUNT(*) OVER (PARTITION BY j.tech_id) as techJobCount
    FROM jobs j
    JOIN techs t ON j.tech_id = t.id
    WHERE j.job_date = ?
    ORDER BY technician ASC, address ASC
  `).all(date) as Array<{
    date: string;
    techId: string;
    technician: string;
    address: string;
    techJobCount: number;
  }>;

  const totalJobs = jobs.length;
  const totalTechs = summary.length;
  const avgJobsPerTech = totalTechs > 0 ? Number((totalJobs / totalTechs).toFixed(2)) : 0;

  const workbook = XLSX.utils.book_new();

  const summaryRows = summary.map((row, index) => ({
    Rank: index + 1,
    'Tech ID': row.techId,
    Technician: row.technician,
    'Jobs Completed': row.jobsCompleted,
    'Unique Addresses': row.uniqueAddresses,
  }));

  const overviewRows = [
    { Metric: 'Date', Value: date },
    { Metric: 'Total Jobs', Value: totalJobs },
    { Metric: 'Active Technicians', Value: totalTechs },
    { Metric: 'Avg Jobs Per Tech', Value: avgJobsPerTech },
  ];

  const summarySheet = XLSX.utils.json_to_sheet(overviewRows, { skipHeader: false });
  XLSX.utils.sheet_add_json(summarySheet, summaryRows, { origin: 'A7', skipHeader: false });

  const jobsSheet = XLSX.utils.json_to_sheet(jobs.map(j => ({
    Date: j.date,
    'Tech ID': j.techId,
    Technician: j.technician,
    'Tech Jobs (Day)': j.techJobCount,
    Address: j.address,
  })));

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Daily Summary');
  XLSX.utils.book_append_sheet(workbook, jobsSheet, 'Jobs');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="daily-summary-${date}.xlsx"`);
  res.send(buffer);
});

export default router;
