import { Router, Response } from 'express';
import { paymentSchema } from '@poultry-ops/validation';
import { PaymentModel, SaleModel, CustomerModel } from '../models/schemas';
import { authenticate, AuthRequest } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { syncCustomerTotalDue } from './customers';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

// GET /api/payments - List payment records for farm
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, saleId, from, to } = req.query;
    const filter: any = { farmId: req.farmId };
    if (customerId) filter.customerId = customerId;
    if (saleId) filter.saleId = saleId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }

    const payments = await PaymentModel.find(filter).sort({ date: -1, createdAt: -1 });
    return res.json(payments);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/payments - Record a payment to settle dues
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = paymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    }

    const { customerId, saleId, amount, date, method = 'cash', notes } = parseResult.data;

    const customer = await CustomerModel.findOne({ _id: customerId, farmId: req.farmId });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const paymentAmount = Number(amount.toFixed(2));
    if (paymentAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    if (saleId) {
      // Payment against specific sale
      const sale = await SaleModel.findOne({ _id: saleId, farmId: req.farmId, customerId: customer._id });
      if (!sale) {
        return res.status(404).json({ error: 'Sale record not found for this customer' });
      }

      if (paymentAmount > sale.amountDue + 0.01) {
        return res.status(400).json({
          error: `Payment amount (৳${paymentAmount}) exceeds sale due (৳${sale.amountDue})`
        });
      }

      sale.amountPaid = Number((sale.amountPaid + paymentAmount).toFixed(2));
      sale.amountDue = Math.max(0, Number((sale.totalAmount - sale.amountPaid).toFixed(2)));
      sale.status = sale.amountDue <= 0 ? 'paid' : 'partial';
      await sale.save();
    } else {
      // General payment: apply FIFO against customer's oldest unpaid sales
      let remainingToApply = paymentAmount;

      const unpaidSales = await SaleModel.find({
        farmId: req.farmId,
        customerId: customer._id,
        status: { $in: ['due', 'partial'] }
      }).sort({ date: 1, createdAt: 1 });

      for (const s of unpaidSales) {
        if (remainingToApply <= 0) break;
        const dueOnSale = s.amountDue;
        const applyAmt = Math.min(remainingToApply, dueOnSale);

        s.amountPaid = Number((s.amountPaid + applyAmt).toFixed(2));
        s.amountDue = Math.max(0, Number((s.totalAmount - s.amountPaid).toFixed(2)));
        s.status = s.amountDue <= 0 ? 'paid' : 'partial';
        await s.save();

        remainingToApply = Number((remainingToApply - applyAmt).toFixed(2));
      }
    }

    const payment = new PaymentModel({
      farmId: req.farmId,
      customerId: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      saleId: saleId || undefined,
      amount: paymentAmount,
      date,
      method,
      notes,
      recordedBy: req.user?.userId
    });

    await payment.save();

    // Recalculate & sync customer's total due
    const updatedTotalDue = await syncCustomerTotalDue(req.farmId, customer._id);

    return res.status(201).json({
      payment,
      updatedCustomerDue: updatedTotalDue
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
