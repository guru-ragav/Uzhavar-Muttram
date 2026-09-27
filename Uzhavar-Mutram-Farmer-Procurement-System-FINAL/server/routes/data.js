const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { verifyFarmerId } = require('../services/agristackVerification');
const { broadcast } = require('../websocket');

const router = express.Router();

function getFarmerProfileByUserId(userId, fallbackName = 'Farmer') {
  let profile = db.prepare('SELECT * FROM farmer_profiles WHERE user_id = ?').get(userId);
  if (!profile) {
    const profileId = 'FAR-2026-' + Math.floor(1000 + Math.random() * 9000);
    const defaultAgristack = 'FID-TN-2026-' + Math.floor(1000 + Math.random() * 9000);
    db.prepare(`
      INSERT INTO farmer_profiles (
        id, user_id, name, aadhaar, mobile, village, district, state,
        land_acres, bank_name, account_no, ifsc, ekyc_status, verified_date,
        farmer_id_agristack, agristack_verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      profileId, userId, fallbackName,
      'XXXX-XXXX-4921', '+91 98765 43210', 'Koyambedu / Madurai',
      'Madurai', 'Tamil Nadu', 8.5, 'State Bank of India',
      '••••••••6719', 'SBIN0001234', 'VERIFIED', '2026-08-25',
      defaultAgristack, 'VERIFIED'
    );
    profile = db.prepare('SELECT * FROM farmer_profiles WHERE user_id = ?').get(userId);
  }
  return {
    id: profile.id,
    userId: profile.user_id,
    name: profile.name,
    aadhaar: profile.aadhaar,
    mobile: profile.mobile,
    village: profile.village,
    district: profile.district,
    state: profile.state,
    landAcres: profile.land_acres,
    bankName: profile.bank_name,
    accountNo: profile.account_no,
    ifsc: profile.ifsc,
    ekycStatus: profile.ekyc_status,
    verifiedDate: profile.verified_date,
    farmerIdAgristack: profile.farmer_id_agristack,
    agristackVerificationStatus: profile.agristack_verification_status || 'PENDING'
  };
}

function requireAgriStackVerified(req, res, next) {
  if (req.user.role !== 'farmer') return next();
  const profile = getFarmerProfileByUserId(req.user.id, req.user.fullName);
  if (profile.agristackVerificationStatus !== 'VERIFIED') {
    return res.status(403).json({
      success: false,
      verificationRequired: true,
      message: 'Digital Farmer ID (AgriStack) verification is required before using selling slot booking, stockyard, or logistics services.'
    });
  }
  next();
}

function formatLogisticsRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    farmerId: row.farmer_id,
    farmerName: row.farmer_name,
    mobile: row.mobile,
    bookingId: row.booking_id,
    cropId: row.crop_id,
    cropName: row.crop_name,
    pickupLocation: row.pickup_location,
    dropLocation: row.drop_location,
    vehicleType: row.vehicle_type,
    weightKg: row.weight_kg,
    status: row.status,
    transporterId: row.transporter_id,
    transporterName: row.transporter_name,
    transporterPhone: row.transporter_phone,
    vehicleNumber: row.vehicle_number,
    estimatedCost: row.estimated_cost,
    distanceKm: row.distance_km,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function formatTransporterRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    vehicleType: row.vehicle_type,
    vehicleNumber: row.vehicle_number,
    capacityKg: row.capacity_kg,
    isAvailable: Boolean(row.is_available),
    currentLocation: row.current_location,
    createdAt: row.created_at
  };
}

function formatSchemeRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eligibility: row.eligibility,
    benefitAmount: row.benefit_amount,
    category: row.category,
    state: row.state,
    officialLink: row.official_link,
    lastUpdated: row.last_updated
  };
}

function formatTokenRecord(row) {
  if (!row) return null;
  let parsedRaw = {};
  if (row.raw_json) {
    try {
      parsedRaw = JSON.parse(row.raw_json);
    } catch (e) {}
  }

  return {
    id: row.id,
    tokenNumber: row.token_number,
    tokenNo: row.token_number,
    farmerId: row.farmer_id,
    farmerName: row.farmer_name,
    mobile: row.mobile,
    mandiId: row.mandi_id,
    mandiName: row.mandi_name,
    cropId: row.crop_id,
    cropName: row.crop_name,
    estimatedQuantity: row.estimated_quantity,
    quantityInput: row.quantity_input || row.estimated_quantity,
    unit: row.unit || 'QUINTAL',
    quantityKg: row.quantity_kg,
    quantityMT: row.quantity_mt,
    vehicleType: row.vehicle_type,
    vehicleNumber: row.vehicle_number,
    vehicleRegNo: row.vehicle_number,
    bookingDate: row.booking_date,
    timeSlot: row.time_slot,
    status: row.status,
    dockAssigned: row.dock_assigned,
    assignedScaleDock: row.dock_assigned,
    moisturePercent: row.moisture_percent,
    qualityGrade: row.quality_grade,
    grossWeightKg: row.gross_weight_kg,
    weightGrossKg: row.gross_weight_kg,
    tareWeightKg: row.tare_weight_kg,
    weightTareKg: row.tare_weight_kg,
    netWeightKg: row.net_weight_kg,
    weightNetKg: row.net_weight_kg,
    netQuantityMT: row.net_weight_kg ? row.net_weight_kg / 1000 : null,
    totalPayoutAmount: row.total_payout_amount,
    totalPaymentAmount: row.total_payout_amount,
    utrNumber: row.utr_number,
    paymentTxnId: row.utr_number,
    history: parsedRaw.history || [
      { status: row.status, timestamp: row.booking_date, note: `Slot at ${row.mandi_name}` }
    ],
    qrCodeText: parsedRaw.qrCodeText || `TOKEN:${row.token_number}|FAR:${row.farmer_id}|MND:${row.mandi_id}|DATE:${row.booking_date}`,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function formatStockyardRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    facilityId: row.facility_id,
    facilityName: row.facility_name,
    farmerId: row.farmer_id,
    farmerName: row.farmer_name,
    cropId: row.crop_id,
    cropName: row.crop_name,
    quantityMT: row.quantity_mt,
    quantityKg: row.quantity_kg,
    durationDays: row.duration_days,
    dailyRatePerMT: row.daily_rate_per_mt,
    totalFee: row.total_fee,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    assignedBay: row.assigned_bay,
    receiptQrText: row.receipt_qr_text,
    lastInspectedTemp: row.last_inspected_temp,
    lastInspectedHumidity: row.last_inspected_humidity,
    createdAt: row.created_at
  };
}

// ================= FARMER PROFILE & AGRISTACK ENDPOINTS =================

// GET /api/farmer/profile
router.get('/farmer/profile', requireAuth, requireRole('farmer'), (req, res) => {
  try {
    const profile = getFarmerProfileByUserId(req.user.id, req.user.fullName);
    return res.json({
      success: true,
      profile
    });
  } catch (err) {
    console.error('Error fetching farmer profile:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch farmer profile.' });
  }
});

// POST /api/farmer/verify-agristack (Verify Digital Farmer ID)
router.post('/farmer/verify-agristack', requireAuth, requireRole('farmer'), async (req, res) => {
  try {
    const { farmerId, name, dob } = req.body;
    const profile = getFarmerProfileByUserId(req.user.id, req.user.fullName);

    const verificationResult = await verifyFarmerId(farmerId || profile.farmerIdAgristack, name || profile.name, dob);

    if (verificationResult.success) {
      db.prepare(`
        UPDATE farmer_profiles
        SET farmer_id_agristack = ?, agristack_verification_status = 'VERIFIED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(verificationResult.farmerId, profile.id);

      const updatedProfile = getFarmerProfileByUserId(req.user.id, req.user.fullName);
      return res.json({
        success: true,
        status: 'VERIFIED',
        message: verificationResult.message,
        profile: updatedProfile
      });
    } else {
      db.prepare(`
        UPDATE farmer_profiles
        SET farmer_id_agristack = ?, agristack_verification_status = 'FAILED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(farmerId || profile.farmerIdAgristack || '', profile.id);

      return res.status(400).json({
        success: false,
        status: 'FAILED',
        message: verificationResult.message
      });
    }
  } catch (err) {
    console.error('AgriStack verification error:', err);
    return res.status(500).json({ success: false, message: 'AgriStack service connection error.' });
  }
});

// GET /api/officer/verification-queue (Officer Review Queue)
router.get('/officer/verification-queue', requireAuth, requireRole('officer'), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT fp.*, u.credential
      SELECT_END FROM farmer_profiles fp
      JOIN users u ON fp.user_id = u.id
      ORDER BY fp.created_at DESC
    `.replace('SELECT_END', '')).all();

    return res.json({
      success: true,
      profiles: rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        credential: r.credential,
        mobile: r.mobile,
        district: r.district,
        aadhaar: r.aadhaar,
        farmerIdAgristack: r.farmer_id_agristack,
        agristackVerificationStatus: r.agristack_verification_status || 'PENDING',
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    console.error('Error fetching verification queue:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch verification queue.' });
  }
});

// PATCH /api/officer/verify-farmer/:profileId (Officer Manual Override)
router.patch('/officer/verify-farmer/:profileId', requireAuth, requireRole('officer'), (req, res) => {
  try {
    const { profileId } = req.params;
    const { status = 'VERIFIED', farmerIdAgristack } = req.body;

    const existing = db.prepare('SELECT * FROM farmer_profiles WHERE id = ?').get(profileId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Farmer profile not found.' });
    }

    const agristackId = farmerIdAgristack || existing.farmer_id_agristack || ('FID-OVERRIDE-' + Math.floor(1000 + Math.random() * 9000));

    db.prepare(`
      UPDATE farmer_profiles
      SET agristack_verification_status = ?, farmer_id_agristack = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, agristackId, profileId);

    return res.json({
      success: true,
      message: `Farmer ID status updated to ${status} by Market Officer.`,
      profileId,
      status,
      farmerIdAgristack: agristackId
    });
  } catch (err) {
    console.error('Officer verification override error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update farmer verification status.' });
  }
});

// PATCH /api/farmer/profile
router.patch('/farmer/profile', requireAuth, requireRole('farmer'), (req, res) => {
  try {
    const existing = getFarmerProfileByUserId(req.user.id, req.user.fullName);
    const {
      name = existing.name,
      aadhaar = existing.aadhaar,
      mobile = existing.mobile,
      village = existing.village,
      district = existing.district,
      state = existing.state,
      landAcres = existing.landAcres,
      bankName = existing.bankName,
      accountNo = existing.accountNo,
      ifsc = existing.ifsc,
      ekycStatus = existing.ekycStatus,
      farmerIdAgristack = existing.farmerIdAgristack
    } = req.body;

    db.prepare(`
      UPDATE farmer_profiles
      SET name = ?, aadhaar = ?, mobile = ?, village = ?, district = ?, state = ?,
          land_acres = ?, bank_name = ?, account_no = ?, ifsc = ?, ekyc_status = ?,
          farmer_id_agristack = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name, aadhaar, mobile, village, district, state,
      landAcres, bankName, accountNo, ifsc, ekycStatus,
      farmerIdAgristack, existing.id
    );

    if (name && name !== req.user.fullName) {
      db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(name, req.user.id);
    }

    const updated = getFarmerProfileByUserId(req.user.id, name);
    return res.json({
      success: true,
      profile: updated
    });
  } catch (err) {
    console.error('Error updating farmer profile:', err);
    return res.status(500).json({ success: false, message: 'Failed to update farmer profile.' });
  }
});

// ================= BOOKING / TOKEN ENDPOINTS =================

// POST /api/bookings (Authenticated Farmer with AgriStack Verification)
router.post('/bookings', requireAuth, requireRole('farmer'), requireAgriStackVerified, (req, res) => {
  try {
    const profile = getFarmerProfileByUserId(req.user.id, req.user.fullName);
    const {
      mandiId, mandiName, cropId, cropName,
      quantityInput, unit = 'QUINTAL', quantityKg, quantityMT, estimatedQuantity,
      vehicleType, vehicleNumber, bookingDate, timeSlot,
      baseRatePerQuintal = 2300, deductionAmount = 0
    } = req.body;

    if (!mandiId || !cropId || !bookingDate || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: 'Missing required booking details (mandiId, cropId, bookingDate, timeSlot).'
      });
    }

    const maxTokenRow = db.prepare('SELECT MAX(token_number) as maxToken FROM tokens').get();
    const tokenSeq = (maxTokenRow && maxTokenRow.maxToken) ? maxTokenRow.maxToken + 1 : 101;
    const tokenId = `TKN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const estQty = estimatedQuantity || (quantityKg ? quantityKg / 100 : (quantityInput || 0));
    const finalKg = quantityKg || (estQty * 100);
    const finalMT = quantityMT || (finalKg / 1000);

    const history = [
      {
        status: 'BOOKED',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        note: `Selling slot confirmed at ${mandiName || 'Tamil Nadu Regulated Market Network'}`
      }
    ];

    const rawJson = JSON.stringify({
      baseRatePerQuintal,
      deductionAmount,
      history,
      qrCodeText: `TOKEN:${tokenSeq}|FAR:${profile.id}|MND:${mandiId}|DATE:${bookingDate}`
    });

    db.prepare(`
      INSERT INTO tokens (
        id, token_number, farmer_id, farmer_name, mobile,
        mandi_id, mandi_name, crop_id, crop_name,
        estimated_quantity, quantity_input, unit, quantity_kg, quantity_mt,
        vehicle_type, vehicle_number, booking_date, time_slot,
        status, dock_assigned, moisture_percent, quality_grade,
        gross_weight_kg, tare_weight_kg, net_weight_kg,
        total_payout_amount, utr_number, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tokenId, tokenSeq, profile.id, profile.name, profile.mobile,
      mandiId, mandiName || 'Mandi Centre', cropId, cropName || 'Agricultural Produce',
      estQty, quantityInput || estQty, unit, finalKg, finalMT,
      vehicleType || 'TRACTOR_TROLLEY', vehicleNumber || '', bookingDate, timeSlot,
      'BOOKED', null, null, null,
      null, null, null,
      null, null, rawJson
    );

    const createdRow = db.prepare('SELECT * FROM tokens WHERE id = ?').get(tokenId);
    const formatted = formatTokenRecord(createdRow);
    broadcast('QUEUE_UPDATE', formatted);

    return res.status(201).json({
      success: true,
      booking: formatted
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    return res.status(500).json({ success: false, message: 'Failed to create booking.' });
  }
});

// GET /api/bookings/mine (Authenticated Farmer Only)
router.get('/bookings/mine', requireAuth, requireRole('farmer'), (req, res) => {
  try {
    const profile = getFarmerProfileByUserId(req.user.id, req.user.fullName);
    const rows = db.prepare(`
      SELECT * FROM tokens
      WHERE farmer_id = ? OR farmer_name = ?
      ORDER BY token_number DESC
    `).all(profile.id, profile.name);

    return res.json({
      success: true,
      bookings: rows.map(formatTokenRecord)
    });
  } catch (err) {
    console.error('Error fetching farmer bookings:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch farmer bookings.' });
  }
});

