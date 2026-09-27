-- Uzhavar Mutram SQLite Schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  credential TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('farmer', 'officer', 'buyer', 'kiosk')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS buyer_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  gstin TEXT,
  trade_license TEXT,
  phone TEXT,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS farmer_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  aadhaar TEXT,
  mobile TEXT,
  village TEXT,
  district TEXT,
  state TEXT,
  land_acres REAL,
  bank_name TEXT,
  account_no TEXT,
  ifsc TEXT,
  ekyc_status TEXT DEFAULT 'VERIFIED',
  verified_date TEXT,
  farmer_id_agristack TEXT UNIQUE,
  agristack_verification_status TEXT DEFAULT 'PENDING' CHECK(agristack_verification_status IN ('PENDING', 'VERIFIED', 'FAILED')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  token_number INTEGER NOT NULL,
  farmer_id TEXT NOT NULL,
  farmer_name TEXT NOT NULL,
  mobile TEXT,
  mandi_id TEXT NOT NULL,
  mandi_name TEXT NOT NULL,
  crop_id TEXT NOT NULL,
  crop_name TEXT NOT NULL,
  estimated_quantity REAL,
  quantity_input REAL,
  unit TEXT,
  quantity_kg REAL,
  quantity_mt REAL,
  vehicle_type TEXT,
  vehicle_number TEXT,
  booking_date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  status TEXT DEFAULT 'BOOKED',
  dock_assigned TEXT,
  moisture_percent REAL,
  quality_grade TEXT,
  gross_weight_kg REAL,
  tare_weight_kg REAL,
  net_weight_kg REAL,
  total_payout_amount REAL,
  utr_number TEXT,
  raw_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stockyard_bookings (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  facility_name TEXT NOT NULL,
  farmer_id TEXT NOT NULL,
  farmer_name TEXT NOT NULL,
  crop_id TEXT NOT NULL,
  crop_name TEXT NOT NULL,
  quantity_mt REAL,
  quantity_kg REAL,
  duration_days INTEGER,
  daily_rate_per_mt REAL,
  total_fee REAL,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'STORED',
  assigned_bay TEXT,
  receipt_qr_text TEXT,
  last_inspected_temp REAL,
  last_inspected_humidity REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS logistics_requests (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  farmer_name TEXT,
  mobile TEXT,
  booking_id TEXT,
  crop_id TEXT,
  crop_name TEXT,
  pickup_location TEXT NOT NULL,
  drop_location TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  status TEXT DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')),
  transporter_id TEXT,
  transporter_name TEXT,
  transporter_phone TEXT,
  vehicle_number TEXT,
  estimated_cost REAL,
  distance_km REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transporters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  vehicle_number TEXT NOT NULL,
  capacity_kg REAL NOT NULL,
  is_available INTEGER DEFAULT 1,
  current_location TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS govt_schemes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  eligibility TEXT,
  benefit_amount TEXT,
  category TEXT,
  state TEXT DEFAULT 'All India / Tamil Nadu',
  official_link TEXT NOT NULL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
