import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { registerFarmSchema, loginSchema } from '@poultry-ops/validation';
import { FarmModel, UserModel } from '../models/schemas';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Register Farm + Owner Account
router.post('/register-farm', async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = registerFarmSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    }

    const { farmName, ownerName, email, password, phone, timezone } = parseResult.data;

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Create Farm
    const farm = new FarmModel({
      name: farmName,
      timezone: timezone || 'Asia/Dhaka',
      plan: 'pro'
    });
    await farm.save();

    // Hash Password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create Owner User
    const owner = new UserModel({
      farmId: farm._id,
      name: ownerName,
      email,
      passwordHash,
      phone,
      role: 'owner',
      isActive: true
    });
    await owner.save();

    // Set Owner on Farm
    farm.ownerId = owner._id as any;
    await farm.save();

    const token = generateToken({
      userId: (owner._id as any).toString(),
      farmId: (farm._id as any).toString(),
      role: 'owner',
      email: owner.email,
      name: owner.name
    });

    return res.status(201).json({
      user: {
        userId: (owner._id as any).toString(),
        farmId: (farm._id as any).toString(),
        name: owner.name,
        email: owner.email,
        role: owner.role,
        farmName: farm.name
      },
      accessToken: token
    });
  } catch (error: any) {
    console.error('Register Farm Error:', error);
    return res.status(500).json({ error: error.message || 'Server error during registration' });
  }
});

// Login
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    }

    const { email, password } = parseResult.data;

    const user = await UserModel.findOne({ email }).populate('farmId');
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const farm = user.farmId as any;

    const token = generateToken({
      userId: (user._id as any).toString(),
      farmId: (user.farmId as any)._id ? (user.farmId as any)._id.toString() : user.farmId.toString(),
      role: user.role,
      email: user.email,
      name: user.name
    });

    return res.json({
      user: {
        userId: (user._id as any).toString(),
        farmId: farm._id ? farm._id.toString() : user.farmId.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        farmName: farm.name || 'My Farm'
      },
      accessToken: token
    });
  } catch (error: any) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: error.message || 'Server error during login' });
  }
});

// Get Current User Profile
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await UserModel.findById(req.user?.userId).populate('farmId');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const farm = user.farmId as any;
    return res.json({
      user: {
        userId: (user._id as any).toString(),
        farmId: farm._id ? farm._id.toString() : user.farmId.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        farmName: farm.name || 'My Farm'
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