// GET /api/bookings (Officer or Kiosk)
router.get('/bookings', requireAuth, requireRole('officer', 'kiosk'), (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM tokens ORDER BY token_number DESC').all();
    return res.json({
      success: true,
      bookings: rows.map(formatTokenRecord)
    });
  } catch (err) {
    console.error('Error fetching all bookings:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch bookings.' });
  }
});

// PATCH /api/bookings/:id (Update token status, dock, weights, payouts)
router.patch('/bookings/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM tokens WHERE id = ? OR token_number = ?').get(id, parseInt(id) || -1);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    if (req.user.role === 'farmer') {
      const profile = getFarmerProfileByUserId(req.user.id, req.user.fullName);
      if (existing.farmer_id !== profile.id && existing.farmer_name !== profile.name) {
        return res.status(403).json({ success: false, message: 'Forbidden. You can only update your own bookings.' });
      }
    }

    const {
      status = existing.status,
      dockAssigned = existing.dock_assigned,
      moisturePercent = existing.moisture_percent,
      qualityGrade = existing.quality_grade,
      grossWeightKg = existing.gross_weight_kg,
      tareWeightKg = existing.tare_weight_kg,
      netWeightKg = existing.net_weight_kg,
      totalPayoutAmount = existing.total_payout_amount,
      utrNumber = existing.utr_number,
      vehicleNumber = existing.vehicle_number,
      historyEntry
    } = req.body;

    let parsedRaw = {};
    if (existing.raw_json) {
      try { parsedRaw = JSON.parse(existing.raw_json); } catch (e) {}
    }
    if (!parsedRaw.history) parsedRaw.history = [];
    if (historyEntry) {
      parsedRaw.history.unshift(historyEntry);
    } else if (status !== existing.status) {
      parsedRaw.history.unshift({
        status,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        note: `Status updated to ${status}`
      });
    }

    db.prepare(`
      UPDATE tokens
      SET status = ?, dock_assigned = ?, moisture_percent = ?, quality_grade = ?,
          gross_weight_kg = ?, tare_weight_kg = ?, net_weight_kg = ?,
          total_payout_amount = ?, utr_number = ?, vehicle_number = ?,
          raw_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      status, dockAssigned, moisturePercent, qualityGrade,
      grossWeightKg, tareWeightKg, netWeightKg,
      totalPayoutAmount, utrNumber, vehicleNumber,
      JSON.stringify(parsedRaw), existing.id
    );

    const updated = db.prepare('SELECT * FROM tokens WHERE id = ?').get(existing.id);
    const formatted = formatTokenRecord(updated);
    broadcast('QUEUE_UPDATE', formatted);

    return res.json({
      success: true,
      booking: formatted
    });
  } catch (err) {
    console.error('Error updating booking:', err);
    return res.status(500).json({ success: false, message: 'Failed to update booking.' });
  }
});

// ================= STOCKYARD BOOKING ENDPOINTS =================

// POST /api/stockyard-bookings (Authenticated Farmer with AgriStack Verification)
router.post('/stockyard-bookings', requireAuth, requireRole('farmer'), requireAgriStackVerified, (req, res) => {
  try {
    const profile = getFarmerProfileByUserId(req.user.id, req.user.fullName);
    const {
      facilityId, facilityName, cropId, cropName,
      quantityMT, durationDays, dailyRatePerMT, startDate
    } = req.body;

    const id = `SYB-${Math.floor(900 + Math.random() * 100)}`;
    const bay = `Silo Bay ${String.fromCharCode(65 + Math.floor(Math.random() * 6))}-0${Math.floor(1 + Math.random() * 9)}`;
    const totalFee = Math.round((quantityMT || 1) * (durationDays || 30) * (dailyRatePerMT || 25));

    db.prepare(`
      INSERT INTO stockyard_bookings (
        id, facility_id, facility_name, farmer_id, farmer_name,
        crop_id, crop_name, quantity_mt, quantity_kg,
        duration_days, daily_rate_per_mt, total_fee,
        start_date, end_date, status, assigned_bay,
        receipt_qr_text, last_inspected_temp, last_inspected_humidity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, facilityId, facilityName, profile.id, profile.name,
      cropId, cropName, quantityMT, (quantityMT || 0) * 1000,
      durationDays, dailyRatePerMT, totalFee,
      startDate, startDate, 'STORED', bay,
      `STK:${facilityId}|BAY:${bay}|MT:${quantityMT}|FAR:${profile.id}`,
      21.5, 48.0
    );

    const row = db.prepare('SELECT * FROM stockyard_bookings WHERE id = ?').get(id);
    const formatted = formatStockyardRecord(row);
    broadcast('STOCKYARD_UPDATE', formatted);

    return res.status(201).json({
      success: true,
      booking: formatted
    });
  } catch (err) {
    console.error('Error saving stockyard booking:', err);
    return res.status(500).json({ success: false, message: 'Failed to create stockyard booking.' });
  }
});

