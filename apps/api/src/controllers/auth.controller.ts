import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { registerSchema, registerFarmSchema, loginSchema } from '@poultry-ops/validation';
import { FarmModel, UserModel } from '../models/schemas';
import { generateToken, AuthRequest } from '../middleware/auth';
import { ResponseView } from '../views/response.view';

export class AuthController {
  // Register User Account (Phone or Email + Password)
  static async register(req: AuthRequest, res: Response) {
    try {
      const parseResult = registerSchema.safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const { name, password, email, phone } = parseResult.data;

      // Check existing email or phone
      if (email && email.trim()) {
        const existingEmail = await UserModel.findOne({ email: email.toLowerCase().trim() });
        if (existingEmail) {
          return ResponseView.error(res, 'An account with this email address already exists');
        }
      }

      if (phone && phone.trim()) {
        const existingPhone = await UserModel.findOne({ phone: phone.trim() });
        if (existingPhone) {
          return ResponseView.error(res, 'An account with this phone number already exists');
        }
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = new UserModel({
        name,
        email: email && email.trim() ? email.toLowerCase().trim() : undefined,
        phone: phone && phone.trim() ? phone.trim() : undefined,
        passwordHash,
        role: 'owner',
        isActive: true
      });

      await user.save();

      const token = generateToken({
        userId: (user._id as any).toString(),
        farmId: '',
        role: user.role,
        email: user.email || '',
        name: user.name
      });

      return ResponseView.created(res, {
        user: {
          userId: (user._id as any).toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          farmId: null,
          farmName: null
        },
        accessToken: token
      });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message || 'Server error during registration', error);
    }
  }

  // Register Firm + Owner Account
  static async registerFarm(req: AuthRequest, res: Response) {
    try {
      const parseResult = registerFarmSchema.safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const { farmName, animalType, date, location, ownerName, email, phone, password, timezone } = parseResult.data;

      if (email && email.trim()) {
        const existingUser = await UserModel.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
          return ResponseView.error(res, 'An account with this email already exists');
        }
      }

      if (phone && phone.trim()) {
        const existingPhone = await UserModel.findOne({ phone: phone.trim() });
        if (existingPhone) {
          return ResponseView.error(res, 'An account with this phone number already exists');
        }
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const owner = new UserModel({
        name: ownerName,
        email: email && email.trim() ? email.toLowerCase().trim() : undefined,
        phone: phone && phone.trim() ? phone.trim() : undefined,
        passwordHash,
        role: 'owner',
        isActive: true
      });
      await owner.save();

      const farm = new FarmModel({
        name: farmName,
        animalType: animalType || 'layer',
        date: date ? new Date(date) : undefined,
        location,
        ownerId: owner._id,
        timezone: timezone || 'Asia/Dhaka',
        plan: 'pro'
      });
      await farm.save();

      owner.farmId = farm._id as any;
      owner.activeFarmId = farm._id as any;
      await owner.save();

      const token = generateToken({
        userId: (owner._id as any).toString(),
        farmId: (farm._id as any).toString(),
        role: 'owner',
        email: owner.email || '',
        name: owner.name
      });

      return ResponseView.created(res, {
        user: {
          userId: (owner._id as any).toString(),
          farmId: (farm._id as any).toString(),
          name: owner.name,
          email: owner.email,
          phone: owner.phone,
          role: owner.role,
          farmName: farm.name,
          animalType: farm.animalType
        },
        accessToken: token
      });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message || 'Server error during firm registration', error);
    }
  }

  // Login via Email OR Phone Number + Password
  static async login(req: AuthRequest, res: Response) {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const { identifier, email, phone, password } = req.body;
      const loginTerm = (identifier || email || phone || '').trim();

      if (!loginTerm) {
        return ResponseView.error(res, 'Please provide an email address or phone number');
      }

      // Search user by email OR phone
      const user = await UserModel.findOne({
        $or: [
          { email: loginTerm.toLowerCase() },
          { phone: loginTerm }
        ]
      }).populate('activeFarmId farmId');

      if (!user || !user.isActive) {
        return ResponseView.unauthorized(res, 'Invalid login credentials');
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return ResponseView.unauthorized(res, 'Invalid login credentials');
      }

      // Resolve Active Firm
      let activeFarm = (user.activeFarmId || user.farmId) as any;
      if (!activeFarm) {
        activeFarm = await FarmModel.findOne({ ownerId: user._id });
        if (activeFarm) {
          user.activeFarmId = activeFarm._id;
          await user.save();
        }
      }

      const farmIdStr = activeFarm ? activeFarm._id.toString() : '';

      const token = generateToken({
        userId: (user._id as any).toString(),
        farmId: farmIdStr,
        role: user.role,
        email: user.email || '',
        name: user.name
      });

      return ResponseView.success(res, {
        user: {
          userId: (user._id as any).toString(),
          farmId: farmIdStr,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          farmName: activeFarm?.name || null,
          animalType: activeFarm?.animalType || null
        },
        accessToken: token
      });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message || 'Server error during login', error);
    }
  }

  // Get Current Profile
  static async me(req: AuthRequest, res: Response) {
    try {
      const user = await UserModel.findById(req.user?.userId).populate('activeFarmId farmId');
      if (!user) {
        return ResponseView.notFound(res, 'User profile not found');
      }

      let activeFarm = (user.activeFarmId || user.farmId) as any;
      if (!activeFarm) {
        activeFarm = await FarmModel.findOne({ ownerId: user._id });
      }

      const farmIdStr = activeFarm ? activeFarm._id.toString() : '';

      return ResponseView.success(res, {
        user: {
          userId: (user._id as any).toString(),
          farmId: farmIdStr,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          farmName: activeFarm?.name || null,
          animalType: activeFarm?.animalType || null
        }
      });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Switch Active Firm
  static async switchFirm(req: AuthRequest, res: Response) {
    try {
      const { farmId } = req.body;
      if (!farmId) {
        return ResponseView.error(res, 'Firm ID is required');
      }

      const farm = await FarmModel.findById(farmId);
      if (!farm) {
        return ResponseView.notFound(res, 'Firm not found');
      }

      const user = await UserModel.findById(req.user?.userId);
      if (!user) {
        return ResponseView.notFound(res, 'User not found');
      }

      // Security check: Verify user owns the farm or belongs to the farm team
      const isOwner = farm.ownerId && farm.ownerId.toString() === (user._id as any).toString();
      const isMember = user.farmId && user.farmId.toString() === farm._id.toString();
      if (!isOwner && !isMember) {
        return ResponseView.forbidden(res, 'You do not have permission to access this firm');
      }

      user.activeFarmId = farm._id as any;
      await user.save();

      const token = generateToken({
        userId: (user._id as any).toString(),
        farmId: farm._id.toString(),
        role: user.role,
        email: user.email || '',
        name: user.name
      });

      return ResponseView.success(res, {
        message: `Switched active firm to ${farm.name}`,
        user: {
          userId: (user._id as any).toString(),
          farmId: farm._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          farmName: farm.name,
          animalType: farm.animalType
        },
        accessToken: token
      });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}
