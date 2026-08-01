import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import authRoutes from './routes/auth';
import batchRoutes from './routes/batches';
import logRoutes from './routes/logs';
import expenseRoutes from './routes/expenses';
import healthRoutes from './routes/health';
import reportRoutes from './routes/reports';
import userRoutes from './routes/users';
import reminderRoutes from './routes/reminders';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health-check', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'PoultryOps API v1.1.0', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/health-records', healthRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/team', userRoutes); // Alias for team management
app.use('/api/reminders', reminderRoutes);

// Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled API Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start Server
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`PoultryOps API Server v1.1.0 running on port ${PORT} (0.0.0.0)`);
  // #region agent log
  fetch('http://127.0.0.1:7898/ingest/8aab6805-612d-4a5e-86df-5176f3ce7ab6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2dce91'},body:JSON.stringify({sessionId:'2dce91',location:'server.ts:startup',message:'API started — reminder worker status',data:{hasReminderWorker:false,hasBullMQ:false,hasRedis:false},timestamp:Date.now(),runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  connectDB();
});

export default app;
