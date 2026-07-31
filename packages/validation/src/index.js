"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reminderSchema = exports.createUserSchema = exports.healthRecordSchema = exports.expenseSchema = exports.dailyLogSchema = exports.createBatchSchema = exports.loginSchema = exports.registerFarmSchema = void 0;
const zod_1 = require("zod");
exports.registerFarmSchema = zod_1.z.object({
    farmName: zod_1.z.string().min(2, 'Farm name must be at least 2 characters'),
    ownerName: zod_1.z.string().min(2, 'Owner name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    phone: zod_1.z.string().optional(),
    timezone: zod_1.z.string().default('Asia/Dhaka')
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required')
});
exports.createBatchSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Batch name must be at least 2 characters'),
    breed: zod_1.z.string().min(1, 'Breed is required'),
    type: zod_1.z.enum(['layer', 'broiler']),
    startDate: zod_1.z.string().or(zod_1.z.date()),
    initialCount: zod_1.z.number().int().positive('Initial count must be greater than 0'),
    shed: zod_1.z.string().optional()
});
exports.dailyLogSchema = zod_1.z.object({
    batchId: zod_1.z.string().min(1, 'Batch ID is required'),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
    eggCount: zod_1.z.number().min(0, 'Egg count cannot be negative').default(0),
    brokenEggCount: zod_1.z.number().min(0, 'Broken egg count cannot be negative').default(0),
    deadCount: zod_1.z.number().min(0, 'Dead bird count cannot be negative').default(0),
    feedGivenKg: zod_1.z.number().min(0, 'Feed amount cannot be negative').default(0),
    waterGivenLiters: zod_1.z.number().min(0, 'Water amount cannot be negative').default(0),
    medicineGiven: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        dose: zod_1.z.string(),
        unit: zod_1.z.string()
    })).optional(),
    notes: zod_1.z.string().optional()
});
exports.expenseSchema = zod_1.z.object({
    batchId: zod_1.z.string().optional(),
    category: zod_1.z.enum(['feed', 'medicine', 'labor', 'utility', 'equipment', 'other']),
    amount: zod_1.z.number().positive('Expense amount must be positive'),
    currency: zod_1.z.string().default('BDT'),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    note: zod_1.z.string().optional(),
    receiptUrl: zod_1.z.string().optional()
});
exports.healthRecordSchema = zod_1.z.object({
    batchId: zod_1.z.string().min(1, 'Batch ID is required'),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    type: zod_1.z.enum(['checkup', 'vaccination', 'injection', 'treatment']),
    description: zod_1.z.string().min(2, 'Description is required'),
    medicineUsed: zod_1.z.string().optional(),
    performedBy: zod_1.z.string().min(1, 'Performed by name is required'),
    cost: zod_1.z.number().min(0).optional(),
    attachmentUrls: zod_1.z.array(zod_1.z.string()).optional()
});
exports.createUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    role: zod_1.z.enum(['manager', 'worker']),
    phone: zod_1.z.string().optional()
});
exports.reminderSchema = zod_1.z.object({
    batchId: zod_1.z.string().optional(),
    type: zod_1.z.enum(['feed', 'water', 'medicine', 'custom']),
    message: zod_1.z.string().min(2, 'Message is required'),
    cronExpression: zod_1.z.string().min(5, 'Valid cron expression required'),
    assignedTo: zod_1.z.array(zod_1.z.string()).default([]),
    channel: zod_1.z.array(zod_1.z.enum(['push', 'sms'])).default(['push'])
});
