import { Response } from 'express';
import mongoose from 'mongoose';
import { saleSchema } from '@poultry-ops/validation';
import { SaleModel, BatchModel, CustomerModel, PaymentModel } from '../models/schemas';
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

export class SaleController {
  // Get sales invoices for active Firm
  static async getSales(req: AuthRequest, res: Response) {
    try {
      const { batchId, customerId, from, to } = req.query;
      const query: any = { farmId: req.farmId };

      if (batchId) {
        let bObjId: any;
        try { bObjId = new mongoose.Types.ObjectId(batchId as string); } catch { bObjId = batchId; }
        query.$and = [{ $or: [{ batchId: bObjId }, { batchId: String(batchId) }] }];
      }
      if (customerId) query.customerId = customerId;
      if (from || to) {
        query.date = {};
        if (from) query.date.$gte = from;
        if (to) query.date.$lte = to;
      }

      const sales = await SaleModel.find(query)
        .populate('customerId', 'name phone address')
        .sort({ date: -1 });

      return ResponseView.success(res, sales);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Create Sale
  static async createSale(req: AuthRequest, res: Response) {
    try {
      const parseResult = saleSchema.safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const {
        batchId,
        itemType,
        quantity,
        unitPrice,
        customerId: reqCustomerId,
        customerName,
        customerPhone,
        items: reqItems,
        date,
        amountPaid: reqAmountPaid,
        note,
        notes
      } = parseResult.data;

      // Resolve customer ID
      let targetCustomerId = reqCustomerId;
      if (!targetCustomerId && customerName && customerPhone) {
        let customer = await CustomerModel.findOne({
          farmId: req.farmId,
          phone: customerPhone.trim()
        });
        if (!customer) {
          customer = new CustomerModel({
            farmId: req.farmId,
            name: customerName.trim(),
            phone: customerPhone.trim(),
            totalDue: 0
          });
          await customer.save();
        }
        targetCustomerId = (customer._id as any).toString();
      }

      // Build items array
      let itemsToSave: any[] = [];
      let calculatedTotal = 0;

      if (reqItems && reqItems.length > 0) {
        itemsToSave = reqItems.map(item => {
          const subtotal = item.quantity * item.unitPrice;
          calculatedTotal += subtotal;
          return { ...item, subtotal };
        });
      } else if (itemType && quantity && unitPrice !== undefined) {
        const subtotal = quantity * unitPrice;
        calculatedTotal = subtotal;
        itemsToSave = [{
          type: itemType,
          quantity,
          unit: itemType === 'egg' ? 'piece' : 'bird',
          unitPrice,
          subtotal
        }];
      } else {
        return ResponseView.error(res, 'Invalid sale items or price structure.');
      }

      const amountPaid = Number(reqAmountPaid || 0);
      const amountDue = Math.max(0, calculatedTotal - amountPaid);
      let status: 'paid' | 'partial' | 'due' = 'due';
      if (amountDue === 0) status = 'paid';
      else if (amountPaid > 0) status = 'partial';

      const sale = new SaleModel({
        farmId: req.farmId,
        batchId,
        customerId: targetCustomerId,
        customerName,
        customerPhone,
        date,
        items: itemsToSave,
        totalAmount: calculatedTotal,
        amountPaid,
        amountDue,
        status,
        notes: note || notes,
        recordedBy: req.user?.userId
      });

      await sale.save();

      // Deduct sold chickens from batch
      const totalChickensSold = itemsToSave
        .filter(i => i.type === 'chicken')
        .reduce((sum, i) => sum + (i.birdCount || i.quantity || 0), 0);

      if (totalChickensSold > 0 && batchId) {
        const batch = await BatchModel.findOne({ _id: batchId, farmId: req.farmId });
        if (batch) {
          batch.currentCount = Math.max(0, batch.currentCount - totalChickensSold);
          await batch.save();
        }
      }

      // Record upfront payment if amountPaid > 0
      if (amountPaid > 0 && targetCustomerId) {
        const payment = new PaymentModel({
          farmId: req.farmId,
          customerId: targetCustomerId,
          saleId: sale._id,
          amount: amountPaid,
          date,
          method: 'cash',
          notes: `Upfront payment for Sale Invoice #${sale._id.toString().slice(-6)}`,
          recordedBy: req.user?.userId
        });
        await payment.save();
      }

      // Sync customer dues
      if (targetCustomerId) {
        await syncCustomerTotalDue(req.farmId, targetCustomerId);
      }

      return ResponseView.created(res, sale);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Delete sale
  static async deleteSale(req: AuthRequest, res: Response) {
    try {
      const sale = await SaleModel.findOne({ _id: req.params.id, farmId: req.farmId });
      if (!sale) {
        return ResponseView.notFound(res, 'Sale record not found');
      }

      if (sale.batchId) {
        const totalChickensSold = sale.items && sale.items.length > 0
          ? sale.items.filter(i => i.type === 'chicken').reduce((sum, i) => sum + (i.birdCount || i.quantity || 0), 0)
          : sale.itemType === 'chicken' ? (sale.quantity || 0) : 0;

        if (totalChickensSold > 0) {
          const batch = await BatchModel.findOne({ _id: sale.batchId, farmId: req.farmId });
          if (batch) {
            batch.currentCount += totalChickensSold;
            await batch.save();
          }
        }
      }

      const customerId = sale.customerId;

      await PaymentModel.deleteMany({ farmId: req.farmId, saleId: sale._id });
      await SaleModel.deleteOne({ _id: req.params.id, farmId: req.farmId });

      if (customerId) {
        await syncCustomerTotalDue(req.farmId, customerId);
      }

      return ResponseView.success(res, { message: 'Sale deleted successfully and dues updated' });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}
