import { z } from 'zod';

export const registerFarmSchema = z.object({
  farmName: z.string().min(2, 'Farm name must be at least 2 characters'),
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  timezone: z.string().default('Asia/Dhaka')
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const createBatchSchema = z.object({
  name: z.string().min(2, 'Batch name must be at least 2 characters'),
  breed: z.string().min(1, 'Breed is required'),
  type: z.enum(['layer', 'broiler']),
  startDate: z.string().or(z.date()),
  initialCount: z.number().int().positive('Initial count must be greater than 0'),
  shed: z.string().optional()
});

export const dailyLogSchema = z.object({
  batchId: z.string().min(1, 'Batch ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  eggCount: z.number().min(0, 'Egg count cannot be negative').default(0),
  brokenEggCount: z.number().min(0, 'Broken egg count cannot be negative').default(0),
  deadCount: z.number().min(0, 'Dead bird count cannot be negative').default(0),
  feedGivenKg: z.number().min(0, 'Feed amount cannot be negative').default(0),
  waterGivenLiters: z.number().min(0, 'Water amount cannot be negative').default(0),
  medicineGiven: z.array(z.object({
    name: z.string(),
    dose: z.string(),
    unit: z.string()
  })).optional(),
  notes: z.string().optional()
});

export const expenseSchema = z.object({
  batchId: z.string().optional(),
  category: z.enum(['feed', 'medicine', 'labor', 'utility', 'equipment', 'other']),
  amount: z.number().positive('Expense amount must be positive'),
  currency: z.string().default('BDT'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  note: z.string().optional(),
  receiptUrl: z.string().optional()
});

export const healthRecordSchema = z.object({
  batchId: z.string().min(1, 'Batch ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  type: z.enum(['checkup', 'vaccination', 'injection', 'treatment']),
  description: z.string().min(2, 'Description is required'),
  medicineUsed: z.string().optional(),
  performedBy: z.string().min(1, 'Performed by name is required'),
  cost: z.number().min(0).optional(),
  attachmentUrls: z.array(z.string()).optional()
});

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['manager', 'worker']),
  phone: z.string().optional()
});

export const reminderSchema = z.object({
  batchId: z.string().optional(),
  type: z.enum(['feed', 'water', 'medicine', 'vaccination', 'checkup', 'general', 'custom']).default('feed'),
  message: z.string().min(2, 'Message is required'),
  dueDate: z.string().optional(),
  dueTime: z.string().optional(),
  repeat: z.enum(['none', 'daily', 'weekly']).default('none'),
  cronExpression: z.string().optional(),
  assignedTo: z.array(z.string()).default([]),
  channel: z.array(z.enum(['push', 'sms'])).default(['push'])
});

export type RegisterFarmInput = z.infer<typeof registerFarmSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type DailyLogInput = z.infer<typeof dailyLogSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type HealthRecordInput = z.infer<typeof healthRecordSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ReminderInput = z.infer<typeof reminderSchema>;
