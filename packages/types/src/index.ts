export type UserRole = 'owner' | 'manager' | 'worker';
export type BatchType = 'layer' | 'broiler';
export type BatchStatus = 'active' | 'closed';
export type FeedCategory =
  | 'layer_starter'
  | 'layer_grower'
  | 'layer_layer_1'
  | 'broiler_starter'
  | 'broiler_grower'
  | 'broiler_finisher';

export type ExpenseCategory = 'feed' | 'medicine' | 'labor' | 'utility' | 'equipment' | 'other';
export type HealthRecordType = 'checkup' | 'vaccination' | 'injection' | 'treatment';
export type SubscriptionPlan = 'free' | 'pro';
export type SaleItemType = 'egg' | 'chicken';

export type AnimalType = 'poultry' | 'layer' | 'broiler';

export interface IFarm {
  _id: string;
  name: string;
  animalType: AnimalType;
  date?: string | Date;
  location?: string;
  ownerId: string;
  plan: SubscriptionPlan;
  timezone: string;
  createdAt: string | Date;
}

export interface IUser {
  _id: string;
  farmId?: string;
  activeFarmId?: string;
  name: string;
  email?: string;
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
  type?: BatchType;
  startDate: string | Date;
  initialCount: number;
  currentCount: number;
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
  workerId?: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  date: string;
  note?: string;
  receiptUrl?: string;
  feedBags?: number;
  feedKg?: number;
  recordedBy: string;
  createdAt?: string | Date;
}

export interface IFeedStock {
  _id: string;
  farmId: string;
  category: FeedCategory;
  bagPrice: number;
  bags: number;
  totalKg: number;
  totalCost: number;
  date: string;
  note?: string;
  recordedBy: string;
  createdAt?: string | Date;
}

export interface ICustomer {
  _id: string;
  farmId: string;
  name: string;
  phone: string;
  address?: string;
  totalDue: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type SaleItemUnit = 'piece' | 'tray' | 'kg' | 'bird';

export interface ISaleItem {
  type: SaleItemType;
  quantity: number;        // total egg count (piece) OR bird count
  crates?: number;         // number of egg crates (30 eggs/crate)
  looseEggs?: number;      // loose eggs
  birdCount?: number;      // bird count when selling poultry
  weightKg?: number;       // total weight in kg when selling poultry
  unit: SaleItemUnit;
  unitPrice: number;
  subtotal: number;
}

export type SaleStatus = 'paid' | 'partial' | 'due';

export interface ISale {
  _id: string;
  farmId: string;
  batchId?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  date: string;
  itemType?: SaleItemType; // Legacy support
  quantity?: number;       // Legacy support
  unitPrice?: number;      // Legacy support
  items: ISaleItem[];
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  status: SaleStatus;
  notes?: string;
  recordedBy: string;
  createdAt?: string | Date;
}

export type PaymentMethod = 'cash' | 'bkash' | 'bank' | 'other';

export interface IPayment {
  _id: string;
  farmId: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  saleId?: string;
  amount: number;
  date: string;
  method?: PaymentMethod;
  notes?: string;
  recordedBy: string;
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
  // Income & Egg Inventory metrics
  allTimeEggCount: number;
  currentEggCount: number;
  totalIncome: number;
  totalEggsSold: number;
  totalChickensSold: number;
  // Laying & Feed Performance Metrics per Chicken
  eggLayingRate: number;              // Percentage of laid eggs per chicken (e.g. 85.5%)
  feedPerChickenGrams: number;        // Feed consumed in grams per chicken per day (e.g. 115g)
  feedPerChickenPercentage: number;   // Percentage of daily feed intake relative to standard 110g target (e.g. 104.5%)
}

export interface IAuthUser {
  userId: string;
  farmId?: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  farmName?: string;
  animalType?: AnimalType;
}

export interface IAuthResponse {
  user: IAuthUser;
  accessToken: string;
  refreshToken?: string;
}
