import { Response } from 'express';
import mongoose from 'mongoose';
import { customerSchema, updateCustomerSchema } from '@poultry-ops/validation';
import { CustomerModel, SaleModel } from '../models/schemas';
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

      const existing = await CustomerModel.findOne({ farmId: req.farmId, phone: phone.trim() });
      if (existing) {
        return ResponseView.error(res, 'A customer with this phone number already exists', 409);
      }

      const customer = new CustomerModel({
        farmId: req.farmId,
        name: name.trim(),
        phone: phone.trim(),
        address: address?.trim(),
        totalDue: 0
      });

      await customer.save();
      return ResponseView.created(res, customer);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Update customer
  static async updateCustomer(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseView.error(res, 'Invalid customer ID', 400);
      }

      const parseResult = updateCustomerSchema.safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const { name, phone, address } = parseResult.data;

      const customer = await CustomerModel.findOne({ _id: id, farmId: req.farmId });
      if (!customer) {
        return ResponseView.notFound(res, 'Customer not found');
      }

      if (phone && phone.trim() !== customer.phone) {
        const existing = await CustomerModel.findOne({
          farmId: req.farmId,
          phone: phone.trim(),
          _id: { $ne: customer._id }
        });
        if (existing) {
          return ResponseView.error(res, 'A customer with this phone number already exists', 409);
        }
        customer.phone = phone.trim();
      }

      if (name) customer.name = name.trim();
      if (address !== undefined) customer.address = address?.trim();

      await customer.save();
      return ResponseView.success(res, customer);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Delete customer
  static async deleteCustomer(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseView.error(res, 'Invalid customer ID', 400);
      }

      const customer = await CustomerModel.findOne({ _id: id, farmId: req.farmId });
      if (!customer) {
        return ResponseView.notFound(res, 'Customer not found');
      }

      if (customer.totalDue && customer.totalDue > 0) {
        return ResponseView.error(res, `Cannot delete customer with outstanding due of ৳${customer.totalDue}`, 400);
      }

      const hasSales = await SaleModel.exists({ customerId: customer._id, farmId: req.farmId });
      if (hasSales) {
        return ResponseView.error(res, 'Cannot delete customer who has existing sales records', 400);
      }

      await CustomerModel.findOneAndDelete({ _id: id, farmId: req.farmId });
      return ResponseView.success(res, { message: 'Customer deleted successfully' });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}
