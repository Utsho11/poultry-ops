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
  category: 'medicine' | 'labor' | 'utility' | 'equipment' | 'other';
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
  category: { type: String, enum: ['medicine', 'labor', 'utility', 'equipment', 'other'], required: true },
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

// Feed Stock Schema
export type FeedCategoryType =
  | 'layer_starter'
  | 'layer_grower'
  | 'layer_layer_1'
  | 'broiler_starter'
  | 'broiler_grower'
  | 'broiler_finisher';

export interface IFeedStockDoc extends Document {
  farmId: Schema.Types.ObjectId;
  category: FeedCategoryType;
  bagPrice: number;
  bags: number;
  totalKg: number;
  totalCost: number;
  date: string;
  note?: string;
  recordedBy: Schema.Types.ObjectId;
  createdAt: Date;
}

const feedStockSchema = new Schema<IFeedStockDoc>({
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
  category: {
    type: String,
    enum: [
      'layer_starter',
      'layer_grower',
      'layer_layer_1',
      'broiler_starter',
      'broiler_grower',
      'broiler_finisher'
    ],
    required: true
  },
  bagPrice: { type: Number, required: true, min: 0 },
  bags: { type: Number, required: true, min: 0 },
  totalKg: { type: Number, required: true, min: 0 },
  totalCost: { type: Number, required: true, min: 0 },
  date: { type: String, required: true },
  note: { type: String },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

feedStockSchema.index({ farmId: 1, date: -1 });
export const FeedStockModel = model<IFeedStockDoc>('FeedStock', feedStockSchema);

// Customer Schema
export interface ICustomerDoc extends Document {
  farmId: Schema.Types.ObjectId;
  name: string;
  phone: string;
  address?: string;
  totalDue: number;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomerDoc>({
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  address: { type: String, trim: true },
  totalDue: { type: Number, default: 0 }
}, { timestamps: true });

customerSchema.index({ farmId: 1, phone: 1 }, { unique: true });
export const CustomerModel = model<ICustomerDoc>('Customer', customerSchema);

// Sale Line Item Schema
export interface ISaleItemDoc {
  type: 'egg' | 'chicken';
  quantity: number;
  crates?: number;
  looseEggs?: number;
  birdCount?: number;
  weightKg?: number;
  unit: 'piece' | 'tray' | 'kg' | 'bird';
  unitPrice: number;
  subtotal: number;
}

const saleItemSchema = new Schema<ISaleItemDoc>({
  type: { type: String, enum: ['egg', 'chicken'], required: true },
  quantity: { type: Number, required: true, min: 0 },
  crates: { type: Number, min: 0 },
  looseEggs: { type: Number, min: 0 },
  birdCount: { type: Number, min: 0 },
  weightKg: { type: Number, min: 0 },
  unit: { type: String, enum: ['piece', 'tray', 'kg', 'bird'], default: 'piece' },
  unitPrice: { type: Number, required: true, min: 0 },
  subtotal: { type: Number, required: true, min: 0 }
}, { _id: false });

// Sale Schema (Multi-item line support, dues, payment tracking)
export interface ISaleDoc extends Document {
  farmId: Schema.Types.ObjectId;
  batchId?: Schema.Types.ObjectId;
  customerId?: Schema.Types.ObjectId;
  customerName?: string;
  customerPhone?: string;
  itemType?: 'egg' | 'chicken';
  quantity?: number;
  unitPrice?: number;
  items: ISaleItemDoc[];
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  status: 'paid' | 'partial' | 'due';
  date: string;
  notes?: string;
  recordedBy: Schema.Types.ObjectId;
  createdAt: Date;
}

const saleSchema = new Schema<ISaleDoc>({
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  customerName: { type: String },
  customerPhone: { type: String },
  itemType: { type: String, enum: ['egg', 'chicken'] },
  quantity: { type: Number },
  unitPrice: { type: Number },
  items: [saleItemSchema],
  totalAmount: { type: Number, required: true, min: 0 },
  amountPaid: { type: Number, default: 0, min: 0 },
  amountDue: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['paid', 'partial', 'due'], default: 'paid' },
  date: { type: String, required: true },
  notes: { type: String },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

saleSchema.index({ farmId: 1, date: -1 });
saleSchema.index({ farmId: 1, customerId: 1, date: -1 });
export const SaleModel = model<ISaleDoc>('Sale', saleSchema);

// Payment Ledger Schema (Due Settlements)
export interface IPaymentDoc extends Document {
  farmId: Schema.Types.ObjectId;
  customerId: Schema.Types.ObjectId;
  customerName?: string;
  customerPhone?: string;
  saleId?: Schema.Types.ObjectId;
  amount: number;
  date: string;
  method: 'cash' | 'bkash' | 'bank' | 'other';
  notes?: string;
  recordedBy: Schema.Types.ObjectId;
  createdAt: Date;
}

const paymentSchema = new Schema<IPaymentDoc>({
  farmId: { type: Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  customerName: { type: String },
  customerPhone: { type: String },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale' },
  amount: { type: Number, required: true, min: 0.01 },
  date: { type: String, required: true },
  method: { type: String, enum: ['cash', 'bkash', 'bank', 'other'], default: 'cash' },
  notes: { type: String },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

paymentSchema.index({ farmId: 1, customerId: 1, date: -1 });
export const PaymentModel = model<IPaymentDoc>('Payment', paymentSchema);

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
