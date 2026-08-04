import { Router, Response } from 'express';
import { saleSchema } from '@poultry-ops/validation';
import { SaleModel, BatchModel, CustomerModel, PaymentModel } from '../models/schemas';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { syncCustomerTotalDue } from './customers';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

// GET /api/sales - List sales for current farm
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { batchId, customerId, status, itemType, date, startDate, endDate, limit } = req.query;
    const filter: any = { farmId: req.farmId };
    if (batchId) filter.batchId = batchId;
    if (customerId) filter.customerId = customerId;
    if (status) filter.status = status;
    if (itemType) filter.itemType = itemType;
    if (date) filter.date = date;
    if (startDate && endDate) {
      filter.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      filter.date = { $gte: startDate };
    } else if (endDate) {
      filter.date = { $lte: endDate };
    }

    const query = SaleModel.find(filter).sort({ date: -1, createdAt: -1 });
    if (limit) query.limit(Number(limit));

    const sales = await query.exec();
    return res.json(sales);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/sales/:id - Sale details with payment trail
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const sale = await SaleModel.findOne({ _id: req.params.id, farmId: req.farmId });
    if (!sale) return res.status(404).json({ error: 'Sale record not found' });

    const payments = await PaymentModel.find({ farmId: req.farmId, saleId: sale._id }).sort({ date: -1 });
    return res.json({ sale, payments });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/sales - Record a new sale (Multi-item, Customer & Due handling)
