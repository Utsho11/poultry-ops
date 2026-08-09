const mongoose = require('mongoose');

async function resetDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/poultry_ops';
  console.log(`Connecting to MongoDB: ${mongoUri}`);
  
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB. Dropping database...');
    await mongoose.connection.db.dropDatabase();
    console.log('Successfully dropped database "poultry_ops"! Database cleared.');
  } catch (err) {
    console.error('Error clearing database:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

resetDatabase();
