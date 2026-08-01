import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { DeviceTokenModel } from '../models/schemas';

const router = Router();

// POST /api/device-tokens - Register or update device token for push notifications
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { expoPushToken, platform, deviceId } = req.body;
    if (!expoPushToken || !platform || !deviceId) {
      return res.status(400).json({ error: 'expoPushToken, platform, and deviceId are required' });
    }

    const userId = req.user?.userId;
    const farmId = req.farmId;

    if (!userId || !farmId) {
      return res.status(401).json({ error: 'User context missing' });
    }

    const tokenDoc = await DeviceTokenModel.findOneAndUpdate(
      { userId, deviceId },
      {
        userId,
        farmId,
        expoPushToken,
        platform,
        deviceId,
        lastSeenAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true, deviceTokenId: tokenDoc._id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save device token' });
  }
});

// DELETE /api/device-tokens/:deviceId - Unregister device token on logout
router.delete('/:deviceId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user?.userId;
    await DeviceTokenModel.deleteOne({ userId, deviceId });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete device token' });
  }
});

export default router;