// GET /api/stockyard-bookings/mine
router.get('/stockyard-bookings/mine', requireAuth, requireRole('farmer'), (req, res) => {
  try {
    const profile = getFarmerProfileByUserId(req.user.id, req.user.fullName);
    const rows = db.prepare(`
      SELECT * FROM stockyard_bookings
      WHERE farmer_id = ? OR farmer_name = ?
      ORDER BY created_at DESC
    `).all(profile.id, profile.name);

    return res.json({
      success: true,
      bookings: rows.map(formatStockyardRecord)
    });
  } catch (err) {
    console.error('Error fetching stockyard bookings:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch stockyard bookings.' });
  }
});

// ================= LOGISTICS ENDPOINTS =================

// POST /api/logistics (Farmer Create Logistics Request)
router.post('/logistics', requireAuth, requireRole('farmer'), requireAgriStackVerified, (req, res) => {
  try {
    const profile = getFarmerProfileByUserId(req.user.id, req.user.fullName);
    const {
      bookingId, cropId, cropName,
      pickupLocation, dropLocation, vehicleType = 'TRACTOR_TROLLEY',
      weightKg = 5000, distanceKm = 25
    } = req.body;

    if (!pickupLocation || !dropLocation) {
      return res.status(400).json({
        success: false,
        message: 'Pickup location and drop location/mandi are required.'
      });
    }

    const requestId = `LOG-${Date.now().toString().slice(-6)}`;
    const estimatedCost = Math.round(500 + (distanceKm || 25) * 45 + (weightKg / 1000) * 120);

    // Find an available transporter matching vehicle type if possible
    const availableTransporter = db.prepare(`
      SELECT * FROM transporters
      WHERE is_available = 1
      ORDER BY RANDOM()
      LIMIT 1
    `).get();

    const status = availableTransporter ? 'ASSIGNED' : 'REQUESTED';
    const transporterId = availableTransporter ? availableTransporter.id : null;
    const transporterName = availableTransporter ? availableTransporter.name : null;
    const transporterPhone = availableTransporter ? availableTransporter.phone : null;
    const vehicleNumber = availableTransporter ? availableTransporter.vehicle_number : null;

    db.prepare(`
      INSERT INTO logistics_requests (
        id, farmer_id, farmer_name, mobile, booking_id, crop_id, crop_name,
        pickup_location, drop_location, vehicle_type, weight_kg, status,
        transporter_id, transporter_name, transporter_phone, vehicle_number,
        estimated_cost, distance_km
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      requestId, profile.id, profile.name, profile.mobile,
      bookingId || null, cropId || null, cropName || 'Produce Cargo',
      pickupLocation, dropLocation, vehicleType, weightKg, status,
      transporterId, transporterName, transporterPhone, vehicleNumber,
      estimatedCost, distanceKm
    );

    const created = db.prepare('SELECT * FROM logistics_requests WHERE id = ?').get(requestId);
    const formatted = formatLogisticsRecord(created);
    broadcast('LOGISTICS_UPDATE', formatted);

    return res.status(201).json({
      success: true,
      request: formatted
    });
  } catch (err) {
    console.error('Error creating logistics request:', err);
    return res.status(500).json({ success: false, message: 'Failed to create logistics request.' });
  }
});

// GET /api/logistics/mine (Farmer's Own Requests)
router.get('/logistics/mine', requireAuth, requireRole('farmer'), (req, res) => {
  try {
    const profile = getFarmerProfileByUserId(req.user.id, req.user.fullName);
    const rows = db.prepare(`
      SELECT * FROM logistics_requests
      WHERE farmer_id = ? OR farmer_name = ?
      ORDER BY created_at DESC
    `).all(profile.id, profile.name);

    return res.json({
      success: true,
      requests: rows.map(formatLogisticsRecord)
    });
  } catch (err) {
    console.error('Error fetching farmer logistics requests:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch logistics requests.' });
  }
});

// GET /api/logistics (Officer / Transporter View All)
router.get('/logistics', requireAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM logistics_requests ORDER BY created_at DESC').all();
    return res.json({
      success: true,
      requests: rows.map(formatLogisticsRecord)
    });
  } catch (err) {
    console.error('Error fetching all logistics requests:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch logistics requests.' });
  }
});

// PATCH /api/logistics/:id (Update Logistics Request Status & Assign Vehicle)
router.patch('/logistics/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM logistics_requests WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Logistics request not found.' });
    }

    const {
      status = existing.status,
      transporterId = existing.transporter_id,
      transporterName = existing.transporter_name,
      transporterPhone = existing.transporter_phone,
      vehicleNumber = existing.vehicle_number
    } = req.body;

    db.prepare(`
      UPDATE logistics_requests
      SET status = ?, transporter_id = ?, transporter_name = ?,
          transporter_phone = ?, vehicle_number = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, transporterId, transporterName, transporterPhone, vehicleNumber, existing.id);

    const updated = db.prepare('SELECT * FROM logistics_requests WHERE id = ?').get(existing.id);
    const formatted = formatLogisticsRecord(updated);
    broadcast('LOGISTICS_UPDATE', formatted);

    return res.json({
      success: true,
      request: formatted
    });
  } catch (err) {
    console.error('Error updating logistics request:', err);
    return res.status(500).json({ success: false, message: 'Failed to update logistics request.' });
  }
});

