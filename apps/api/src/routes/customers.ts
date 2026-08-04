import { Router, Response } from 'express';
import { customerSchema } from '@poultry-ops/validation';
import { CustomerModel, SaleModel, PaymentModel } from '../models/schemas';
import { authenticate, AuthRequest } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

// Helper function to sync & recompute customer's total due
export async function syncCustomerTotalDue(farmId: any, customerId: any): Promise<number> {
  const sales = await SaleModel.find({ farmId, customerId });
  const totalDue = sales.reduce((sum, s) => sum + (s.amountDue || 0), 0);
  await CustomerModel.updateOne({ _id: customerId, farmId }, { $set: { totalDue: Number(totalDue.toFixed(2)) } });
  return totalDue;
}

// GET /api/customers - List/search customers for current farm
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query;
    const filter: any = { farmId: req.farmId };

    if (q) {
      const searchRegex = new RegExp(String(q).trim(), 'i');
      filter.$or = [{ name: searchRegex }, { phone: searchRegex }];
    }

    const customers = await CustomerModel.find(filter).sort({ name: 1 });
    return res.json(customers);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/customers - Create a new customer
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = customerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    }

    const { name, phone, address } = parseResult.data;
    const normalizedPhone = phone.replace(/\D/g, '');

    if (!normalizedPhone || normalizedPhone.length < 6) {
      return res.status(400).json({ error: 'Invalid phone number format. Must contain at least 6 digits.' });
    }

    // Check if phone number already exists for this farm
    const existing = await CustomerModel.findOne({ farmId: req.farmId, phone: normalizedPhone });
    if (existing) {
      return res.status(400).json({
        error: 'Customer with this phone number already exists for your farm',
        existingCustomer: existing
      });
    }

    const customer = new CustomerModel({
      farmId: req.farmId,
      name: name.trim(),
      phone: normalizedPhone,
      address: address?.trim(),
      totalDue: 0
    });

    await customer.save();
    return res.status(201).json(customer);
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Customer with this phone number already exists.' });
    }
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/customers/:id - Customer details, sales ledger, and payments history
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const customer = await CustomerModel.findOne({ _id: req.params.id, farmId: req.farmId });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Recompute total due on read to guarantee accuracy
    const calculatedDue = await syncCustomerTotalDue(req.farmId, customer._id);
    customer.totalDue = calculatedDue;

    const [sales, payments] = await Promise.all([
      SaleModel.find({ farmId: req.farmId, customerId: customer._id }).sort({ date: -1, createdAt: -1 }),
      PaymentModel.find({ farmId: req.farmId, customerId: customer._id }).sort({ date: -1, createdAt: -1 })
    ]);

    return res.json({
      customer,
      sales,
      payments
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
