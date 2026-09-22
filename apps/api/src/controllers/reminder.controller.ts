import { Response } from 'express';
import mongoose from 'mongoose';
import { reminderSchema } from '@poultry-ops/validation';
import { ReminderModel, BatchModel, UserModel } from '../models/schemas';
import { AuthRequest } from '../middleware/auth';
import { ResponseView } from '../views/response.view';

export class ReminderController {
  // 1. Get all reminders for current firm
  static async getReminders(req: AuthRequest, res: Response) {
    try {
      const reminders = await ReminderModel.find({ farmId: req.farmId })
        .populate('batchId', 'name breed')
        .populate('assignedTo', 'name email phone role')
        .sort({ createdAt: -1 });

      return ResponseView.success(res, reminders);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // 2. Create new reminder
  static async createReminder(req: AuthRequest, res: Response) {
    try {
      const parseResult = reminderSchema.safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const { batchId, type, message, cronExpression, assignedTo, channel, active } = parseResult.data;

      if (batchId) {
        if (!mongoose.Types.ObjectId.isValid(batchId)) {
          return ResponseView.notFound(res, 'Selected batch not found');
        }
        const batch = await BatchModel.findOne({ _id: batchId, farmId: req.farmId });
        if (!batch) {
          return ResponseView.notFound(res, 'Selected batch not found');
        }
      }

      let verifiedAssignedTo: any[] = [];
      if (assignedTo && Array.isArray(assignedTo) && assignedTo.length > 0) {
        const validUserIds = assignedTo.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validUserIds.length > 0) {
          const farmUsers = await UserModel.find({ _id: { $in: validUserIds }, farmId: req.farmId }).select('_id');
          verifiedAssignedTo = farmUsers.map(u => u._id);
        }
      }

      const reminder = new ReminderModel({
        farmId: req.farmId,
        batchId: batchId || undefined,
        type,
        message,
        cronExpression,
        assignedTo: verifiedAssignedTo,
        channel: channel || ['push'],
        active: active !== undefined ? active : true,
        createdBy: req.user?.userId
      });

      await reminder.save();
      return ResponseView.created(res, reminder);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // 3. Update reminder
  static async updateReminder(req: AuthRequest, res: Response) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return ResponseView.notFound(res, 'Reminder not found');
      }

      const parseResult = reminderSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const reminder = await ReminderModel.findOne({ _id: req.params.id, farmId: req.farmId });
      if (!reminder) {
        return ResponseView.notFound(res, 'Reminder not found');
      }

      const { batchId, type, message, cronExpression, assignedTo, channel, active } = parseResult.data;

      if (batchId !== undefined) {
        if (batchId) {
          if (!mongoose.Types.ObjectId.isValid(batchId)) {
            return ResponseView.notFound(res, 'Selected batch not found');
          }
          const batch = await BatchModel.findOne({ _id: batchId, farmId: req.farmId });
          if (!batch) {
            return ResponseView.notFound(res, 'Selected batch not found');
          }
        }
        reminder.batchId = (batchId || undefined) as any;
      }
      if (type !== undefined) reminder.type = type;
      if (message !== undefined) reminder.message = message;
      if (cronExpression !== undefined) reminder.cronExpression = cronExpression;
      if (assignedTo !== undefined) {
        if (Array.isArray(assignedTo)) {
          const validUserIds = assignedTo.filter(id => mongoose.Types.ObjectId.isValid(id));
          const farmUsers = await UserModel.find({ _id: { $in: validUserIds }, farmId: req.farmId }).select('_id');
          reminder.assignedTo = farmUsers.map(u => u._id) as any;
        } else {
          reminder.assignedTo = [];
        }
      }
      if (channel !== undefined) reminder.channel = channel;
      if (active !== undefined) reminder.active = active;

      await reminder.save();
      return ResponseView.success(res, reminder);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // 4. Delete reminder
  static async deleteReminder(req: AuthRequest, res: Response) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return ResponseView.notFound(res, 'Reminder not found');
      }

      const reminder = await ReminderModel.findOne({ _id: req.params.id, farmId: req.farmId });
      if (!reminder) {
        return ResponseView.notFound(res, 'Reminder not found');
      }

      await ReminderModel.deleteOne({ _id: req.params.id, farmId: req.farmId });
      return ResponseView.success(res, { message: 'Reminder deleted successfully' });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}
