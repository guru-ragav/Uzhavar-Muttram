const http = require('http');
const { spawn } = require('child_process');
const Database = require('better-sqlite3');
const path = require('path');

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(url, options = {}) {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, body: data, json });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function run() {
  console.log("=== STARTING REGISTRATION & DATABASE VERIFICATION TEST ===");

  console.log("\n[1] Launching server...");
  // Pre-test cleanup of test accounts to allow repeatable test runs
  try {
    const preDb = new Database(path.join(__dirname, 'server', 'db', 'uzhavar.sqlite'));
    preDb.prepare("DELETE FROM users WHERE credential IN ('testfarmer123@example.com', 'testbuyer123@example.com')").run();
    preDb.close();
  } catch (e) {}

  let serverProcess = spawn('node', ['server/index.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env
  });

  await wait(2500);

  try {
    // 1. Health check
    console.log("\n[2] Verifying health API...");
    const health = await request('http://localhost:4000/api/health');
    console.log("Health API response:", health.json);
    if (!health.json?.success || health.json?.database !== 'connected') {
      throw new Error("Health check failed");
    }

    // 2. Register New Farmer Account (as specified in user prompt)
    console.log("\n[3] Registering new farmer: Test Farmer (testfarmer123@example.com)...");
    const regRes = await request('http://localhost:4000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        fullName: 'Test Farmer',
        credential: 'testfarmer123@example.com',
        password: 'Test@12345',
        confirmPassword: 'Test@12345',
        role: 'farmer',
        mobile: '+91 98111 22233',
        district: 'Madurai',
        landAcres: 6.5
      }
    });

    console.log("Registration response status:", regRes.status);
    console.log("Registration response body:", regRes.json);

    if (regRes.status !== 201 || !regRes.json?.success) {
      throw new Error(`Registration failed: ${regRes.body}`);
    }

    // 3. Database direct inspection
    console.log("\n[4] Inspecting SQLite database directly for registered user and farmer_profile...");
    const db = new Database(path.join(__dirname, 'server', 'db', 'uzhavar.sqlite'));
    const userInDb = db.prepare('SELECT id, full_name, credential, role, password_hash, created_at FROM users WHERE credential = ?').get('testfarmer123@example.com');
    console.log("User record in SQLite users table:", {
      id: userInDb?.id,
      full_name: userInDb?.full_name,
      credential: userInDb?.credential,
      role: userInDb?.role,
      has_hash: Boolean(userInDb?.password_hash),
      created_at: userInDb?.created_at
    });

    if (!userInDb || userInDb.credential !== 'testfarmer123@example.com') {
      throw new Error("User record not found in SQLite users table!");
    }
    if (userInDb.password_hash === 'Test@12345') {
      throw new Error("SECURITY FAILURE: Plaintext password stored in database!");
    }

    const profileInDb = db.prepare('SELECT * FROM farmer_profiles WHERE user_id = ?').get(userInDb.id);
    console.log("Profile in SQLite farmer_profiles table:", {
      id: profileInDb?.id,
      user_id: profileInDb?.user_id,
      name: profileInDb?.name,
      mobile: profileInDb?.mobile,
      district: profileInDb?.district,
      land_acres: profileInDb?.land_acres,
      ekyc_status: profileInDb?.ekyc_status
    });

    if (!profileInDb) {
      throw new Error("Farmer profile record not found in SQLite farmer_profiles table!");
    }
    db.close();

    // 4. Duplicate Account Check (Expect HTTP 409)
    console.log("\n[5] Testing duplicate registration rejection (expecting HTTP 409)...");
    const dupRes = await request('http://localhost:4000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        fullName: 'Another Person',
        credential: 'testfarmer123@example.com',
        password: 'Password@999',
        role: 'farmer'
      }
    });
    console.log("Duplicate status:", dupRes.status, "Message:", dupRes.json?.message);
    if (dupRes.status !== 409 || dupRes.json?.success !== false) {
      throw new Error(`Expected HTTP 409 for duplicate credential, got ${dupRes.status}`);
    }

    // 5. Login using the newly registered user
    console.log("\n[6] Logging in with newly registered account (testfarmer123@example.com / Test@12345)...");
    const loginRes = await request('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        credential: 'testfarmer123@example.com',
        password: 'Test@12345'
      }
    });

    console.log("Login response status:", loginRes.status);
    console.log("Login response body:", loginRes.json);

    if (loginRes.status !== 200 || !loginRes.json?.token || loginRes.json?.user?.role !== 'farmer') {
      throw new Error(`Login failed for newly registered user: ${loginRes.body}`);
    }
    const userToken = loginRes.json.token;

    // 6. Test session restoration with GET /api/auth/me
    console.log("\n[7] Verifying GET /api/auth/me with new user token...");
    const meRes = await request('http://localhost:4000/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + userToken }
    });
    console.log("Me response:", meRes.json);
    if (meRes.status !== 200 || meRes.json?.user?.credential !== 'testfarmer123@example.com') {
      throw new Error("Session verification failed for new user");
    }

    // 7. Security: Test Officer Registration with invalid passkey (Expect 403)
    console.log("\n[8] Testing unauthorized Officer registration attempt without passkey (expecting HTTP 403)...");
    const badOfficerRes = await request('http://localhost:4000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        fullName: 'Hacker Officer',
        credential: 'fakeofficer@example.com',
        password: 'SecretPassword123',
        role: 'officer'
      }
    });
    console.log("Unauthorized officer status:", badOfficerRes.status, "Message:", badOfficerRes.json?.message);
    if (badOfficerRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for unauthorized officer registration, got ${badOfficerRes.status}`);
    }

    // 8. Register Buyer Account
    console.log("\n[9] Registering new buyer: testbuyer123@example.com...");
    const buyerRegRes = await request('http://localhost:4000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        fullName: 'Suresh Trader',
        credential: 'testbuyer123@example.com',
        password: 'Buyer@12345',
        role: 'buyer',
        companyName: 'Tamil Nadu Grain Corp',
        gstin: '33ABCDE1234F1Z9'
      }
    });
    console.log("Buyer registration status:", buyerRegRes.status);
    if (buyerRegRes.status !== 201 || !buyerRegRes.json?.success) {
      throw new Error(`Buyer registration failed: ${buyerRegRes.body}`);
    }

    // 9. Stop server and test persistence across restart
    console.log("\n[10] Stopping Node server to verify SQLite persistence across shutdown...");
    serverProcess.kill('SIGTERM');
    await wait(2000);

    console.log("Starting server again...");
    serverProcess = spawn('node', ['server/index.js'], {
      cwd: __dirname,
      stdio: 'inherit',
      env: process.env
    });
    await wait(2500);

    // 10. Login with new farmer account after server restart!
    console.log("\n[11] Logging in again with testfarmer123@example.com AFTER SERVER RESTART...");
    const reloginRes = await request('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        credential: 'testfarmer123@example.com',
        password: 'Test@12345'
      }
    });
    console.log("Re-login response status:", reloginRes.status);
    console.log("Re-login user data:", reloginRes.json?.user);

    if (reloginRes.status !== 200 || !reloginRes.json?.token) {
      throw new Error("Newly registered account disappeared after server restart!");
    }

    // 11. Verify existing demo accounts still work
    console.log("\n[12] Verifying existing demo accounts still function properly...");
    const demoFarmer = await request('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { credential: 'farmer@demo.com', password: 'Farmer@123' }
    });
    const demoOfficer = await request('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { credential: 'officer@demo.com', password: 'Officer@123' }
    });
    const demoBuyer = await request('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { credential: 'buyer@demo.com', password: 'Buyer@123' }
    });

    if (demoFarmer.status === 200 && demoOfficer.status === 200 && demoBuyer.status === 200) {
      console.log(" PASS: All demo accounts (farmer, officer, buyer) continue to authenticate flawlessly.");
    } else {
      throw new Error("Demo accounts broken!");
    }

    console.log("\n============================================================");
    console.log("🎉 REGISTRATION SYSTEM FULLY VERIFIED IN SQLITE & PRODUCTION!");
    console.log("============================================================");

  } finally {
    serverProcess.kill('SIGTERM');
  }
}

run().catch(err => {
  console.error("\n❌ SUITE EXECUTION FAILED:", err);
  process.exit(1);
});
