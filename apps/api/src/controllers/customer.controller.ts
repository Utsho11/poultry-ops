import { Response } from 'express';
import { customerSchema } from '@poultry-ops/validation';
import { CustomerModel } from '../models/schemas';
import { AuthRequest } from '../middleware/auth';
import { ResponseView } from '../views/response.view';

export class CustomerController {
  // Get all customers for active Firm
  static async getCustomers(req: AuthRequest, res: Response) {
    try {
      const customers = await CustomerModel.find({ farmId: req.farmId }).sort({ name: 1 });
      return ResponseView.success(res, customers);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Create customer
  static async createCustomer(req: AuthRequest, res: Response) {
    try {
      const parseResult = customerSchema.safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const { name, phone, address } = parseResult.data;

      const existing = await CustomerModel.findOne({ farmId: req.farmId, phone });
      if (existing) {
        return ResponseView.error(res, 'A customer with this phone number already exists', 409);
      }

      const customer = new CustomerModel({
        farmId: req.farmId,
        name,
        phone,
        address,
        totalDue: 0
      });

      await customer.save();
      return ResponseView.created(res, customer);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}
