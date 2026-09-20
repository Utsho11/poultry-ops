const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function seed() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/poultry_ops';
  console.log(`Connecting to MongoDB at: ${mongoUri}`);

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log('Connected to MongoDB.');

    const db = mongoose.connection.db;

    // Remove existing test data if any
    await db.collection('users').deleteMany({ email: { $in: ['test@farm.com', 'worker@farm.com'] } });
    await db.collection('farms').deleteMany({ name: 'Green Valley Farm' });

    const passwordHash = await bcrypt.hash('password123', 10);

    const farmId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    const workerId = new mongoose.Types.ObjectId();
    const batchId = new mongoose.Types.ObjectId();

    // 1. Create Farm
    await db.collection('farms').insertOne({
      _id: farmId,
      name: 'Green Valley Farm',
      animalType: 'layer',
      location: 'Gazipur, Dhaka',
      ownerId: ownerId,
      plan: 'pro',
      timezone: 'Asia/Dhaka',
      createdAt: new Date()
    });

    // 2. Create Owner User
    await db.collection('users').insertOne({
      _id: ownerId,
      name: 'Test Owner',
      email: 'test@farm.com',
      phone: '01700000000',
      passwordHash: passwordHash,
      role: 'owner',
      farmId: farmId,
      activeFarmId: farmId,
      fcmTokens: [],
      isActive: true,
      createdAt: new Date()
    });

    // 3. Create Worker User
    await db.collection('users').insertOne({
      _id: workerId,
      name: 'Test Worker',
      email: 'worker@farm.com',
      phone: '01800000000',
      passwordHash: passwordHash,
      role: 'worker',
      farmId: farmId,
      activeFarmId: farmId,
      fcmTokens: [],
      isActive: true,
      createdAt: new Date()
    });

    // 4. Create Batch
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await db.collection('batches').insertOne({
      _id: batchId,
      farmId: farmId,
      name: 'Batch Alpha (Layer)',
      breed: 'Hy-Line Brown',
      type: 'layer',
      startDate: thirtyDaysAgo,
      initialCount: 1000,
      currentCount: 985,
      status: 'active',
      assignedWorkerIds: [workerId],
      createdAt: thirtyDaysAgo
    });

    // 5. Daily logs for recent days
    const today = new Date();
    const logs = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      logs.push({
        farmId: farmId,
        batchId: batchId,
        date: dateStr,
        eggCount: 920 - i * 5,
        brokenEggCount: 4 + (i % 3),
        deadCount: i === 2 ? 1 : 0,
        feedGivenKg: 115,
        waterGivenLiters: 230,
        medicineGiven: [],
        recordedBy: workerId,
        notes: 'Birds healthy, normal feed intake',
        createdAt: d
      });
    }
    await db.collection('dailylogs').insertMany(logs);

    // 6. Feed Stock
    await db.collection('feedstocks').insertOne({
      farmId: farmId,
      category: 'layer_layer_1',
      bagPrice: 2850,
      bags: 25,
      totalKg: 1250,
      totalCost: 71250,
      date: new Date().toISOString().split('T')[0],
      note: 'Initial feed stock delivery',
      recordedBy: ownerId,
      createdAt: new Date()
    });

    // 7. Expense
    await db.collection('expenses').insertOne({
      farmId: farmId,
      batchId: batchId,
      category: 'feed',
      amount: 71250,
      currency: 'BDT',
      date: new Date().toISOString().split('T')[0],
      note: 'Layer Feed Batch 1',
      feedBags: 25,
      feedKg: 1250,
      recordedBy: ownerId,
      createdAt: new Date()
    });

    // 8. Customer
    const customerId = new mongoose.Types.ObjectId();
    await db.collection('customers').insertOne({
      _id: customerId,
      farmId: farmId,
      name: 'Rahman Traders',
      phone: '01911223344',
      address: 'Kawran Bazar, Dhaka',
      totalDue: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 9. Sale
    await db.collection('sales').insertOne({
      farmId: farmId,
      batchId: batchId,
      customerId: customerId,
      date: new Date().toISOString().split('T')[0],
      items: [
        {
          type: 'egg',
          quantity: 2700,
          crates: 90,
          looseEggs: 0,
          unit: 'piece',
          unitPrice: 11.5,
          subtotal: 31050
        }
      ],
      totalAmount: 31050,
      paidAmount: 31050,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      recordedBy: ownerId,
      createdAt: new Date()
    });

    console.log('Test database successfully seeded!');
    console.log('-------------------------------------------');
    console.log('Owner Credentials:');
    console.log('  Email: test@farm.com');
    console.log('  Phone: 01700000000');
    console.log('  Password: password123');
    console.log('-------------------------------------------');
    console.log('Worker Credentials:');
    console.log('  Email: worker@farm.com');
    console.log('  Phone: 01800000000');
    console.log('  Password: password123');
    console.log('-------------------------------------------');

  } catch (err) {
    console.error('Error seeding test database:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
