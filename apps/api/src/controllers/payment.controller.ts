import { Response } from 'express';
import mongoose from 'mongoose';
import { paymentSchema } from '@poultry-ops/validation';
import { PaymentModel, CustomerModel, SaleModel } from '../models/schemas';
import { AuthRequest } from '../middleware/auth';
import { ResponseView } from '../views/response.view';

async function syncCustomerTotalDue(farmId: any, customerId: any) {
  const farmObjId = typeof farmId === 'string' ? new mongoose.Types.ObjectId(farmId) : farmId;
  const custObjId = typeof customerId === 'string' ? new mongoose.Types.ObjectId(customerId) : customerId;

  const salesAgg = await SaleModel.aggregate([
    { $match: { farmId: farmObjId, customerId: custObjId } },
    { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } }
  ]);
  const totalSales = salesAgg[0]?.totalSales || 0;

  const paymentsAgg = await PaymentModel.aggregate([
    { $match: { farmId: farmObjId, customerId: custObjId } },
    { $group: { _id: null, totalPayments: { $sum: '$amount' } } }
  ]);
  const totalPayments = paymentsAgg[0]?.totalPayments || 0;

  const totalDue = Math.max(0, totalSales - totalPayments);

  await CustomerModel.updateOne(
    { _id: custObjId, farmId: farmObjId },
    { $set: { totalDue } }
  );
}

export class PaymentController {
  // Get payments for active Firm
  static async getPayments(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.query;
      const query: any = { farmId: req.farmId };
      if (customerId) query.customerId = customerId;

      const payments = await PaymentModel.find(query)
        .populate('customerId', 'name phone')
        .sort({ date: -1 });

      return ResponseView.success(res, payments);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Create payment record
  static async createPayment(req: AuthRequest, res: Response) {
    try {
      const parseResult = paymentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const { customerId, saleId, amount, date, method, notes } = parseResult.data;

      if (!mongoose.Types.ObjectId.isValid(customerId)) {
        return ResponseView.notFound(res, 'Customer not found');
      }

      const customer = await CustomerModel.findOne({ _id: customerId, farmId: req.farmId });
      if (!customer) {
        return ResponseView.notFound(res, 'Customer not found');
      }

      const payment = new PaymentModel({
        farmId: req.farmId,
        customerId,
        saleId,
        amount,
        date,
        method,
        notes,
        recordedBy: req.user?.userId
      });

      await payment.save();

      // If linked to a specific sale, update the sale invoice's paid/due/status
      if (saleId) {
        if (!mongoose.Types.ObjectId.isValid(saleId)) {
          return ResponseView.error(res, 'Invalid sale ID', 400);
        }
        const sale = await SaleModel.findOne({ _id: saleId, customerId: customer._id, farmId: req.farmId });
        if (sale) {
          sale.amountPaid = (sale.amountPaid || 0) + amount;
          sale.amountDue = Math.max(0, (sale.totalAmount || 0) - sale.amountPaid);
          if (sale.amountDue === 0) sale.status = 'paid';
          else if (sale.amountPaid > 0) sale.status = 'partial';
          await sale.save();
        }
      }

      // Recalculate customer due
      await syncCustomerTotalDue(req.farmId, customerId);

      return ResponseView.created(res, payment);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Delete payment record
  static async deletePayment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseView.notFound(res, 'Payment not found');
      }

      const payment = await PaymentModel.findOne({ _id: id, farmId: req.farmId });
      if (!payment) {
        return ResponseView.notFound(res, 'Payment not found');
      }

      // Revert sale amountPaid if linked to a specific sale
      if (payment.saleId) {
        const sale = await SaleModel.findOne({ _id: payment.saleId, farmId: req.farmId });
        if (sale) {
          sale.amountPaid = Math.max(0, (sale.amountPaid || 0) - payment.amount);
          sale.amountDue = Math.max(0, (sale.totalAmount || 0) - sale.amountPaid);
          if (sale.amountDue === 0) sale.status = 'paid';
          else if (sale.amountPaid > 0) sale.status = 'partial';
          else sale.status = 'due';
          await sale.save();
        }
      }

      const customerId = payment.customerId;
      await PaymentModel.deleteOne({ _id: id, farmId: req.farmId });

      // Recalculate customer due
      await syncCustomerTotalDue(req.farmId, customerId);

      return ResponseView.success(res, { message: 'Payment deleted successfully', id });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}