router.post('/', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = saleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    }

    const {
      batchId, customerId, customerName, customerPhone,
      items: rawItems, itemType: legacyType, quantity: legacyQty, unitPrice: legacyPrice,
      date, amountPaid = 0, note, notes
    } = parseResult.data;

    // Build line items array with Crates + Loose Eggs and Bird Count + Weight (kg)
    let itemsToProcess: Array<{
      type: 'egg' | 'chicken';
      quantity: number;
      crates?: number;
      looseEggs?: number;
      birdCount?: number;
      weightKg?: number;
      unit: 'piece' | 'tray' | 'kg' | 'bird';
      unitPrice: number;
      subtotal: number;
    }> = [];

    if (rawItems && rawItems.length > 0) {
      itemsToProcess = rawItems.map(i => {
        let qty = i.quantity || 0;
        let subtotal = 0;

        if (i.type === 'egg') {
          const crates = i.crates || 0;
          const loose = i.looseEggs || 0;
          if (crates > 0 || loose > 0) {
            qty = (crates * 30) + loose;
          }
          if (i.unit === 'tray') {
            const totalTrays = crates + (loose / 30);
            subtotal = Number((totalTrays * i.unitPrice).toFixed(2));
          } else {
            subtotal = Number((qty * i.unitPrice).toFixed(2));
          }
        } else {
          // Chicken sale: count birds and weight in kg
          const birds = i.birdCount || i.quantity || 0;
          const weight = i.weightKg || 0;
          qty = birds; // quantity = bird count for batch deduction

          if (i.unit === 'kg' && weight > 0) {
            subtotal = Number((weight * i.unitPrice).toFixed(2));
          } else {
            subtotal = Number((birds * i.unitPrice).toFixed(2));
          }
        }

        return {
          type: i.type,
          quantity: qty,
          crates: i.crates,
          looseEggs: i.looseEggs,
          birdCount: i.birdCount || (i.type === 'chicken' ? qty : undefined),
          weightKg: i.weightKg,
          unit: i.unit || 'piece',
          unitPrice: i.unitPrice,
          subtotal
        };
      });
    } else if (legacyType && legacyQty && legacyPrice !== undefined) {
      const subtotal = Number((legacyQty * legacyPrice).toFixed(2));
      itemsToProcess = [{
        type: legacyType,
        quantity: legacyQty,
        unit: 'piece',
        unitPrice: legacyPrice,
        subtotal
      }];
    } else {
      return res.status(400).json({ error: 'Sale must contain at least one valid line item' });
    }

    // SERVER-SIDE MONEY MATH - NEVER TRUST CLIENT TOTALS
    const totalAmount = Number(itemsToProcess.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
    const finalAmountPaid = Math.min(totalAmount, Math.max(0, Number(amountPaid.toFixed(2))));
    const amountDue = Number((totalAmount - finalAmountPaid).toFixed(2));
    const status: 'paid' | 'partial' | 'due' = amountDue <= 0 ? 'paid' : finalAmountPaid === 0 ? 'due' : 'partial';

    // Handle Customer lookup or inline creation
    let activeCustomer: any = null;
    if (customerId) {
      activeCustomer = await CustomerModel.findOne({ _id: customerId, farmId: req.farmId });
    } else if (customerPhone) {
      const normPhone = customerPhone.replace(/\D/g, '');
      if (normPhone) {
        activeCustomer = await CustomerModel.findOne({ farmId: req.farmId, phone: normPhone });
        if (!activeCustomer && customerName) {
          activeCustomer = new CustomerModel({
            farmId: req.farmId,
            name: customerName.trim(),
            phone: normPhone,
            totalDue: 0
          });
          await activeCustomer.save();
        }
      }
    }

    // Deduct chicken count from batch if chicken items sold (using birdCount or quantity)
    if (batchId) {
      const totalChickensSold = itemsToProcess
        .filter(i => i.type === 'chicken')
        .reduce((sum, i) => sum + (i.birdCount || i.quantity || 0), 0);

      if (totalChickensSold > 0) {
        const batch = await BatchModel.findOne({ _id: batchId, farmId: req.farmId });
        if (batch) {
          batch.currentCount = Math.max(0, batch.currentCount - totalChickensSold);
          await batch.save();
        }
      }
    }

    const sale = new SaleModel({
      farmId: req.farmId,
      batchId: batchId || undefined,
      customerId: activeCustomer ? activeCustomer._id : undefined,
      customerName: activeCustomer ? activeCustomer.name : (customerName || 'Walk-in Customer'),
      customerPhone: activeCustomer ? activeCustomer.phone : customerPhone,
      itemType: itemsToProcess[0]?.type || 'egg', // legacy fallback
      quantity: itemsToProcess[0]?.quantity || 0, // legacy fallback
      unitPrice: itemsToProcess[0]?.unitPrice || 0, // legacy fallback
      items: itemsToProcess,
      totalAmount,
      amountPaid: finalAmountPaid,
      amountDue,
      status,
      date,
      notes: notes || note,
      recordedBy: req.user?.userId
    });

    await sale.save();

    // If initial payment was made at sale creation, log Payment entry
    if (finalAmountPaid > 0 && activeCustomer) {
      const initialPayment = new PaymentModel({
        farmId: req.farmId,
        customerId: activeCustomer._id,
        customerName: activeCustomer.name,
        customerPhone: activeCustomer.phone,
        saleId: sale._id,
        amount: finalAmountPaid,
        date,
        method: 'cash',
        notes: `Initial payment at sale creation (Invoice #${sale._id.toString().slice(-6)})`,
        recordedBy: req.user?.userId
      });
      await initialPayment.save();
    }

    // Sync Customer's total due
    if (activeCustomer) {
      await syncCustomerTotalDue(req.farmId, activeCustomer._id);
    }

    return res.status(201).json(sale);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/sales/:id - Delete a sale (OWNER ONLY)
router.delete('/:id', requireRole(['owner']), async (req: AuthRequest, res: Response) => {
  try {
    const sale = await SaleModel.findOne({ _id: req.params.id, farmId: req.farmId });
    if (!sale) return res.status(404).json({ error: 'Sale record not found' });

    // Restore batch chicken count if chicken items existed
    if (sale.batchId) {
      const totalChickensSold = sale.items && sale.items.length > 0
        ? sale.items.filter(i => i.type === 'chicken').reduce((sum, i) => sum + i.quantity, 0)
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

    // Delete linked payment records
    await PaymentModel.deleteMany({ farmId: req.farmId, saleId: sale._id });
    await SaleModel.deleteOne({ _id: req.params.id, farmId: req.farmId });

    // Recalculate customer due
    if (customerId) {
      await syncCustomerTotalDue(req.farmId, customerId);
    }

    return res.json({ message: 'Sale deleted successfully and dues updated' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
