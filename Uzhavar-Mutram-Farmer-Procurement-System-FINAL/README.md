# Uzhavar Mutram — Farmer Procurement & Smart Storage System

Production-ready Node.js + Express + SQLite backend connected to the responsive web frontend.

---

## ▲ Deploying to Vercel

1. Push this repository to GitHub (see git section below).
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Add the environment variable `JWT_SECRET` (any long random string) in **Project → Settings → Environment Variables**.
4. Deploy. `vercel.json` already routes `/api/*` to the Express server and serves the frontend + crop photos statically.

> Note: Vercel serverless filesystems are ephemeral, so the demo SQLite database resets between cold starts. For production durability, plug in a hosted database (e.g. Turso, Postgres) or enable Vercel Blob for persistence.

### Local Git Setup (first time)

```bash
git init
git add .
git commit -m "Uzhavar Mutram: earthy agricultural redesign + verified crop photo registry"
git branch -M main
git remote add origin https://github.com/<your-username>/uzhavar-mutram.git
git push -u origin main
```

---

## 🌾 Crop Photo Registry

The 12 crop photos shown in **Live Prices & Trends** are bundled in `public/images/crops/` and mapped 1:1 to crop details in `data.js` (`CROPS` array). Photos and details always stay in sync because the old startup hook that replaced them with remote stock photos was removed. To swap a photo, just replace the file (keep the same filename).

---

## 🚀 Quick Start (Portable Setup)

### 1. Requirements
- Node.js (v18.0 or higher recommended)
- npm (comes bundled with Node.js)

### 2. Environment Setup
Copy `.env.example` to `.env`:

**PowerShell:**
```powershell
Copy-Item .env.example .env
```

**Bash:**
```bash
cp .env.example .env
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start the Server
```bash
npm start
```
*The SQLite database (`server/db/uzhavar.sqlite`) and demo seed accounts are initialized automatically on first startup.*

### 5. Access the Web Portal
- Web Application: `http://localhost:4000`
- Health Endpoint: `http://localhost:4000/api/health`

---

## 🌟 Extended Features & Architecture

### 1. 🚛 Logistics & Transport Management
- **Database Schema**: `logistics_requests` and `transporters` tables.
- **Real-Time Progress Tracker**: 4-step state machine (`REQUESTED` ➔ `ASSIGNED` ➔ `IN_TRANSIT` ➔ `DELIVERED`).
- **WebSockets**: Pure Node.js WebSocket engine (`server/websocket.js`) broadcasting real-time updates to connected clients with automatic 10-second HTTP polling fallback.
- **Officer Dispatch Portal**: Officers can assign certified transport partners (e.g. TN Agri-Logistics Co, Kovai Rural Transport) and update shipment stages live.

### 2. 🏛️ Government Schemes Information Portal
- **Database Schema**: `govt_schemes` table.
- **Seeded Direct Portals**: 8 verified Indian government schemes (PM-KISAN, PMFBY, KCC, Soil Health Card, e-NAM, PM-KUSUM, SMAM, RKVY) with official links to `gov.in` portals (`https://pmkisan.gov.in`, `https://pmfby.gov.in`, `https://enam.gov.in`, etc.).
- **Officer Portal**: Role-restricted endpoint (`POST /api/schemes`) allowing agricultural officers to publish state/central schemes with eligibility & helpline contacts.

### 3. 📸 Real High-Quality Crop Photography
- **Stock API Integration**: Automated fetch script (`scripts/fetchCropImages.js`) supporting Unsplash and Pexels stock APIs.
- **Data Catalog**: Sourced high-resolution photography URLs in `data.js` for Paddy, Turmeric, Sugarcane, Cotton, Maize, Groundnut, Tapioca, Banana, Tomato, and Black Gram.
- **Attribution & Fallback**: Photographer name and license links embedded in client views, with SVG vector fallback asset at `public/images/crops/placeholder-crop.svg` for offline/error handling.

### 4. 🪪 Digital Farmer ID (AgriStack-Style) Verification
- **Verification Adapter**: Pluggable adapter service (`server/services/agristackVerification.js`) supporting state-wide registry verification (`AGRI-TN-xxxx-xxxx`) with Aadhaar last-4 checksum matching.
- **Access Gate Middleware**: `requireAgriStackVerified` middleware gating procurement slot bookings, storage allocations, and transport requests until verification is complete.
- **Officer Queue**: Agricultural officers can review pending farmer registries and manually verify or reject credentials.

---

## 🔑 Demo Accounts (Pre-configured in SQLite)

| Role | Credential / Email | Password | Access & Features |
| :--- | :--- | :--- | :--- |
| **🌾 Farmer** | `farmer@demo.com` | `Farmer@123` | Digital ID Verification, Slot Booking, Logistics Booking, Govt Schemes |
| **🛡️ Officer** | `officer@demo.com` | `Officer@123` | Dispatch Controller, AgriStack Queue Review, Quality Testing, Scheme Publishing |
| **🛒 Buyer** | `buyer@demo.com` | `Buyer@123` | Wholesale Bidding, Spot Auctions |
| **🖥️ Kiosk** | `kiosk@demo.com` | `Kiosk@123` | Public Mandi Live Display Board |

*(Mobile Login for Farmer: `+91 98765 43210` with password `Farmer@123`)*

---

## 🧪 Automated Testing

Run the full module test suite to verify AgriStack gating, logistics lifecycle, government schemes permissions, and server persistence:

```bash
node test-suite.js
```

Run baseline registration & authorization tests:
```bash
node test-runner.js
```

---

## 🛠️ Technology Stack
- **Frontend**: Vanilla HTML5, CSS3 (Modern dark-mode glassmorphism system), JavaScript SPA.
- **Backend**: Node.js, Express REST API, native WebSockets (`ws` protocol handler).
- **Database**: SQLite (`server/db/uzhavar.sqlite` via `better-sqlite3`).
- **Security**: JWT Authentication, bcrypt password hashing, role-based authorization.
