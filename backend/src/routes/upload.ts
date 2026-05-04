import { Router, Request, Response } from 'express';
import { broadcast } from '../broadcaster';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { parseExcelFile, ColumnMapping } from '../services/excel';
import db from '../db';

const router = Router();

const TEMP_DIR = path.join(__dirname, '../../../uploads/temp');
const PARSED_DIR = path.join(__dirname, '../../../uploads/parsed');
[TEMP_DIR, PARSED_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const storage = multer.diskStorage({
  destination: TEMP_DIR,
  filename: (_req: Request, file: Express.Multer.File, cb: (err: Error | null, filename?: string) => void) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Only Excel (.xlsx, .xls) and CSV files are supported'));
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

function sessionFilePath(sessionId: string, ext: string) {
  return path.join(TEMP_DIR, `${sessionId}${ext}`);
}

function parsedPath(sessionId: string) {
  return path.join(PARSED_DIR, `${sessionId}.json`);
}

function saveSession(sessionId: string, originalFilename: string, originalExt: string, result: ReturnType<typeof parseExcelFile>) {
  fs.writeFileSync(parsedPath(sessionId), JSON.stringify({
    originalFilename,
    originalExt,
    jobs: result.jobs,
    dateRange: result.dateRange,
  }));
}

// POST /api/upload/preview — upload file, auto-parse, return preview
router.post('/preview', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  const sessionId = uuidv4();
  const ext = path.extname(req.file.originalname).toLowerCase();
  const sessionFile = sessionFilePath(sessionId, ext);

  // Move uploaded file to session location (keep for potential remap)
  fs.renameSync(req.file.path, sessionFile);

  try {
    const result = parseExcelFile(sessionFile);
    saveSession(sessionId, req.file.originalname, ext, result);

    res.json({
      sessionId,
      columnMapping: result.columnMapping,
      detectedHeaders: result.detectedHeaders,
      totalRows: result.totalRows,
      validRows: result.validRows,
      dateRange: result.dateRange,
      preview: result.preview,
    });
  } catch (err) {
    // Clean up on error
    if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to parse file' });
  }
});

// POST /api/upload/remap — re-parse with custom column mapping
router.post('/remap', async (req: Request, res: Response): Promise<void> => {
  const { sessionId, mapping } = req.body as { sessionId: string; mapping: Partial<ColumnMapping> };
  if (!sessionId) { res.status(400).json({ error: 'Session ID required' }); return; }

  // Find the session file (we don't know the extension, scan for it)
  const files = fs.readdirSync(TEMP_DIR);
  const sessionFile = files.map(f => path.join(TEMP_DIR, f)).find(f => path.basename(f).startsWith(sessionId));

  if (!sessionFile) {
    res.status(404).json({ error: 'Session expired or not found. Please re-upload the file.' });
    return;
  }

  try {
    const result = parseExcelFile(sessionFile, mapping);

    // Read existing session to keep originalFilename
    let originalFilename = path.basename(sessionFile);
    const p = parsedPath(sessionId);
    if (fs.existsSync(p)) {
      const existing = JSON.parse(fs.readFileSync(p, 'utf-8')) as { originalFilename: string; originalExt: string };
      originalFilename = existing.originalFilename;
    }

    const ext = path.extname(sessionFile);
    saveSession(sessionId, originalFilename, ext, result);

    res.json({
      sessionId,
      columnMapping: result.columnMapping,
      detectedHeaders: result.detectedHeaders,
      totalRows: result.totalRows,
      validRows: result.validRows,
      dateRange: result.dateRange,
      preview: result.preview,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to re-parse file' });
  }
});

// POST /api/upload/confirm — import parsed data into database
router.post('/confirm', async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.body as { sessionId: string };
  if (!sessionId) { res.status(400).json({ error: 'Session ID required' }); return; }

  const p = parsedPath(sessionId);
  if (!fs.existsSync(p)) {
    res.status(404).json({ error: 'Session expired or not found. Please re-upload.' });
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as {
      originalFilename: string;
      originalExt: string;
      jobs: Array<{ techId: string; techName: string; address: string; date: string }>;
      dateRange: { start: string; end: string };
    };

    const importTx = db.transaction(() => {
      const uploadRow = db.prepare(`
        INSERT INTO uploads (filename, job_count, date_range_start, date_range_end)
        VALUES (?, ?, ?, ?)
      `).run(parsed.originalFilename, parsed.jobs.length, parsed.dateRange.start, parsed.dateRange.end);

      const uploadId = uploadRow.lastInsertRowid;

      const upsertTech = db.prepare(`
        INSERT INTO techs (id, name) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name
      `);
      const insertJob = db.prepare(`
        INSERT INTO jobs (tech_id, address, job_date, upload_id) VALUES (?, ?, ?, ?)
      `);

      let inserted = 0;
      for (const job of parsed.jobs) {
        upsertTech.run(job.techId, job.techName);
        insertJob.run(job.techId, job.address, job.date, uploadId);
        inserted++;
      }
      return { uploadId, inserted };
    });

    const result = importTx();

    // Clean up session files
    fs.unlinkSync(p);
    const files = fs.readdirSync(TEMP_DIR);
    files.filter(f => f.startsWith(sessionId)).forEach(f => {
      try { fs.unlinkSync(path.join(TEMP_DIR, f)); } catch { /* ignore */ }
    });

    // Broadcast to all live dashboard clients
    broadcast({ type: 'upload', jobsImported: result.inserted, ts: Date.now() });

    res.json({
      success: true,
      uploadId: result.uploadId,
      jobsImported: result.inserted,
      message: `Successfully imported ${result.inserted} jobs`,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Import failed' });
  }
});

// GET /api/upload/history
router.get('/history', (_req, res: Response) => {
  const uploads = db.prepare(`
    SELECT id, filename, uploaded_at, job_count, date_range_start, date_range_end
    FROM uploads ORDER BY uploaded_at DESC
  `).all();
  res.json(uploads);
});

// DELETE /api/upload/:id
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.transaction(() => {
    db.prepare('DELETE FROM jobs WHERE upload_id = ?').run(id);
    db.prepare('DELETE FROM uploads WHERE id = ?').run(id);
    db.prepare(`DELETE FROM techs WHERE id NOT IN (SELECT DISTINCT tech_id FROM jobs)`).run();
  })();
  res.json({ success: true });
});

export default router;
