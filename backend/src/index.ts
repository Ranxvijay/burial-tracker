import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import uploadRouter from './routes/upload';
import dashboardRouter from './routes/dashboard';
import techsRouter from './routes/techs';
import aiRouter from './routes/ai';
import exportRouter from './routes/export';
import { addClient, removeClient, broadcast } from './broadcaster';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? true // Allow all origins in production (Render will handle CORS)
    : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── SSE live events endpoint ──────────────────────────────────────────────────
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'connected', ts: Date.now() })}\n\n`);

  addClient(res);

  // Keep-alive ping every 25s (before proxy/browser timeouts)
  const ping = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'ping', ts: Date.now() })}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    removeClient(res);
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/upload', uploadRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/techs', techsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/export', exportRouter);

app.listen(PORT, () => {
  console.log(`Backend  → http://localhost:${PORT}`);
  console.log(`Groq AI  → ${process.env.GROQ_API_KEY ? 'configured ✓' : 'not configured (add GROQ_API_KEY to .env)'}`);
});

export { broadcast };