// GET /api/transporters (List Fleet Transporters)
router.get('/transporters', requireAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM transporters ORDER BY name ASC').all();
    return res.json({
      success: true,
      transporters: rows.map(formatTransporterRecord)
    });
  } catch (err) {
    console.error('Error fetching transporters:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch transporters.' });
  }
});

// POST /api/transporters (Add Transporter - Officer Only)
router.post('/transporters', requireAuth, requireRole('officer'), (req, res) => {
  try {
    const { name, phone, vehicleType, vehicleNumber, capacityKg, currentLocation } = req.body;
    if (!name || !phone || !vehicleType || !vehicleNumber) {
      return res.status(400).json({ success: false, message: 'Name, phone, vehicle type and vehicle number are required.' });
    }

    const id = `TRP-${Math.floor(100 + Math.random() * 900)}`;
    db.prepare(`
      INSERT INTO transporters (id, name, phone, vehicle_type, vehicle_number, capacity_kg, is_available, current_location)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, name, phone, vehicleType, vehicleNumber, capacityKg || 10000, currentLocation || 'Central Hub');

    const created = db.prepare('SELECT * FROM transporters WHERE id = ?').get(id);
    return res.status(201).json({
      success: true,
      transporter: formatTransporterRecord(created)
    });
  } catch (err) {
    console.error('Error adding transporter:', err);
    return res.status(500).json({ success: false, message: 'Failed to add transporter.' });
  }
});

// ================= GOVERNMENT SCHEMES ENDPOINTS =================

// GET /api/schemes (Public / Authenticated - Read All Schemes)
router.get('/schemes', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM govt_schemes ORDER BY id ASC').all();
    return res.json({
      success: true,
      schemes: rows.map(formatSchemeRecord)
    });
  } catch (err) {
    console.error('Error fetching government schemes:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch government schemes.' });
  }
});

// POST /api/schemes (Add New Scheme - Officer Role Only)
router.post('/schemes', requireAuth, requireRole('officer'), (req, res) => {
  try {
    const { title, description, eligibility, benefitAmount, category, state, officialLink } = req.body;

    if (!title || !description || !officialLink) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and official URL link are required.'
      });
    }

    const id = `SCH-${Date.now().toString().slice(-4)}`;
    db.prepare(`
      INSERT INTO govt_schemes (id, title, description, eligibility, benefit_amount, category, state, official_link)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, title, description,
      eligibility || 'All eligible agricultural producers',
      benefitAmount || 'Financial & Subsidy Support',
      category || 'Agriculture Scheme',
      state || 'All India',
      officialLink
    );

    const created = db.prepare('SELECT * FROM govt_schemes WHERE id = ?').get(id);
    return res.status(201).json({
      success: true,
      scheme: formatSchemeRecord(created)
    });
  } catch (err) {
    console.error('Error adding government scheme:', err);
    return res.status(500).json({ success: false, message: 'Failed to add government scheme.' });
  }
});

// PATCH /api/schemes/:id (Update Scheme - Officer Role Only)
router.patch('/schemes/:id', requireAuth, requireRole('officer'), (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM govt_schemes WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Scheme not found.' });
    }

    const {
      title = existing.title,
      description = existing.description,
      eligibility = existing.eligibility,
      benefitAmount = existing.benefit_amount,
      category = existing.category,
      state = existing.state,
      officialLink = existing.official_link
    } = req.body;

    db.prepare(`
      UPDATE govt_schemes
      SET title = ?, description = ?, eligibility = ?, benefit_amount = ?,
          category = ?, state = ?, official_link = ?, last_updated = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, description, eligibility, benefitAmount, category, state, officialLink, existing.id);

    const updated = db.prepare('SELECT * FROM govt_schemes WHERE id = ?').get(existing.id);
    return res.json({
      success: true,
      scheme: formatSchemeRecord(updated)
    });
  } catch (err) {
    console.error('Error updating government scheme:', err);
    return res.status(500).json({ success: false, message: 'Failed to update government scheme.' });
  }
});

module.exports = router;
