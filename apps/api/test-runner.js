const http = require('http');

const BASE_URL = 'http://127.0.0.1:4000/api';

async function request(method, path, body = null, headers = {}) {
  const url = new URL(BASE_URL + path);
  const payload = body ? JSON.stringify(body) : null;
  const options = {
    method,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    headers: {
      'Content-Type': 'application/json',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      ...headers
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const results = [];
function record(testName, passed, details = '') {
  results.push({ testName, passed, details });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${mark}: ${testName} ${details ? '(' + details + ')' : ''}`);
}

async function runTests() {
  console.log('=== STARTING AUTOMATED API DIAGNOSTIC SUITE ===\n');

  // 1. Health check
  try {
    const res = await request('GET', '/health-check');
    record('Health Check', res.status === 200 && res.body.status === 'ok', `status: ${res.status}`);
  } catch (e) {
    record('Health Check', false, e.message);
  }

  // 2. Auth: Register
  const testEmail = `test_${Date.now()}@farmtest.com`;
  const testPhone = `017${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testPassword = 'Password123!';
  let token = '';
  let userId = '';

  try {
    const res = await request('POST', '/auth/register', {
      name: 'Diagnostic Tester',
      email: testEmail,
      phone: testPhone,
      password: testPassword
    });
    const ok = res.status === 201 && res.body.accessToken;
    if (ok) {
      token = res.body.accessToken;
      userId = res.body.user.userId;
    }
    record('User Registration', ok, `status: ${res.status}`);
  } catch (e) {
    record('User Registration', false, e.message);
  }

  // Duplicate Registration check
  try {
    const res = await request('POST', '/auth/register', {
      name: 'Duplicate Tester',
      email: testEmail,
      password: testPassword
    });
    record('Duplicate Registration Rejected', res.status >= 400, `status: ${res.status}`);
  } catch (e) {
    record('Duplicate Registration Rejected', false, e.message);
  }

  // Login with correct credentials
  try {
    const res = await request('POST', '/auth/login', {
      identifier: testEmail,
      password: testPassword
    });
    record('Login with correct credentials', res.status === 200 && res.body.accessToken, `status: ${res.status}`);
  } catch (e) {
    record('Login with correct credentials', false, e.message);
  }

  // Login with wrong password
  try {
    const res = await request('POST', '/auth/login', {
      identifier: testEmail,
      password: 'WrongPassword!'
    });
    record('Login with wrong password rejected', res.status >= 400, `status: ${res.status}`);
  } catch (e) {
    record('Login with wrong password rejected', false, e.message);
  }

  // Auth /me
  try {
    const res = await request('GET', '/auth/me', null, { Authorization: `Bearer ${token}` });
    record('Auth /me with valid token', res.status === 200 && res.body.user?.email === testEmail, `status: ${res.status}`);
  } catch (e) {
    record('Auth /me with valid token', false, e.message);
  }

  // Auth /me unauthenticated
  try {
    const res = await request('GET', '/auth/me');
    record('Auth /me without token rejected', res.status === 401, `status: ${res.status}`);
  } catch (e) {
    record('Auth /me without token rejected', false, e.message);
  }

  // List farms BEFORE creating one (tests empty state & previously discovered CastError bug)
  try {
    const res = await request('GET', '/farms', null, { Authorization: `Bearer ${token}` });
    const ok = res.status === 200 && Array.isArray(res.body);
    record('List Farms (Empty state / no crash)', ok, `status: ${res.status}, count: ${res.body?.length}`);
  } catch (e) {
    record('List Farms (Empty state / no crash)', false, e.message);
  }

  // 3. Farm / Firm creation
  let farmId = '';
  try {
    const res = await request('POST', '/farms', {
      name: 'Alpha Diagnostic Poultry Farm',
      animalType: 'broiler',
      location: 'Gazipur, Bangladesh',
      date: new Date().toISOString().split('T')[0]
    }, { Authorization: `Bearer ${token}` });
    const ok = (res.status === 200 || res.status === 201) && (res.body._id || res.body.farm?._id);
    farmId = res.body._id || res.body.farm?._id;
    if (res.body.accessToken) {
      token = res.body.accessToken;
    }
    record('Create Firm', ok, `farmId: ${farmId}, status: ${res.status}`);
  } catch (e) {
    record('Create Firm', false, e.message);
  }

  // List farms AFTER creation
  try {
    const res = await request('GET', '/farms', null, { Authorization: `Bearer ${token}` });
    const ok = res.status === 200 && Array.isArray(res.body) && res.body.length > 0;
    record('List Farms (Populated)', ok, `status: ${res.status}, count: ${res.body?.length}`);
  } catch (e) {
    record('List Farms (Populated)', false, e.message);
  }

  const authHeader = {
    Authorization: `Bearer ${token}`,
    'x-farm-id': farmId
  };

  // 4. Batch Creation & Password Security Checks
  let batchId = '';
  // 4a. Should reject batch creation without password
  try {
    const res = await request('POST', '/batches', {
      name: 'Batch Alpha-01',
      breed: 'Cobb 500',
      type: 'broiler',
      initialCount: 1000,
      startDate: new Date().toISOString()
    }, authHeader);
    const ok = res.status === 400;
    record('Create Batch Without Password (Reject 400)', ok, `status: ${res.status}`);
  } catch (e) {
    record('Create Batch Without Password (Reject 400)', false, e.message);
  }

  // 4b. Should reject batch creation with incorrect password
  try {
    const res = await request('POST', '/batches', {
      name: 'Batch Alpha-01',
      breed: 'Cobb 500',
      type: 'broiler',
      initialCount: 1000,
      startDate: new Date().toISOString(),
      password: 'WrongPassword999!'
    }, authHeader);
    const ok = res.status === 401;
    record('Create Batch With Wrong Password (Reject 401)', ok, `status: ${res.status}`);
  } catch (e) {
    record('Create Batch With Wrong Password (Reject 401)', false, e.message);
  }

  // 4c. Should succeed with correct password
  try {
    const res = await request('POST', '/batches', {
      name: 'Batch Alpha-01',
      breed: 'Cobb 500',
      type: 'broiler',
      initialCount: 1000,
      startDate: new Date().toISOString(),
      password: testPassword
    }, authHeader);
    const ok = (res.status === 200 || res.status === 201) && res.body._id;
    batchId = res.body._id;
    record('Create Batch With Valid Password', ok, `batchId: ${batchId}, status: ${res.status}`);
  } catch (e) {
    record('Create Batch With Valid Password', false, e.message);
  }

  // Batch listing
  try {
    const res = await request('GET', '/batches', null, authHeader);
    const ok = res.status === 200 && Array.isArray(res.body) && res.body.length > 0;
    record('List Batches', ok, `count: ${res.body?.length}, status: ${res.status}`);
  } catch (e) {
    record('List Batches', false, e.message);
  }

  // Get Batch by ID
  try {
    const res = await request('GET', `/batches/${batchId}`, null, authHeader);
    record('Get Batch by ID', res.status === 200 && res.body._id === batchId, `status: ${res.status}`);
  } catch (e) {
    record('Get Batch by ID', false, e.message);
  }

  // 5. Feed Stock (Add before logs to ensure feed availability)
  let feedStockId = '';
  try {
    const res = await request('POST', '/feed-stock', {
      category: 'broiler_starter',
      bagPrice: 2500,
      bags: 20,
      date: new Date().toISOString().split('T')[0],
      note: 'Initial feed shipment'
    }, authHeader);
    const ok = (res.status === 200 || res.status === 201) && res.body._id;
    feedStockId = res.body._id;
    record('Feed Stock Purchase', ok, `feedId: ${feedStockId}, status: ${res.status}`);
  } catch (e) {
    record('Feed Stock Purchase', false, e.message);
  }

  // Get Feed Stock
  try {
    const res = await request('GET', '/feed-stock', null, authHeader);
    record('Get Feed Stock History', res.status === 200 && Array.isArray(res.body), `status: ${res.status}`);
  } catch (e) {
    record('Get Feed Stock History', false, e.message);
  }

  // 6a. Reject log dated earlier than batch startDate
  try {
    const pastDate = '2020-01-01';
    const res = await request('POST', '/logs', {
      batchId: batchId,
      date: pastDate,
      feedGivenKg: 10,
      deadCount: 0
    }, authHeader);
    const ok = res.status === 400;
    record('Reject Log Before Batch Start Date', ok, `status: ${res.status}`);
  } catch (e) {
    record('Reject Log Before Batch Start Date', false, e.message);
  }

  // 6b. Daily Logs
  let logId = '';
  try {
    const res = await request('POST', '/logs', {
      batchId: batchId,
      date: new Date().toISOString().split('T')[0],
      deadCount: 5,
      feedGivenKg: 40,
      waterGivenLiters: 120,
      notes: 'Optimal growth'
    }, authHeader);
    const ok = (res.status === 200 || res.status === 201) && res.body._id;
    logId = res.body._id;
    record('Create Daily Log', ok, `logId: ${logId}, status: ${res.status}`);
  } catch (e) {
    record('Create Daily Log', false, e.message);
  }

  // Check that batch.lastLogDate was updated
  try {
    const res = await request('GET', `/batches/${batchId}`, null, authHeader);
    const ok = res.status === 200 && res.body.lastLogDate === new Date().toISOString().split('T')[0];
    record('Batch lastLogDate Tracked', ok, `lastLogDate: ${res.body?.lastLogDate}`);
  } catch (e) {
    record('Batch lastLogDate Tracked', false, e.message);
  }

  // Verify mortality reflection in Batch
  try {
    const res = await request('GET', `/batches/${batchId}`, null, authHeader);
    const ok = res.status === 200 && res.body.currentCount === 995;
    record('Mortality reflection in Batch (1000 - 5 = 995)', ok, `currentCount: ${res.body?.currentCount}`);
  } catch (e) {
    record('Mortality reflection in Batch', false, e.message);
  }

  // 7. Customers
  let customerId = '';
  try {
    const res = await request('POST', '/customers', {
      name: 'Rahim Poultry Traders',
      phone: '01811223344',
      address: 'Mohakhali Bazaar, Dhaka'
    }, authHeader);
    const ok = (res.status === 200 || res.status === 201) && res.body._id;
    customerId = res.body._id;
    record('Create Customer', ok, `customerId: ${customerId}, status: ${res.status}`);
  } catch (e) {
    record('Create Customer', false, e.message);
  }

  // 8. Sales
  try {
    const res = await request('POST', '/sales', {
      batchId: batchId,
      customerId: customerId,
      itemType: 'chicken',
      quantity: 50,
      unitPrice: 180,
      amountPaid: 5000,
      date: new Date().toISOString().split('T')[0],
      notes: 'Diagnostic test sale'
    }, authHeader);
    record('Create Sale', (res.status === 200 || res.status === 201), `status: ${res.status}`);
  } catch (e) {
    record('Create Sale', false, e.message);
  }

  // 9. Sales verification & Payments
  let saleId = '';
  try {
    const res = await request('GET', '/sales', null, authHeader);
    const saleDoc = res.body?.[0];
    saleId = saleDoc?._id;
    const ok = res.status === 200 && saleDoc?.itemType === 'chicken' && saleDoc?.quantity === 50 && saleDoc?.totalAmount === 9000;
    record('Sale Item Attributes (itemType & Qty populated)', ok, `itemType: ${saleDoc?.itemType}, qty: ${saleDoc?.quantity}`);
  } catch (e) {
    record('Sale Item Attributes (itemType & Qty populated)', false, e.message);
  }

  // 10. Customer Dues & Payment Sync
  try {
    const res = await request('GET', '/customers', null, authHeader);
    const cust = res.body?.find(c => c._id === customerId);
    record('Customer Due Tracking after Sale (৳9000 - ৳5000 = ৳4000)', cust?.totalDue === 4000, `totalDue: ${cust?.totalDue}`);
  } catch (e) {
    record('Customer Due Tracking after Sale', false, e.message);
  }

  try {
    const res = await request('POST', '/payments', {
      customerId: customerId,
      saleId: saleId,
      amount: 2000,
      date: new Date().toISOString().split('T')[0],
      method: 'cash',
      notes: 'Customer cleared partial due'
    }, authHeader);
    record('Record Payment', (res.status === 200 || res.status === 201), `status: ${res.status}`);
  } catch (e) {
    record('Record Payment', false, e.message);
  }

  try {
    const res = await request('GET', '/customers', null, authHeader);
    const cust = res.body?.find(c => c._id === customerId);
    record('Customer Due Synced after Payment (৳4000 - ৳2000 = ৳2000)', cust?.totalDue === 2000, `totalDue: ${cust?.totalDue}`);
  } catch (e) {
    record('Customer Due Synced after Payment', false, e.message);
  }

  // 11. Expenses
  try {
    const res = await request('POST', '/expenses', {
      batchId: batchId,
      category: 'medicine',
      amount: 1200,
      date: new Date().toISOString().split('T')[0],
      note: 'Vitamins & minerals'
    }, authHeader);
    record('Create Expense', (res.status === 200 || res.status === 201), `status: ${res.status}`);
  } catch (e) {
    record('Create Expense', false, e.message);
  }

  // 12. Reports
  try {
    const res = await request('GET', '/reports/summary', null, authHeader);
    record('Summary Report', res.status === 200, `status: ${res.status}`);
  } catch (e) {
    record('Summary Report', false, e.message);
  }

  try {
    const res = await request('GET', `/reports/batch-dashboard/${batchId}`, null, authHeader);
    record('Batch Dashboard Report', res.status === 200, `status: ${res.status}`);
  } catch (e) {
    record('Batch Dashboard Report', false, e.message);
  }

  try {
    const res = await request('GET', '/reports/activity-log', null, authHeader);
    record('Activity Log Report', res.status === 200, `status: ${res.status}`);
  } catch (e) {
    record('Activity Log Report', false, e.message);
  }

  // 13. Invalid ObjectId Resilience (Verify no 500 CastError crash)
  try {
    const res = await request('GET', '/farms/invalid-id-string', null, { Authorization: `Bearer ${token}` });
    record('Invalid Farm ID Handled (404 not 500)', res.status === 404, `status: ${res.status}`);
  } catch (e) {
    record('Invalid Farm ID Handled (404 not 500)', false, e.message);
  }

  try {
    const res = await request('GET', '/batches/invalid-batch-id', null, authHeader);
    record('Invalid Batch ID Handled (404 not 500)', res.status === 404, `status: ${res.status}`);
  } catch (e) {
    record('Invalid Batch ID Handled (404 not 500)', false, e.message);
  }

  // 14. Team Members
  let teamUserId = '';
  try {
    const res = await request('POST', '/team', {
      name: 'Farm Manager Hasan',
      email: `hasan_${Date.now()}@farm.com`,
      phone: `019${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: 'Password123!',
      role: 'manager'
    }, authHeader);
    const ok = (res.status === 200 || res.status === 201) && res.body._id;
    teamUserId = res.body._id;
    record('Add Team Member', ok, `teamUserId: ${teamUserId}, status: ${res.status}`);
  } catch (e) {
    record('Add Team Member', false, e.message);
  }

  // List team members
  try {
    const res = await request('GET', '/team', null, authHeader);
    record('List Team Members', res.status === 200 && Array.isArray(res.body), `status: ${res.status}`);
  } catch (e) {
    record('List Team Members', false, e.message);
  }

  // Clean up team member
  if (teamUserId) {
    try {
      const res = await request('DELETE', `/team/${teamUserId}`, null, authHeader);
      record('Delete Team Member', res.status === 200, `status: ${res.status}`);
    } catch (e) {
      record('Delete Team Member', false, e.message);
    }
  }

  // Close batch with password verification
  if (batchId) {
    try {
      const res = await request('POST', `/batches/${batchId}/close`, { password: testPassword }, authHeader);
      record('Close Batch With Valid Password', res.status === 200 && res.body.status === 'closed', `status: ${res.status}`);
    } catch (e) {
      record('Close Batch With Valid Password', false, e.message);
    }
  }

  // Clean up batch with password verification
  if (batchId) {
    try {
      const res = await request('DELETE', `/batches/${batchId}`, { password: testPassword }, authHeader);
      record('Delete Batch', res.status === 200, `status: ${res.status}`);
    } catch (e) {
      record('Delete Batch', false, e.message);
    }
  }

  console.log('\n=== DIAGNOSTIC SUITE SUMMARY ===');
  const passedCount = results.filter(r => r.passed).length;
  console.log(`Total Tests: ${results.length} | Passed: ${passedCount} | Failed: ${results.length - passedCount}`);
}

runTests().catch(console.error);
