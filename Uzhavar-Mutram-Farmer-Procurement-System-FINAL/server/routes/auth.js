const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, JWT_SECRET, JWT_EXPIRES_IN } = require('../middleware/auth');

const router = express.Router();
const OFFICER_REGISTRATION_KEY = process.env.OFFICER_REGISTRATION_KEY || 'TN-GOV-OFFICER-2026';

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { credential, password } = req.body;
    if (!credential || !password) {
      return res.status(400).json({
        success: false,
        message: 'Credential and password are required.'
      });
    }

    const trimmedCred = credential.trim();
    const user = db.prepare(`
      SELECT id, full_name, credential, password_hash, role
      FROM users
      WHERE LOWER(TRIM(credential)) = LOWER(?)
    `).get(trimmedCred);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        credential: user.credential,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Authentication server error.'
    });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const {
      fullName,
      full_name,
      credential,
      password,
      confirmPassword,
      role = 'farmer',
      adminPasskey,
      // Farmer-specific fields
      mobile,
      village,
      district,
      state,
      landAcres,
      aadhaar,
      bankName,
      accountNo,
      ifsc,
      // Buyer-specific fields
      companyName,
      gstin,
      tradeLicense,
      phone,
      address
    } = req.body;

    const cleanFullName = (fullName || full_name || '').trim();
    const cleanCredential = (credential || '').trim();

    // 1. Validate required fields
    if (!cleanFullName || cleanFullName.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Full legal name is required (minimum 3 characters).'
      });
    }

    if (!cleanCredential || cleanCredential.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Valid email or login credential is required.'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.'
      });
    }

    // 2. Validate role & security restrictions
    let targetRole = (role || 'farmer').toLowerCase().trim();
    if (targetRole === 'admin') targetRole = 'officer';

    if (targetRole === 'kiosk') {
      return res.status(403).json({
        success: false,
        message: 'Kiosk display accounts are system accounts and cannot be registered publicly.'
      });
    }

    const allowedPublicRoles = ['farmer', 'buyer'];
    if (targetRole === 'officer') {
      // Require authorized officer passkey to prevent arbitrary privilege escalation
      if (!adminPasskey || adminPasskey.trim() !== OFFICER_REGISTRATION_KEY) {
        return res.status(403).json({
          success: false,
          message: 'Invalid Officer/Admin Authorization Passkey. Only authorized market personnel can register Officer accounts.'
        });
      }
    } else if (!allowedPublicRoles.includes(targetRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role '${targetRole}'. Permitted roles: farmer, buyer.`
      });
    }

    // 3. Check duplicate credential
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(TRIM(credential)) = LOWER(?)').get(cleanCredential);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this credential already exists'
      });
    }

    // 4. Hash password securely
    const userId = 'usr-' + crypto.randomUUID().substring(0, 8);
    const passwordHash = bcrypt.hashSync(password, 10);

    // 5. Atomic database transaction
    const registerTransaction = db.transaction(() => {
      // Insert into users
      db.prepare(`
        INSERT INTO users (id, full_name, credential, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, cleanFullName, cleanCredential, passwordHash, targetRole);

      // Create role-specific profile
      if (targetRole === 'farmer') {
        const profileId = 'FAR-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
        const farmerMobile = mobile || (cleanCredential.startsWith('+') || /^\d+$/.test(cleanCredential) ? cleanCredential : '+91 98765 43210');
        db.prepare(`
          INSERT INTO farmer_profiles (
            id, user_id, name, aadhaar, mobile, village, district, state,
            land_acres, bank_name, account_no, ifsc, ekyc_status, verified_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          profileId, userId, cleanFullName,
          aadhaar || ('XXXX-XXXX-' + Math.floor(1000 + Math.random() * 9000)),
          farmerMobile,
          village || 'Tamil Nadu Regulated Market Network',
          district || 'Madurai',
          state || 'Tamil Nadu',
          parseFloat(landAcres) || 5.0,
          bankName || 'State Bank of India',
          accountNo || ('••••••••' + Math.floor(1000 + Math.random() * 9000)),
          ifsc || 'SBIN0001234',
          'VERIFIED',
          new Date().toISOString().split('T')[0]
        );
      } else if (targetRole === 'buyer') {
        const buyerProfileId = 'BUY-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
        db.prepare(`
          INSERT INTO buyer_profiles (
            id, user_id, company_name, gstin, trade_license, phone, address
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          buyerProfileId, userId,
          companyName || cleanFullName,
          gstin || ('33AAAAA' + Math.floor(1000 + Math.random() * 9000) + 'A1Z5'),
          tradeLicense || ('TN-TL-' + Math.floor(100000 + Math.random() * 900000)),
          phone || mobile || cleanCredential,
          address || 'Tamil Nadu Wholesale Agro Trade Complex'
        );
      }
    });

    registerTransaction();

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: userId,
        fullName: cleanFullName,
        credential: cleanCredential,
        role: targetRole
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({
      success: false,
      message: 'Database transaction failed during registration.'
    });
  }
});

module.exports = router;
