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

export const customerSchema = z.object({
  name: z.string().min(2, 'Customer name must be at least 2 characters'),
  phone: z.string().min(6, 'Customer phone number is required'),
  address: z.string().optional()
});

export const saleItemSchema = z.object({
  type: z.enum(['egg', 'chicken']),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit: z.enum(['piece', 'tray', 'kg']).default('piece'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative')
});

export const saleSchema = z.object({
  batchId: z.string().optional(),
  itemType: z.enum(['egg', 'chicken']).optional(),
  quantity: z.number().positive().optional(),
  unitPrice: z.number().min(0).optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  items: z.array(saleItemSchema).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  amountPaid: z.number().min(0, 'Amount paid cannot be negative').default(0),
  note: z.string().optional(),
  notes: z.string().optional()
});

export const paymentSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  saleId: z.string().optional(),
  amount: z.number().positive('Payment amount must be greater than 0'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  method: z.enum(['cash', 'bkash', 'bank', 'other']).default('cash'),
  notes: z.string().optional()
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

export type RegisterFarmInput = z.infer<typeof registerFarmSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type DailyLogInput = z.infer<typeof dailyLogSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type HealthRecordInput = z.infer<typeof healthRecordSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
