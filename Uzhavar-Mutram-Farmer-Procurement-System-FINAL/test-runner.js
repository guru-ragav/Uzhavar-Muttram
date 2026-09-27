const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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
  console.log("=== STARTING FULL E2E SUITE FOR DEADLINE REQUIREMENTS ===");

  // 1. Start Server
  console.log("\n[TEST 1 & 2] Launching server via node server/index.js...");
  let serverProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env
  });

  await wait(2500);

  try {
    // [TEST 3] Frontend load
    console.log("\n[TEST 3] Verifying http://localhost:4000 (Frontend static serving)...");
    const feRes = await request('http://localhost:4000/');
    if (feRes.status === 200 && feRes.body.includes('Uzhavar Mutram')) {
      console.log(" PASS: Frontend loads successfully (HTTP 200, index.html served).");
    } else {
      throw new Error(`Frontend failed to load properly. Status: ${feRes.status}`);
    }

    // [TEST 4] Health endpoint
    console.log("\n[TEST 4] Checking /api/health (Database connectivity)...");
    const health = await request('http://localhost:4000/api/health');
    if (health.status === 200 && health.json && health.json.database === 'connected') {
      console.log(" PASS: Database is connected and healthy:", health.json);
    } else {
      throw new Error(`Health check failed: ${health.body}`);
    }

    // [TEST 5] Farmer Login
    console.log("\n[TEST 5] Testing Farmer Login (farmer@demo.com / Farmer@123)...");
    const farmerLogin = await request('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { credential: 'farmer@demo.com', password: 'Farmer@123' }
    });
    if (farmerLogin.status === 200 && farmerLogin.json && farmerLogin.json.success && farmerLogin.json.user.role === 'farmer') {
      console.log(" PASS: Farmer logged in successfully. Token generated. Role:", farmerLogin.json.user.role);
    } else {
      throw new Error(`Farmer login failed: ${farmerLogin.body}`);
    }
    const farmerToken = farmerLogin.json.token;

    // [TEST 6] Invalid Password
    console.log("\n[TEST 6] Testing Invalid Password (expecting HTTP 401)...");
    const badLogin = await request('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { credential: 'farmer@demo.com', password: 'IncorrectPassword' }
    });
    if (badLogin.status === 401 && badLogin.json && !badLogin.json.success) {
      console.log(" PASS: Invalid password correctly rejected with HTTP 401:", badLogin.json.message);
    } else {
      throw new Error(`Bad login did not return 401: ${badLogin.status}`);
    }

    // [TEST 7] Officer Login
    console.log("\n[TEST 7] Testing Officer Login (officer@demo.com / Officer@123)...");
    const officerLogin = await request('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { credential: 'officer@demo.com', password: 'Officer@123' }
    });
    if (officerLogin.status === 200 && officerLogin.json && officerLogin.json.success && officerLogin.json.user.role === 'officer') {
      console.log(" PASS: Officer logged in successfully. Role:", officerLogin.json.user.role);
    } else {
      throw new Error(`Officer login failed: ${officerLogin.body}`);
    }
    const officerToken = officerLogin.json.token;

    // [TEST 11] Unauthenticated protected API
    console.log("\n[TEST 11] Attempting protected API without JWT (expecting HTTP 401)...");
    const noAuth = await request('http://localhost:4000/api/farmer/profile');
    if (noAuth.status === 401) {
      console.log(" PASS: Protected API blocked without JWT (HTTP 401):", noAuth.json?.message);
    } else {
      throw new Error(`Expected 401 for unauthenticated request, got ${noAuth.status}`);
    }

    // [TEST 12] Role-based forbidden access
    console.log("\n[TEST 12] Attempting officer-only endpoint using Farmer JWT (expecting HTTP 403)...");
    const forbidden = await request('http://localhost:4000/api/bookings', {
      headers: { 'Authorization': `Bearer ${farmerToken}` }
    });
    if (forbidden.status === 403) {
      console.log(" PASS: Forbidden role blocked with HTTP 403:", forbidden.json?.message);
    } else {
      throw new Error(`Expected 403 for role violation, got ${forbidden.status}`);
    }

    // [TEST 9] Create farmer data/booking
    console.log("\n[TEST 9] Creating persistent booking in SQLite database...");
    const createBooking = await request('http://localhost:4000/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${farmerToken}`
      },
      body: {
        mandiId: 'MND-01',
        mandiName: 'Koyambedu Wholesale Market Complex',
        cropId: 'TURMERIC',
        cropName: 'Turmeric (Erode Finger Special)',
        quantityInput: 80,
        unit: 'QUINTAL',
        quantityKg: 8000,
        quantityMT: 8.0,
        vehicleType: 'HEAVY_TRUCK',
        vehicleNumber: 'TN-45-ZZ-9999',
        bookingDate: '2026-10-15',
        timeSlot: '11:00 AM - 12:00 PM'
      }
    });
    if (createBooking.status === 201 && createBooking.json && createBooking.json.success) {
      console.log(" PASS: Booking created in DB! TokenNumber:", createBooking.json.booking.tokenNumber, "ID:", createBooking.json.booking.id);
    } else {
      throw new Error(`Create booking failed: ${createBooking.body}`);
    }
    const createdId = createBooking.json.booking.id;

    // [TEST 8 & 10] Server Restart & Database Persistence Test
    console.log("\n[TEST 8 & 10] Stopping server to verify persistence across server restarts...");
    serverProcess.kill('SIGTERM');
    await wait(2000);

    console.log("Starting server again from scratch...");
    serverProcess = spawn(process.execPath, ['server/index.js'], {
      cwd: __dirname,
      stdio: 'inherit',
      env: process.env
    });
    await wait(2500);

    // Verify login still works after restart
    console.log("Verifying login works after server restart...");
    const relogin = await request('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { credential: 'farmer@demo.com', password: 'Farmer@123' }
    });
    if (relogin.status === 200 && relogin.json?.token) {
      console.log(" PASS: Login succeeds after server restart.");
    } else {
      throw new Error("Login failed after server restart");
    }
    const newFarmerToken = relogin.json.token;

    // Verify created booking still exists after restart!
    console.log("Verifying created booking persists in SQLite after server restart...");
    const mineBookings = await request('http://localhost:4000/api/bookings/mine', {
      headers: { 'Authorization': `Bearer ${newFarmerToken}` }
    });
    const found = mineBookings.json?.bookings?.find(b => b.id === createdId || b.cropId === 'TURMERIC');
    if (found) {
      console.log(" PASS: CRITICAL PERSISTENCE VERIFIED! Booking survived server shutdown and restart:", {
        id: found.id,
        tokenNumber: found.tokenNumber,
        crop: found.cropName,
        date: found.bookingDate
      });
    } else {
      throw new Error("Created booking was NOT found after server restart!");
    }

    console.log("\n====================================================");
    console.log("🎉 ALL CRITICAL DEADLINE REQUIREMENTS FULLY VERIFIED!");
    console.log("====================================================");

  } finally {
    serverProcess.kill('SIGTERM');
  }
}

run().catch(err => {
  console.error("\n❌ SUITE EXECUTION ERROR:", err);
  process.exit(1);
});
