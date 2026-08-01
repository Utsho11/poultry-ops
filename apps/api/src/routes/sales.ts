import { Router, Response } from 'express';
import { saleSchema } from '@poultry-ops/validation';
import { SaleModel, BatchModel } from '../models/schemas';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

// GET /api/sales - List sales for current farm
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { batchId, itemType, limit } = req.query;
    const filter: any = { farmId: req.farmId };
    if (batchId) filter.batchId = batchId;
    if (itemType) filter.itemType = itemType;

    const query = SaleModel.find(filter).sort({ date: -1, createdAt: -1 });
    if (limit) query.limit(Number(limit));

    const sales = await query.exec();
    return res.json(sales);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/sales - Record a new egg or chicken sale (OWNER ONLY)
router.post('/', requireRole(['owner']), async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = saleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    }

    const { batchId, itemType, quantity, unitPrice, date, customerName, note } = parseResult.data;
    const totalAmount = Number((quantity * unitPrice).toFixed(2));

    // If chicken sale with specific batch, decrease batch count
    if (itemType === 'chicken' && batchId) {
      const batch = await BatchModel.findOne({ _id: batchId, farmId: req.farmId });
      if (batch) {
        batch.currentCount = Math.max(0, batch.currentCount - quantity);
        await batch.save();
      }
    }

    const sale = new SaleModel({
      farmId: req.farmId,
      batchId: batchId || undefined,
      itemType,
      quantity,
      unitPrice,
      totalAmount,
      date,
      customerName,
      note,
      recordedBy: req.user?.userId
    });

    await sale.save();
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

    // If deleting a chicken sale, restore batch count
    if (sale.itemType === 'chicken' && sale.batchId) {
      const batch = await BatchModel.findOne({ _id: sale.batchId, farmId: req.farmId });
      if (batch) {
        batch.currentCount += sale.quantity;
        await batch.save();
      }
    }

    await SaleModel.deleteOne({ _id: req.params.id, farmId: req.farmId });
    return res.json({ message: 'Sale deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
