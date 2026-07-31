export type UserRole = 'owner' | 'manager' | 'worker';
export type BatchType = 'layer' | 'broiler';
export type BatchStatus = 'active' | 'closed';
export type ExpenseCategory = 'feed' | 'medicine' | 'labor' | 'utility' | 'equipment' | 'other';
export type HealthRecordType = 'checkup' | 'vaccination' | 'injection' | 'treatment';
export type ReminderType = 'feed' | 'water' | 'medicine' | 'custom';
export type SubscriptionPlan = 'free' | 'pro';

export interface IFarm {
  _id: string;
  name: string;
  ownerId: string;
  plan: SubscriptionPlan;
  timezone: string;
  createdAt: string | Date;
}

export interface IUser {
  _id: string;
  farmId: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  fcmTokens?: string[];
  isActive: boolean;
  createdAt: string | Date;
}

export interface IBatch {
  _id: string;
  farmId: string;
  name: string;
  breed: string;
  type: BatchType;
  startDate: string | Date;
  initialCount: number;
  currentCount: number;
  shed?: string;
  status: BatchStatus;
  assignedWorkerIds?: string[];
  closedAt?: string | Date;
  createdAt?: string | Date;
}

export interface IMedicineDose {
  name: string;
  dose: string;
  unit: string;
}

export interface IDailyLog {
  _id: string;
  farmId: string;
  batchId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  eggCount: number;
  brokenEggCount: number;
  deadCount: number;
  feedGivenKg: number;
  waterGivenLiters: number;
  medicineGiven?: IMedicineDose[];
  recordedBy: string; // userId or user details
  recordedByName?: string;
  notes?: string;
  createdAt?: string | Date;
}

export interface IHealthRecord {
  _id: string;
  farmId: string;
  batchId: string;
  date: string;
  type: HealthRecordType;
  description: string;
  medicineUsed?: string;
  performedBy: string;
  cost?: number;
  attachmentUrls?: string[];
  createdBy: string;
  createdAt?: string | Date;
}

export interface IExpense {
  _id: string;
  farmId: string;
  batchId?: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  date: string;
  note?: string;
  receiptUrl?: string;
  recordedBy: string;
  createdAt?: string | Date;
}

export interface IReminder {
  _id: string;
  farmId: string;
  batchId?: string;
  type: ReminderType;
  message: string;
  cronExpression: string;
  assignedTo: string[];
  channel: ('push' | 'sms')[];
  active: boolean;
  createdBy: string;
  createdAt?: string | Date;
}

export interface IReportMetrics {
  totalEggs: number;
  totalBrokenEggs: number;
  totalDead: number;
  mortalityRate: number; // percentage (e.g. 2.5)
  totalFeedKg: number;
  totalWaterLiters: number;
  totalCost: number;
  costByCategory: Record<ExpenseCategory, number>;
  costPerEgg: number;
  costPerBird: number;
  feedConversionRatio?: number; // FCR (Feed kg per egg or bird weight)
}

export interface IAuthUser {
  userId: string;
  farmId: string;
  name: string;
  email: string;
  role: UserRole;
  farmName: string;
}

export interface IAuthResponse {
  user: IAuthUser;
  accessToken: string;
  refreshToken?: string;
}
