import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoMemoryServer: MongoMemoryServer | null = null;

export const connectDB = async () => {
  // Reuse existing connection in serverless warm lambda containers
  if (mongoose.connection.readyState === 1) {
    return;
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/poultry_ops';

  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false
    });
    console.log('MongoDB connected successfully.');
  } catch (error) {
    const isServerless = process.env.VERCEL || process.env.NODE_ENV === 'production';
    if (isServerless) {
      console.error('Critical: MongoDB connection error in production/Vercel:', error);
      throw error;
    }

    console.log('Local MongoDB connection failed or timed out. Initializing MongoMemoryServer in-memory fallback...');
    try {
      if (!mongoMemoryServer) {
        mongoMemoryServer = await MongoMemoryServer.create();
      }
      const memoryUri = mongoMemoryServer.getUri();
      await mongoose.connect(memoryUri);
      console.log(`Connected to MongoMemoryServer at ${memoryUri}`);
    } catch (memError) {
      console.error('MongoMemoryServer error:', memError);
    }
  }
};

export const closeDB = async () => {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
};
