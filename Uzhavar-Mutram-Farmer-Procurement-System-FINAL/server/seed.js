const bcrypt = require('bcryptjs');

function seedDatabase(db) {
  // 1. Seed Demo Users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    console.log('Seeding initial demo users and profiles...');
    const insertUser = db.prepare(`
      INSERT INTO users (id, full_name, credential, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertProfile = db.prepare(`
      INSERT INTO farmer_profiles (
        id, user_id, name, aadhaar, mobile, village, district, state,
        land_acres, bank_name, account_no, ifsc, ekyc_status, verified_date,
        farmer_id_agristack, agristack_verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Farmer 1 (email credential)
    const farmerPass = bcrypt.hashSync('Farmer@123', 10);
    insertUser.run('usr-farmer-01', 'Ramesh Singh Kumar', 'farmer@demo.com', farmerPass, 'farmer');
    insertProfile.run(
      'FAR-2026-8812', 'usr-farmer-01', 'Ramesh Singh Kumar',
      'XXXX-XXXX-4921', '+91 98765 43210', 'Koyambedu / Madurai',
      'Madurai', 'Tamil Nadu', 8.5, 'State Bank of India',
      '••••••••6719', 'SBIN0001234', 'VERIFIED', '2026-08-25',
      'FID-TN-2026-8812', 'VERIFIED'
    );

    // Farmer phone credential (+91 98765 43210)
    insertUser.run('usr-farmer-phone', 'Ramesh Singh Kumar', '+91 98765 43210', farmerPass, 'farmer');
    insertProfile.run(
      'FAR-2026-8813', 'usr-farmer-phone', 'Ramesh Singh Kumar',
      'XXXX-XXXX-4921', '+91 98765 43210', 'Koyambedu / Madurai',
      'Madurai', 'Tamil Nadu', 8.5, 'State Bank of India',
      '••••••••6719', 'SBIN0001234', 'VERIFIED', '2026-08-25',
      'FID-TN-2026-8813', 'VERIFIED'
    );

    // Officer
    const officerPass = bcrypt.hashSync('Officer@123', 10);
    insertUser.run('usr-officer-01', 'Dr. K. Arumugam (Market Director)', 'officer@demo.com', officerPass, 'officer');

    // Buyer
    const buyerPass = bcrypt.hashSync('Buyer@123', 10);
    insertUser.run('usr-buyer-01', 'AgriCorp Wholesale Traders', 'buyer@demo.com', buyerPass, 'buyer');

    // Kiosk
    const kioskPass = bcrypt.hashSync('Kiosk@123', 10);
    insertUser.run('usr-kiosk-01', 'Koyambedu Kiosk Operator', 'kiosk@demo.com', kioskPass, 'kiosk');

    console.log('Demo users seeded successfully.');
  }

  // 2. Seed Initial Tokens
  const tokenCount = db.prepare('SELECT COUNT(*) as count FROM tokens').get().count;
  if (tokenCount === 0) {
    console.log('Seeding initial tokens...');
    const insertToken = db.prepare(`
      INSERT INTO tokens (
        id, token_number, farmer_id, farmer_name, mobile,
        mandi_id, mandi_name, crop_id, crop_name,
        estimated_quantity, quantity_input, unit, quantity_kg, quantity_mt,
        vehicle_type, vehicle_number, booking_date, time_slot,
        status, dock_assigned, moisture_percent, quality_grade,
        gross_weight_kg, tare_weight_kg, net_weight_kg,
        total_payout_amount, utr_number, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertToken.run(
      'TKN-8812', 101, 'FAR-2026-8812', 'Ramesh Singh Kumar', '+91 98765 43210',
      'MND-01', 'Koyambedu Wholesale Market Complex', 'PADDY_PONNI', 'Ponni Paddy / Rice (Grade A)',
      65, 65, 'QUINTAL', 6500, 6.5,
      'TRACTOR_TROLLEY', 'TN-57-AB-4921', '2026-08-28', '09:00 AM - 10:00 AM',
      'QUALITY_CHECK', 'Dock 2', 12.8, 'Grade A Approved',
      7850, 1350, 6500,
      149500, 'TXN-SBI-20260828-99412',
      JSON.stringify({
        gateEntryTime: '08:45 AM',
        qrCodeText: 'TOKEN:101|FAR:FAR-2026-8812|MND:MND-01|DATE:2026-08-28'
      })
    );
  }

  // 3. Seed Initial Stockyard Bookings
  const stockyardCount = db.prepare('SELECT COUNT(*) as count FROM stockyard_bookings').get().count;
  if (stockyardCount === 0) {
    console.log('Seeding initial stockyard bookings...');
    const insertStockyard = db.prepare(`
      INSERT INTO stockyard_bookings (
        id, facility_id, facility_name, farmer_id, farmer_name,
        crop_id, crop_name, quantity_mt, quantity_kg,
        duration_days, daily_rate_per_mt, total_fee,
        start_date, end_date, status, assigned_bay,
        receipt_qr_text, last_inspected_temp, last_inspected_humidity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStockyard.run(
      'SYB-901', 'STK-01', 'Uzhavar Climate Grain Silos & Warehouse', 'FAR-2026-8812', 'Ramesh Singh Kumar',
      'WHEAT', 'Sharbati Wheat (Grade A)', 15, 15000,
      30, 25, 11250,
      '2026-08-20', '2026-09-19', 'STORED', 'Silo Bay B-04',
      'STK:STK-01|BAY:B-04|MT:15|FAR:FAR-2026-8812', 21.5, 48
    );
  }

  // 4. Seed Transporters
  const transporterCount = db.prepare('SELECT COUNT(*) as count FROM transporters').get().count;
  if (transporterCount === 0) {
    console.log('Seeding initial transporters...');
    const insertTransporter = db.prepare(`
      INSERT INTO transporters (id, name, phone, vehicle_type, vehicle_number, capacity_kg, is_available, current_location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertTransporter.run('TRP-101', 'Koyambedu Agri Logistics Co.', '+91 98400 11223', 'TRACTOR_TROLLEY', 'TN-57-AB-4921', 10000, 1, 'Koyambedu Hub');
    insertTransporter.run('TRP-102', 'Madurai Agro Freight Services', '+91 98400 33445', 'MINI_TRUCK', 'TN-58-XY-8812', 3500, 1, 'Mattuthavani Yard');
    insertTransporter.run('TRP-103', 'Tamil Nadu Farmers Transport Union', '+91 98400 55667', 'HEAVY_TRUCK', 'TN-37-CZ-9910', 25000, 1, 'Erode APMC Market');
    insertTransporter.run('TRP-104', 'Cauvery Delta Express Logistics', '+91 98400 77889', 'TRACTOR_TROLLEY', 'TN-49-BT-1234', 12000, 1, 'Thanjavur Paddy Complex');
  }

  // 5. Seed Initial Logistics Requests
  const logisticsCount = db.prepare('SELECT COUNT(*) as count FROM logistics_requests').get().count;
  if (logisticsCount === 0) {
    console.log('Seeding initial logistics requests...');
    const insertLogistics = db.prepare(`
      INSERT INTO logistics_requests (
        id, farmer_id, farmer_name, mobile, booking_id, crop_id, crop_name,
        pickup_location, drop_location, vehicle_type, weight_kg, status,
        transporter_id, transporter_name, transporter_phone, vehicle_number,
        estimated_cost, distance_km
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertLogistics.run(
      'LOG-801', 'FAR-2026-8812', 'Ramesh Singh Kumar', '+91 98765 43210',
      'TKN-8812', 'PADDY_PONNI', 'Ponni Paddy / Rice (Grade A)',
      'Melur Village, Madurai', 'Koyambedu Wholesale Market Complex',
      'TRACTOR_TROLLEY', 6500, 'IN_TRANSIT',
      'TRP-101', 'Koyambedu Agri Logistics Co.', '+91 98400 11223', 'TN-57-AB-4921',
      3250, 42.5
    );
  }

  // 6. Seed Government Schemes
  const schemeCount = db.prepare('SELECT COUNT(*) as count FROM govt_schemes').get().count;
  if (schemeCount === 0) {
    console.log('Seeding government agricultural schemes...');
    const insertScheme = db.prepare(`
      INSERT INTO govt_schemes (id, title, description, eligibility, benefit_amount, category, state, official_link)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertScheme.run(
      'SCH-01',
      'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
      'Central Sector scheme providing income support to landholding farmers to procure agricultural inputs and ensure proper crop yield.',
      'All landholding farmer families with cultivable land in their names (subject to exclusion criteria).',
      '₹6,000 per year in 3 equal installments of ₹2,000 directly into Aadhaar-seeded bank accounts.',
      'Direct Income Support',
      'All India',
      'https://pmkisan.gov.in/'
    );

    insertScheme.run(
      'SCH-02',
      'PMFBY (Pradhan Mantri Fasal Bima Yojana)',
      'Comprehensive crop insurance against non-preventable natural risks, drought, pests, and post-harvest losses.',
      'Farmers growing notified crops in notified areas (both loanee and non-loanee farmers).',
      'Max premium paid by farmer is 1.5% for Rabi, 2% for Kharif, 5% for commercial crops. Balance subsidized by Govt.',
      'Crop Insurance',
      'All India / Tamil Nadu',
      'https://pmfby.gov.in/'
    );

    insertScheme.run(
      'SCH-03',
      'Kisan Credit Card (KCC) Scheme',
      'Provides flexible, low-interest institutional credit to farmers for crop cultivation, post-harvest expenses, and allied activities.',
      'Individual farmers, joint borrowers, tenant farmers, sharecroppers, and Self Help Groups (SHGs).',
      'Credit limit up to ₹3 Lakhs at concessional 4% effective interest rate (with 3% prompt repayment subvention).',
      'Credit & Financing',
      'All India',
      'https://www.myscheme.gov.in/schemes/kcc'
    );

    insertScheme.run(
      'SCH-04',
      'Soil Health Card Scheme',
      'Free testing of soil samples across farm holdings with customized crop-wise nutrient and fertilizer recommendations.',
      'All agricultural landowners and cultivators across rural districts.',
      'Free biennial soil test report detailing 12 macro/micro-nutrient parameters and corrective dosages.',
      'Nutrient Management',
      'All India',
      'https://soilhealth.dac.gov.in/'
    );

    insertScheme.run(
      'SCH-05',
      'e-NAM (National Agriculture Market)',
      'Pan-India electronic trading portal networking existing APMC mandis to create a unified national market for commodities.',
      'Registered farmers, licensed wholesale traders, commission agents, and FPOs.',
      'Zero middleman exploitation, transparent electronic bidding, and direct bank payout settlement.',
      'Digital Trading Platform',
      'All India / Tamil Nadu',
      'https://enam.gov.in/'
    );

    insertScheme.run(
      'SCH-06',
      'PM-KUSUM (Solar Agricultural Pumps & Power)',
      'Solarization of agricultural water pumps and installation of solar power plants on barren farm lands.',
      'Individual farmers, farmer groups, cooperatives, and Panchayats.',
      'Up to 60% subsidy (30% Central + 30% State) for standalone solar pumps; extra income from selling power to DISCOMs.',
      'Renewable Energy & Irrigation',
      'All India / Tamil Nadu',
      'https://pmkusum.mnre.gov.in/'
    );

    insertScheme.run(
      'SCH-07',
      'Sub-Mission on Agricultural Mechanization (SMAM)',
      'Promotes farm mechanization by offering financial assistance for purchasing agricultural equipment and setting up CHCs.',
      'Small and marginal farmers, SC/ST farmers, women farmers, and Custom Hiring Centres (CHCs).',
      '40% to 80% financial subsidy on agricultural machinery (tractors, rotavators, harvesters, drones).',
      'Farm Machinery Subsidy',
      'All India / Tamil Nadu',
      'https://agrimachinery.nic.in/'
    );

    insertScheme.run(
      'SCH-08',
      'Rashtriya Krishi Vikas Yojana (RKVY-RAFTAAR)',
      'Strengthening agriculture infrastructure, post-harvest logistics, value chain creation, and agri-business incubation.',
      'Farmers, Farmer Producer Organizations (FPOs), and rural agri-startups.',
      'Grants up to ₹5 Lakhs for ideation stage and up to ₹25 Lakhs for seed-stage agri startups.',
      'Agri-Entrepreneurship',
      'All India / Tamil Nadu',
      'https://rkvy.nic.in/'
    );
  }
}

module.exports = { seedDatabase };
