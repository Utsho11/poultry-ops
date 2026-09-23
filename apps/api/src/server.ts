import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import authRoutes from './routes/auth';
import batchRoutes from './routes/batches';
import logRoutes from './routes/logs';
import expenseRoutes from './routes/expenses';
import salesRoutes from './routes/sales';
import customerRoutes from './routes/customers';
import paymentRoutes from './routes/payments';
import healthRoutes from './routes/health';
import reportRoutes from './routes/reports';
import userRoutes from './routes/users';
import feedStockRoutes from './routes/feedStock';
import reminderRoutes from './routes/reminders';

import farmRoutes from './routes/farms';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// CORS Configuration
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : [
      'https://poultrydex.vercel.app',
      'http://localhost:3000',
      'http://localhost:8081',
      'http://localhost:19006',
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (e.g. mobile apps, curl, server-to-server) where origin is undefined
      // Also allow all origins in non-production environments
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// Database connection middleware (ensures active connection for both local & Vercel serverless)
app.use(async (req: Request, res: Response, next: any) => {
  try {
    await connectDB();
    next();
  } catch (err: any) {
    console.error('Database connection middleware error:', err);
    res.status(503).json({ error: 'Database service unavailable. Please verify MONGODB_URI in environment variables.' });
  }
});

// Health Check & Root
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to PoultryDex API',
    status: 'online',
    version: '1.1.0',
    healthCheck: '/api/health-check'
  });
});

app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'PoultryDex API Root',
    status: 'online',
    version: '1.1.0',
    healthCheck: '/api/health-check'
  });
});

app.get('/api/health-check', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'PoultryDex API v1.1.0', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/farms', farmRoutes);
app.use('/api/firms', farmRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/health-records', healthRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/team', userRoutes); // Alias for team management
app.use('/api/feed-stock', feedStockRoutes);
app.use('/api/reminders', reminderRoutes);

// Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled API Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start Server (Listen when not running in Vercel serverless container)
if (!process.env.VERCEL) {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`PoultryDex API Server v1.1.0 running on port ${PORT} (0.0.0.0)`);
    connectDB().catch(err => console.error('Initial DB connect error:', err));
  });
}

export default app;
