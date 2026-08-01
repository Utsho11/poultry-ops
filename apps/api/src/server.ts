import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import authRoutes from './routes/auth';
import batchRoutes from './routes/batches';
import logRoutes from './routes/logs';
import expenseRoutes from './routes/expenses';
import salesRoutes from './routes/sales';
import healthRoutes from './routes/health';
import reportRoutes from './routes/reports';
import userRoutes from './routes/users';
import reminderRoutes from './routes/reminders';
import deviceTokenRoutes from './routes/deviceTokens';
import { startReminderDispatcher } from './jobs/reminderDispatcher';

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
app.use('/api/sales', salesRoutes);
app.use('/api/health-records', healthRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/team', userRoutes); // Alias for team management
app.use('/api/reminders', reminderRoutes);
app.use('/api/device-tokens', deviceTokenRoutes);

// Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled API Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start Server
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`PoultryOps API Server v1.1.0 running on port ${PORT} (0.0.0.0)`);
  connectDB();
  startReminderDispatcher();
});

export default app;
