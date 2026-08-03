import { Schema, model, Document } from 'mongoose';

// Farm Schema
export interface IFarmDoc extends Document {
  name: string;
  ownerId: Schema.Types.ObjectId;
  plan: 'free' | 'pro';
  timezone: string;
  createdAt: Date;
}

const farmSchema = new Schema<IFarmDoc>({
  name: { type: String, required: true, trim: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
  plan: { type: String, enum: ['free', 'pro'], default: 'free' },
  timezone: { type: String, default: 'Asia/Dhaka' },
  createdAt: { type: Date, default: Date.now }
});

export const FarmModel = model<IFarmDoc>('Farm', farmSchema);

// User Schema
export interface IUserDoc extends Document {
  farmId: Schema.Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: 'owner' | 'manager' | 'worker';
  fcmTokens: string[];
  isActive: boolean;
  createdAt: Date;
}

const userSchema = new Schema<IUserDoc>({
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['owner', 'manager', 'worker'], default: 'worker' },
  fcmTokens: [{ type: String }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

userSchema.index({ farmId: 1, email: 1 }, { unique: true });
export const UserModel = model<IUserDoc>('User', userSchema);

// Batch Schema
export interface IBatchDoc extends Document {
  farmId: Schema.Types.ObjectId;
  name: string;
  breed: string;
  type: 'layer' | 'broiler';
  startDate: Date;
  initialCount: number;
  currentCount: number;
  shed?: string;
  status: 'active' | 'closed';
  assignedWorkerIds: Schema.Types.ObjectId[];
  closedAt?: Date;
  createdAt: Date;
}

const batchSchema = new Schema<IBatchDoc>({
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
  name: { type: String, required: true, trim: true },
  breed: { type: String, required: true },
  type: { type: String, enum: ['layer', 'broiler'], required: true },
  startDate: { type: Date, required: true },
  initialCount: { type: Number, required: true, min: 1 },
  currentCount: { type: Number, required: true, min: 0 },
  shed: { type: String },
  status: { type: String, enum: ['active', 'closed'], default: 'active', index: true },
  assignedWorkerIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  closedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

batchSchema.index({ farmId: 1, status: 1 });
export const BatchModel = model<IBatchDoc>('Batch', batchSchema);

// DailyLog Schema
export interface IDailyLogDoc extends Document {
  farmId: Schema.Types.ObjectId;
  batchId: Schema.Types.ObjectId;
  date: string; // YYYY-MM-DD
  eggCount: number;
  brokenEggCount: number;
  deadCount: number;
  feedGivenKg: number;
  waterGivenLiters: number;
  medicineGiven?: { name: string; dose: string; unit: string }[];
  recordedBy: Schema.Types.ObjectId;
  notes?: string;
  createdAt: Date;
}

const dailyLogSchema = new Schema<IDailyLogDoc>({
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
  date: { type: String, required: true },
  eggCount: { type: Number, default: 0, min: 0 },
  brokenEggCount: { type: Number, default: 0, min: 0 },
  deadCount: { type: Number, default: 0, min: 0 },
  feedGivenKg: { type: Number, default: 0, min: 0 },
  waterGivenLiters: { type: Number, default: 0, min: 0 },
  medicineGiven: [{
    name: String,
    dose: String,
    unit: String
  }],
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

dailyLogSchema.index({ farmId: 1, batchId: 1, date: -1 }, { unique: true });
export const DailyLogModel = model<IDailyLogDoc>('DailyLog', dailyLogSchema);

// Expense Schema
export interface IExpenseDoc extends Document {
  farmId: Schema.Types.ObjectId;
  batchId?: Schema.Types.ObjectId;
  category: 'feed' | 'medicine' | 'labor' | 'utility' | 'equipment' | 'other';
  amount: number;
  currency: string;
  date: string;
  note?: string;
  receiptUrl?: string;
  recordedBy: Schema.Types.ObjectId;
  createdAt: Date;
}

const expenseSchema = new Schema<IExpenseDoc>({
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
  category: { type: String, enum: ['feed', 'medicine', 'labor', 'utility', 'equipment', 'other'], required: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'BDT' },
  date: { type: String, required: true },
  note: { type: String },
  receiptUrl: { type: String },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

expenseSchema.index({ farmId: 1, date: -1 });
export const ExpenseModel = model<IExpenseDoc>('Expense', expenseSchema);

// Sale Schema (Income & Sales Tracking for Eggs & Chickens)
export interface ISaleDoc extends Document {
  farmId: Schema.Types.ObjectId;
  batchId?: Schema.Types.ObjectId;
  itemType: 'egg' | 'chicken';
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  date: string;
  customerName?: string;
  note?: string;
  recordedBy: Schema.Types.ObjectId;
  createdAt: Date;
}

const saleSchema = new Schema<ISaleDoc>({
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
  itemType: { type: String, enum: ['egg', 'chicken'], required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  date: { type: String, required: true },
  customerName: { type: String },
  note: { type: String },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

saleSchema.index({ farmId: 1, date: -1 });
export const SaleModel = model<ISaleDoc>('Sale', saleSchema);

// HealthRecord Schema
export interface IHealthRecordDoc extends Document {
  farmId: Schema.Types.ObjectId;
  batchId: Schema.Types.ObjectId;
  date: string;
  type: 'checkup' | 'vaccination' | 'injection' | 'treatment';
  description: string;
  medicineUsed?: string;
  performedBy: string;
  cost?: number;
  attachmentUrls?: string[];
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
}

const healthRecordSchema = new Schema<IHealthRecordDoc>({
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
  date: { type: String, required: true },
  type: { type: String, enum: ['checkup', 'vaccination', 'injection', 'treatment'], required: true },
  description: { type: String, required: true },
  medicineUsed: { type: String },
  performedBy: { type: String, required: true },
  cost: { type: Number, default: 0 },
  attachmentUrls: [{ type: String }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

healthRecordSchema.index({ farmId: 1, batchId: 1, date: -1 });
export const HealthRecordModel = model<IHealthRecordDoc>('HealthRecord', healthRecordSchema);
