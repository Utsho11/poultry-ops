import mongoose from 'mongoose';

// Cache connection promise and instance across serverless invocations
let cachedConnection: typeof mongoose | null = null;
let cachedPromise: Promise<typeof mongoose> | null = null;
let mongoMemoryServer: any = null;

export const connectDB = async (): Promise<typeof mongoose> => {
  // If already connected (readyState === 1), reuse connection immediately
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // If a connection attempt is in progress, wait for it
  if (cachedPromise) {
    return await cachedPromise;
  }

  const isServerless = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
  if (isServerless && !process.env.MONGODB_URI) {
    throw new Error('FATAL: MONGODB_URI environment variable is not configured. A cloud database connection is required in production.');
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/poultry_ops';

  const connectOptions: mongoose.ConnectOptions = {
    serverSelectionTimeoutMS: 8000,
    bufferCommands: false,
    maxPoolSize: 10,
  };

  cachedPromise = mongoose
    .connect(mongoUri, connectOptions)
    .then((m) => {
      cachedConnection = m;
      console.log('MongoDB connected successfully.');
      return m;
    })
    .catch(async (error) => {
      cachedPromise = null;
      cachedConnection = null;

      if (isServerless) {
        console.error('Critical MongoDB connection error in production/Vercel:', error);
        throw error;
      }

      console.log('Local MongoDB connection failed. Initializing MongoMemoryServer in-memory fallback...');
      try {
        if (!mongoMemoryServer) {
          // Dynamically import only in local environment to prevent bundling in Vercel functions
          const { MongoMemoryServer } = await import('mongodb-memory-server');
          mongoMemoryServer = await MongoMemoryServer.create();
        }
        const memoryUri = mongoMemoryServer.getUri();
        const memConn = await mongoose.connect(memoryUri);
        console.log(`Connected to MongoMemoryServer at ${memoryUri}`);
        return memConn;
      } catch (memError) {
        console.error('MongoMemoryServer fallback error:', memError);
        throw memError;
      }
    });

  return await cachedPromise;
};

export const closeDB = async () => {
  await mongoose.disconnect();
  cachedConnection = null;
  cachedPromise = null;
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
    mongoMemoryServer = null;
  }
};
