const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { seedDatabase } = require('./seed');

const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'uzhavar.sqlite');
const db = new Database(dbPath);

// Enable WAL mode and foreign key constraints
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
}

// Perform safe DB migrations for existing databases
function runMigrations(db) {
  try {
    const tableInfo = db.prepare("PRAGMA table_info(farmer_profiles)").all();
    const columnNames = tableInfo.map(c => c.name);

    if (!columnNames.includes('farmer_id_agristack')) {
      db.prepare("ALTER TABLE farmer_profiles ADD COLUMN farmer_id_agristack TEXT").run();
    }
    if (!columnNames.includes('agristack_verification_status')) {
      db.prepare("ALTER TABLE farmer_profiles ADD COLUMN agristack_verification_status TEXT DEFAULT 'PENDING'").run();
    }
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

runMigrations(db);

// Seed required initial data
seedDatabase(db);

// NOTE: Crop photography is now bundled locally in public/images/crops and referenced
// directly from data.js. The old startup hook that rewrote data.js via the Unsplash
// fetcher was removed so bundled photos can never be overwritten or mismatched.
// scripts/fetchCropImages.js remains available to run manually if ever needed.

module.exports = db;
