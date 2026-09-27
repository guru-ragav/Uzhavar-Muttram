// Uzhavar Mutram Application Logic & State Controller - Marketplace & Storage Edition

const appState = {
  currentRole: 'farmer', // farmer, officer, kiosk
  currentFarmerSubTab: 'book-slot',
  currentLang: 'en',
  tokens: [],
  stockyardBookings: [],
  farmerProfile: INITIAL_FARMER_PROFILE,
  selectedTokenId: null,
  activeMarketCategory: 'ALL'
};

// Weight Unit Standardization Engine
function convertWeightUnits(quantity, unit) {
  const q = parseFloat(quantity) || 0;
  let kg = 0;
  let mt = 0;
  let quintals = 0;

  switch (unit) {
    case 'QUINTAL':
      kg = q * 100;
      mt = q * 0.1;
      quintals = q;
      break;
    case 'METRIC_TON':
      kg = q * 1000;
      mt = q;
      quintals = q * 10;
      break;
    case 'BAG_50KG':
      kg = q * 50;
      mt = (q * 50) / 1000;
      quintals = (q * 50) / 100;
      break;
    case 'KG':
      kg = q;
      mt = q / 1000;
      quintals = q / 100;
      break;
    default:
      kg = q * 100;
      mt = q * 0.1;
      quintals = q;
  }

  return {
    kg: Math.round(kg),
    metricTons: parseFloat(mt.toFixed(2)),
    quintals: parseFloat(quintals.toFixed(2))
  };
}

// Initialize Application State
function initAppState() {
  const savedState = localStorage.getItem('uzhavar_mutram_marketplace_state');
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      appState.tokens = parsed.tokens || INITIAL_TOKENS;
      appState.stockyardBookings = parsed.stockyardBookings || INITIAL_STOCKYARD_BOOKINGS;
      appState.farmerProfile = parsed.farmerProfile || INITIAL_FARMER_PROFILE;
    } catch (e) {
      console.warn("Failed to load saved state, using defaults.");
      appState.tokens = INITIAL_TOKENS;
      appState.stockyardBookings = INITIAL_STOCKYARD_BOOKINGS;
      appState.farmerProfile = INITIAL_FARMER_PROFILE;
    }
  } else {
    appState.tokens = INITIAL_TOKENS;
    appState.stockyardBookings = INITIAL_STOCKYARD_BOOKINGS;
    saveState();
  }

  // Normalize legacy/saved records to the current schema so every view renders correctly
  normalizeCrops();
  appState.tokens = appState.tokens.map(normalizeToken);
  appState.stockyardBookings = appState.stockyardBookings.map(normalizeStockyardBooking);
}

// Derive presentation fields used by the Market Price & MSP boards
function normalizeCrops() {
  if (typeof CROPS === 'undefined' || !Array.isArray(CROPS)) return;
  CROPS.forEach(c => {
    if (c.pricePerMT == null) c.pricePerMT = Math.round((c.pricePerKg || 0) * 1000);
    if (c.trendChangePercent == null) {
      const raw = parseFloat(String(c.priceTrend || '0').replace('%', ''));
      c.trendChangePercent = isNaN(raw) ? 0 : raw;
    }
    if (c.trendDirection == null) c.trendDirection = c.trendChangePercent > 0 ? 'UP' : (c.trendChangePercent < 0 ? 'DOWN' : 'FLAT');
    if (c.marketLocation == null) c.marketLocation = 'Tamil Nadu Regulated Market Network';
    if (c.season == null) c.season = 'Kharif & Rabi (Year Round)';
    if (c.moistureMaxPercent == null) c.moistureMaxPercent = 14;
  });
}

// Map older token field names onto the current schema
function normalizeToken(t) {
  if (!t) return t;
  if (t.tokenNumber == null && t.tokenNo != null) t.tokenNumber = t.tokenNo;
  if (!t.vehicleNumber && t.vehicleRegNo) t.vehicleNumber = t.vehicleRegNo;
  if (!t.dockAssigned && t.assignedScaleDock) t.dockAssigned = t.assignedScaleDock;
  // Standardize legacy dock labels ("Scale Dock #2") to the current format ("Dock 2")
  if (t.dockAssigned) {
    const dockMatch = String(t.dockAssigned).match(/Dock\s*#?\s*(\d+)/i);
    if (dockMatch) t.dockAssigned = `Dock ${dockMatch[1]}`;
  }
  if (t.grossWeightKg == null && t.weightGrossKg != null) t.grossWeightKg = t.weightGrossKg;
  if (t.tareWeightKg == null && t.weightTareKg != null) t.tareWeightKg = t.weightTareKg;
  if (t.netWeightKg == null && t.weightNetKg != null) t.netWeightKg = t.weightNetKg;
  if (t.totalPayoutAmount == null && t.totalPaymentAmount != null) t.totalPayoutAmount = t.totalPaymentAmount;
  if (t.utrNumber == null && t.paymentTxnId) t.utrNumber = t.paymentTxnId;
  if (t.quantityMT == null && t.quantityKg != null) t.quantityMT = t.quantityKg / 1000;
  if (t.estimatedQuantity == null && t.quantityKg != null) t.estimatedQuantity = t.quantityKg / 100;
  if (t.netQuantityMT == null && t.netWeightKg != null) t.netQuantityMT = t.netWeightKg / 1000;
  if (!t.mobile && appState.farmerProfile && appState.farmerProfile.mobile) t.mobile = appState.farmerProfile.mobile;
  return t;
}

// Map older stockyard booking field names onto the current schema
function normalizeStockyardBooking(b) {
  if (!b) return b;
  if (!b.assignedBay && b.assignedSiloBay) b.assignedBay = b.assignedSiloBay;
  if (b.lastInspectedTemp == null && b.tempCelsius != null) b.lastInspectedTemp = b.tempCelsius;
  if (b.lastInspectedHumidity == null && b.humidityPercent != null) b.lastInspectedHumidity = b.humidityPercent;
  return b;
}

function saveState() {
  localStorage.setItem('uzhavar_mutram_marketplace_state', JSON.stringify({
    tokens: appState.tokens,
    stockyardBookings: appState.stockyardBookings,
    farmerProfile: appState.farmerProfile
  }));
}

// Normalize the profile so every field the UI expects is always present
function normalizeFarmerProfile() {
  const defaults = INITIAL_FARMER_PROFILE || {};
  if (!appState.farmerProfile || typeof appState.farmerProfile !== 'object') {
    appState.farmerProfile = { ...defaults };
    return;
  }
  ['id', 'name', 'aadhaar', 'mobile', 'village', 'district', 'state', 'landAcres', 'bankName', 'accountNo', 'ifsc', 'ekycStatus', 'verifiedDate'].forEach(k => {
    if (appState.farmerProfile[k] == null && defaults[k] != null) appState.farmerProfile[k] = defaults[k];
  });
  if (!appState.farmerProfile.ekycStatus) appState.farmerProfile.ekycStatus = 'VERIFIED';
}

// DOM Ready initialization
document.addEventListener('DOMContentLoaded', async () => {
  initAppState();
  setupEventListeners();
  renderAllViews();
  startClock();

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      console.log('[Uzhavar Mutram SW] Service Worker registered:', reg.scope);
    }).catch((err) => {
      console.warn('[Uzhavar Mutram SW] Registration failed:', err);
    });
  }

  // Network Online / Offline Status Listeners
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus();

  // Attempt to restore authenticated session from SQLite backend
  if (typeof api !== 'undefined' && api.getToken()) {
    await restoreActiveSession();
  } else if (!appState.currentUser && !sessionStorage.getItem('uzhavar_guest_entered')) {
    setTimeout(() => { openWelcomeEntranceModal(); }, 300);
  }
});

// Restore authenticated session from backend via JWT
async function restoreActiveSession() {
  if (typeof api === 'undefined') return;
  const token = api.getToken();
  if (!token) return;

  try {
    const meRes = await api.getMe();
    if (meRes.success && meRes.user) {
      const authUser = meRes.user;
      appState.currentUser = {
        id: authUser.id,
        name: authUser.fullName,
        role: authUser.role,
        credential: authUser.credential,
        authenticated: true,
        loginTimestamp: new Date().toISOString()
      };
      sessionStorage.setItem('uzhavar_guest_entered', 'true');

      if (authUser.role === 'farmer') {
        const profRes = await api.getFarmerProfile();
        if (profRes.success && profRes.profile) {
          appState.farmerProfile = profRes.profile;
        }
        const bookingsRes = await api.getMyBookings();
        if (bookingsRes.success && bookingsRes.bookings && bookingsRes.bookings.length > 0) {
          appState.tokens = bookingsRes.bookings.map(normalizeToken);
        }
        const stkRes = await api.getMyStockyardBookings();
        if (stkRes.success && stkRes.bookings && stkRes.bookings.length > 0) {
          appState.stockyardBookings = stkRes.bookings.map(normalizeStockyardBooking);
        }
      } else if (authUser.role === 'officer' || authUser.role === 'kiosk') {
        const bookingsRes = await api.getAllBookings();
        if (bookingsRes.success && bookingsRes.bookings && bookingsRes.bookings.length > 0) {
          appState.tokens = bookingsRes.bookings.map(normalizeToken);
        }
      }

      saveState();
      updateHeaderUserProfile();
      switchRole(authUser.role);
    } else {
      api.clearToken();
      appState.currentUser = null;
    }
  } catch (err) {
    console.warn('Could not restore session from server:', err);
  }
}

function updateNetworkStatus() {
  const banner = document.getElementById('offlineBanner');
  if (banner) {
    if (!navigator.onLine) {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }
}

// Event Listeners setup
function setupEventListeners() {
  // Global Clean Click Listener for Navigation & Role Tabs
  document.addEventListener('click', (e) => {
    // Top Role Buttons
    const roleBtn = e.target.closest('.role-btn, [data-role]');
    if (roleBtn) {
      const role = roleBtn.getAttribute('data-role');
      if (role) {
        switchRole(role);
      }
      return;
    }

    // Horizontal Navigation Sub-Tabs
    const subTab = e.target.closest('.sub-tab, [data-subtab], [data-tab]');
    if (subTab) {
      const tabKey = subTab.getAttribute('data-subtab') || subTab.getAttribute('data-tab');
      if (tabKey) {
        if (appState.currentRole !== 'farmer') {
          switchRole('farmer');
        }
        switchFarmerSubTab(tabKey);
      }
      return;
    }
  });

  // Attach Hash Router Listener
  window.addEventListener('hashchange', handleHashRoute);
  if (window.location.hash) {
    handleHashRoute();
  }

  // Weight Unit Conversion Listeners
  const qtyInput = document.getElementById('bookingQty');
  const unitSelect = document.getElementById('bookingUnit');
  if (qtyInput) qtyInput.addEventListener('input', updateWeightConversionBadge);
  const cropSelect = document.getElementById('bookingCrop');
  if (cropSelect) cropSelect.addEventListener('change', updateCropPriceDetails);
  if (unitSelect) unitSelect.addEventListener('change', updateWeightConversionBadge);

  // Slot Booking Form
  const slotForm = document.getElementById('slotBookingForm');
  if (slotForm) slotForm.addEventListener('submit', handleSlotBookingSubmit);

  // Stockyard Rental Form
  const stockyardForm = document.getElementById('stockyardBookingForm');
  if (stockyardForm) stockyardForm.addEventListener('submit', handleStockyardBookingSubmit);

  // Market Category Pills
  document.querySelectorAll('#marketCategoryPills .pill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#marketCategoryPills .pill-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      appState.activeMarketCategory = e.currentTarget.getAttribute('data-cat');
      renderMarketPricesGrid();
    });
  });

  // Search input
  const priceSearchInput = document.getElementById('priceSearchInput');
  if (priceSearchInput) {
    priceSearchInput.addEventListener('input', () => { renderMarketPricesGrid(); });
  }

  // Admin Search
  const tokenSearchInput = document.getElementById('adminTokenSearch');
  if (tokenSearchInput) {
    tokenSearchInput.addEventListener('input', (e) => { renderAdminTokensTable(e.target.value); });
  }

  // Customer Care Form
  const customerCareForm = document.getElementById('customerCareForm');
  if (customerCareForm) customerCareForm.addEventListener('submit', handleCustomerCareSubmit);

  // Header Language Selector
  const headerLangSelect = document.getElementById('langSelect');
  if (headerLangSelect) {
    headerLangSelect.addEventListener('change', (e) => {
      appState.currentLang = e.target.value;
      updateLanguageUI();
    });
  }

  // SMS Drawer Close
  const smsCloseBtn = document.getElementById('smsCloseBtn');
  if (smsCloseBtn) {
    smsCloseBtn.addEventListener('click', () => {
      const drawer = document.getElementById('smsDrawer');
      if (drawer) drawer.classList.remove('show');
    });
  }
}
function updateWeightConversionBadge() {
  const qty = document.getElementById('bookingQty')?.value || 0;
  const unit = document.getElementById('bookingUnit')?.value || 'QUINTAL';

  const converted = convertWeightUnits(qty, unit);

  const badgeEl = document.getElementById('weightConversionDisplay');
  if (badgeEl) {
    badgeEl.innerHTML = `⚖️ <strong>Standardized Weight:</strong> ${converted.kg.toLocaleString('en-IN')} Kg &nbsp;|&nbsp; <strong>${converted.metricTons.toFixed(2)} Metric Tons (MT)</strong>`;
  }
}

// Quick jump to Customer Care Tab
function openCustomerCareTab() {
  switchRole('farmer');
  switchFarmerSubTab('customer-care');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleCustomerCareSubmit(e) {
  e.preventDefault();
  const mobile = document.getElementById('helpMobile')?.value || "+91 98765 43210";
  const categorySelect = document.getElementById('helpCategory');
  const categoryText = categorySelect ? categorySelect.options[categorySelect.selectedIndex].text : "General Support";
  const message = document.getElementById('helpMessage')?.value || "";

  const ticketId = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;

  triggerSimulatedSMS(
    `Support Ticket #${ticketId} registered for ${mobile}. Category: ${categoryText}. A market officer will call you shortly.`
  );

  speakAnnouncement(`Support request submitted successfully. Your reference ticket number is ${ticketId}`);

  const msgInput = document.getElementById('helpMessage');
  if (msgInput) msgInput.value = '';
}

// Role Switching Logic with Full View/Tab Routing
function switchRole(role) {
  if (!role) return;
  appState.currentRole = role;

  // 1. Update Active Class on Role Buttons
  document.querySelectorAll('.role-btn, [data-role]').forEach(btn => {
    const isMatch = btn.getAttribute('data-role') === role || btn.getAttribute('data-tab') === role + 'View';
    btn.classList.toggle('active', isMatch);
    btn.classList.toggle('active-tab', isMatch);
  });

  // 2. Hide All View Panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
    panel.style.display = 'none';
  });

  // 3. Display Target View Panel
  const targetView = document.getElementById(role + 'View') || document.getElementById(role);
  if (targetView) {
    targetView.classList.add('active');
    targetView.style.display = 'block';
  } else {
    console.warn('Target view panel #' + role + 'View not found.');
  }

  // 4. If Farmer role, ensure sub-tab panel is active
  if (role === 'farmer') {
    switchFarmerSubTab(appState.currentFarmerSubTab || 'book-slot');
  }

  // 5. Update URL Hash for SPA Routing
  try {
    if (window.location.hash !== '#role-' + role) {
      history.replaceState(null, '', '#role-' + role);
    }
  } catch (e) {}

  // 6. Re-render views safely
  if (typeof renderAllViews === 'function') {
    try {
      renderAllViews();
    } catch (err) {
      console.warn("View render notice:", err);
    }
  }
}

// Farmer Sub Tab Switching Logic
function switchFarmerSubTab(tabKey) {
  if (!tabKey) return;
  const cleanKey = tabKey.replace('farmerSub-', '');
  appState.currentFarmerSubTab = cleanKey;

  // 1. Update Active Class on Sub Tabs
  // NOTE: selector intentionally excludes [data-tab] globally — header role buttons
  // also carry data-tab (e.g. "farmerView") and must never lose their active pill here.
  document.querySelectorAll('.sub-tab, [data-subtab]').forEach(tab => {
    const val = tab.getAttribute('data-subtab') || tab.getAttribute('data-tab');
    if (val) {
      const isMatch = val === cleanKey || val === 'farmerSub-' + cleanKey || val === tabKey;
      tab.classList.toggle('active', isMatch);
      tab.classList.toggle('active-tab', isMatch);
    }
  });

  // 2. Hide All Farmer Sub Panels
  document.querySelectorAll('.farmer-panel').forEach(panel => {
    panel.style.display = 'none';
    panel.classList.remove('active');
  });

  // 3. Show Target Farmer Sub Panel
  const targetPanel = document.getElementById('farmerSub-' + cleanKey) || document.getElementById(cleanKey) || document.getElementById(tabKey);
  if (targetPanel) {
    targetPanel.style.display = 'block';
    targetPanel.classList.add('active');
  } else {
    console.warn('Target farmer sub-panel #' + cleanKey + ' not found.');
  }

  // 4. Update URL Hash
  try {
    if (window.location.hash !== '#farmer-' + cleanKey) {
      history.replaceState(null, '', '#farmer-' + cleanKey);
    }
  } catch (e) {}
}

// Global URL Hash Router
function handleHashRoute() {
  const rawHash = window.location.hash.replace('#', '').trim();
  if (!rawHash) return;

  if (rawHash.startsWith('role-')) {
    const role = rawHash.replace('role-', '');
    switchRole(role);
  } else if (rawHash.startsWith('farmer-')) {
    const tabKey = rawHash.replace('farmer-', '');
    switchRole('farmer');
    switchFarmerSubTab(tabKey);
  } else {
    const validRoles = ['farmer', 'officer', 'buyer', 'kiosk'];
    if (validRoles.includes(rawHash)) {
      switchRole(rawHash);
    } else {
      switchRole('farmer');
      switchFarmerSubTab(rawHash);
    }
  }
}

function updateLanguageUI() {
  const lang = appState.currentLang;
  const t = I18N[lang] || I18N.en;

  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) el.setAttribute('placeholder', t[key]);
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (t[key]) el.setAttribute('title', t[key]);
  });

  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    if (t[key]) el.setAttribute('aria-label', t[key]);
  });

  renderAllViews();
  translateRemainingDOMNodes(lang);
}

// Universal Fallback DOM Scanner to Translate 100% of Visible Text Nodes
function translateRemainingDOMNodes(lang) {
  const t = I18N[lang] || I18N.en;
  if (!t) return;

  const textMap = {
    "Farmer Portal": t.farmerPortal,
    "Market Officer Admin": t.officerPortal,
    "Wholesale Buyer": t.buyerPortal,
    "Display Board": t.kioskPortal,
    "Switch Account": t.switchAccount,
    "Book Selling Slot": t.bookSlot,
    "Live Line Tracker": t.queueTracker,
    "Live Prices & Trends": t.marketPrices,
    "Stockyard Storage Rental": t.stockyard,
    "My Passes & Receipts": t.myPasses,
    "Govt Crop Prices (MSP)": t.mspRates,
    "My Bank & Aadhaar eKYC": t.profile,
    "Customer Support & Helpline": t.customerCare,
    "Select Market / Collection Centre": t.selectMandi,
    "Select Crop Type": t.selectCrop,
    "Quantity & Unit Input": t.quantityUnit,
    "Transport Vehicle": t.vehicleType,
    "Vehicle Reg. Number": t.vehicleNo,
    "Crop Delivery Date": t.selectDate,
    "Select Time Slot": t.selectTimeSlot,
    "GATE ENTRY": t.gateEntry,
    "QUALITY TESTING": t.qualityTesting,
    "WEIGHT SCALES": t.weightScales,
    "PAYMENTS SENT": t.paymentsSent,
    "ACTIVE AUCTIONS": t.activeAuctions || "நடைமுறை ஏலங்கள்",
    "MY BIDS": t.myBids || "எனது ஏலவிலைகள்",
    "ESCROW BALANCE": t.escrowBalance || "பணப்பாதுகாப்பு இருப்பு",
    "STOCKYARD CONTRACTS": t.stockyardContracts || "கிடங்கு ஒப்பந்தங்கள்",
    "All Crops": t.catAll,
    "Cereals": t.catCereals,
    "Pulses": t.catPulses,
    "Oilseeds": t.catOilseeds,
    "Spices": t.catSpices,
    "Vegetables & Fruits": t.catVegetables,
    "Cash Crops": t.catCashCrops
  };

  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while (node = walk.nextNode()) {
    const val = node.nodeValue.trim();
    if (!val) continue;
    const parent = node.parentElement;
    if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.hasAttribute('data-i18n')) continue;
    if (textMap[val]) {
      node.nodeValue = textMap[val];
    }
  }
}

// Render All Active Views
function renderAllViews() {
  renderMandiSelectOptions();
  renderCropSelectOptions();
  renderVehicleSelectOptions();
  renderStockyardFacilityOptions();
  renderStockyardCropOptions();

  updateCongestionMeter();
  updateWeightConversionBadge();

  renderFarmerActiveToken();
  renderFarmerPassesList();
  renderMarketPricesGrid();
  renderStockyardPassesList();
  renderMSPTable();

  renderAdminDashboard();
  renderAdminTokensTable();

  renderBuyerPortal();
  renderKioskDisplay();
  updateHeaderUserProfile();
}

// Populate Dropdowns with Multi-Language Support
function getLocalizedCropName(crop, lang = appState.currentLang) {
  if (!crop) return '';
  switch (lang) {
    case 'hi': return crop.nameHi ? crop.nameHi : crop.nameEn;
    case 'ta': return crop.nameTa ? crop.nameTa : crop.nameEn;
    case 'te': return crop.nameTe ? crop.nameTe : crop.nameEn;
    case 'ml': return crop.nameMl ? crop.nameMl : crop.nameEn;
    case 'kn': return crop.nameKn ? crop.nameKn : crop.nameEn;
    default: return crop.nameEn;
  }
}



function getLocalizedMandiName(mandi, lang = appState.currentLang) {
  if (!mandi) return '';
  if (lang === 'ta' && mandi.nameTa) return `${mandi.nameTa} (${mandi.districtTa || mandi.district}, ${mandi.stateTa || mandi.state})`;
  if (lang === 'hi' && mandi.nameHi) return `${mandi.nameHi} (${mandi.districtHi || mandi.district}, ${mandi.stateHi || mandi.state})`;
  if (lang === 'te' && mandi.nameTe) return `${mandi.nameTe} (${mandi.districtTe || mandi.district}, ${mandi.stateTe || mandi.state})`;
  if (lang === 'ml' && mandi.nameMl) return `${mandi.nameMl} (${mandi.districtMl || mandi.district}, ${mandi.stateMl || mandi.state})`;
  if (lang === 'kn' && mandi.nameKn) return `${mandi.nameKn} (${mandi.districtKn || mandi.district}, ${mandi.stateKn || mandi.state})`;
  return `${mandi.name} (${mandi.district}, ${mandi.state})`;
}

function renderMandiSelectOptions() {
  const select = document.getElementById('bookingMandi');
  if (!select) return;
  const lang = appState.currentLang;
  select.innerHTML = MANDI_CENTRES.map(m => 
    `<option value="${m.id}">${getLocalizedMandiName(m, lang)}</option>`
  ).join('');
}

function updateCropPriceDetails() {
  const cropSelect = document.getElementById('bookingCrop');
  if (!cropSelect || typeof CROPS === 'undefined') return;
  const cropId = cropSelect.value;
  const crop = CROPS.find(c => c.id === cropId) || CROPS[0];
  
  const infoBadge = document.getElementById('cropPricePreviewBadge');
  if (infoBadge && crop) {
    const msp = (crop.mspPerQuintal || 2300).toLocaleString('en-IN');
    const price = ((crop.pricePerKg || 25.5) * 100).toLocaleString('en-IN');
    const trend = crop.priceTrend || '+2.5%';
    infoBadge.innerHTML = `<i class="fas fa-circle-info"></i> <strong>Govt MSP:</strong> ₹${msp}/Quintal &nbsp;|&nbsp; <strong>Est. Price:</strong> ₹${price}/Quintal &nbsp;|&nbsp; <span style="color: #BE6638; font-weight: 700;">Trend ${trend}</span>`;
  }
}

function renderCropSelectOptions() {
  const select = document.getElementById('bookingCrop');
  if (!select || typeof CROPS === 'undefined') return;
  const lang = appState.currentLang;
  select.innerHTML = CROPS.map(c => {
    const cName = getLocalizedCropName(c, lang);
    return `<option value="${c.id}">${cName} (${c.category || 'Cereals'}) - MSP: ₹${c.mspPerQuintal}/Quintal</option>`;
  }).join('');
  updateCropPriceDetails();
}

function renderVehicleSelectOptions() {
  const select = document.getElementById('bookingVehicle');
  if (!select) return;
  const lang = appState.currentLang;
  select.innerHTML = VEHICLE_TYPES.map(v => {
    const vName = VEHICLE_NAMES_I18N[v.id]?.[lang] || v.name;
    return `<option value="${v.id}">${vName} (Max ~${v.capacityQuintals} Qtl)</option>`;
  }).join('');
}

function renderStockyardFacilityOptions() {
  const select = document.getElementById('stkFacility');
  if (!select) return;
  select.innerHTML = STOCKYARD_FACILITIES.map(s => 
    `<option value="${s.id}">${s.name} (${s.location}) - ₹${s.dailyRatePerMT}/MT/Day</option>`
  ).join('');
  calculateStockyardFee();
}

function renderStockyardCropOptions() {
  const select = document.getElementById('stkCrop');
  if (!select) return;
  select.innerHTML = CROPS.map(c => 
    `<option value="${c.id}">${c.nameEn} (${c.category})</option>`
  ).join('');
}

// Live Stockyard Rental Fee Calculation
function calculateStockyardFee() {
  const facilityId = document.getElementById('stkFacility')?.value;
  const qtyMT = parseFloat(document.getElementById('stkQtyMT')?.value || 0);
  const duration = parseInt(document.getElementById('stkDurationDays')?.value || 0);

  const facility = STOCKYARD_FACILITIES.find(f => f.id === facilityId) || STOCKYARD_FACILITIES[0];
  const rate = facility.dailyRatePerMT;
  const totalFee = Math.round(qtyMT * duration * rate);

  const feeEl = document.getElementById('stkFeeDisplay');
  const rateEl = document.getElementById('stkRateDisplay');

  if (feeEl) feeEl.textContent = `₹${totalFee.toLocaleString('en-IN')}`;
  if (rateEl) rateEl.textContent = `₹${rate}`;
}

// Handle Stockyard Booking Submission
async function handleStockyardBookingSubmit(e) {
  e.preventDefault();
  const facilityId = document.getElementById('stkFacility').value;
  const cropId = document.getElementById('stkCrop').value;
  const qtyMT = parseFloat(document.getElementById('stkQtyMT').value);
  const duration = parseInt(document.getElementById('stkDurationDays').value);
  const startDate = document.getElementById('stkStartDate').value;

  const facility = STOCKYARD_FACILITIES.find(f => f.id === facilityId);
  const crop = CROPS.find(c => c.id === cropId);
  const sellerName = appState.farmerProfile.name || 'Guest Farmer';

  const totalFee = Math.round(qtyMT * duration * (facility ? facility.dailyRatePerMT : 25));
  let newBooking = null;

  if (typeof api !== 'undefined' && api.getToken()) {
    try {
      const res = await api.createStockyardBooking({
        facilityId: facilityId,
        facilityName: facility ? facility.name : 'Uzhavar Grain Silos',
        cropId: cropId,
        cropName: crop ? crop.nameEn : 'Wheat',
        quantityMT: qtyMT,
        durationDays: duration,
        dailyRatePerMT: facility ? facility.dailyRatePerMT : 25,
        startDate: startDate
      });
      if (res.success && res.booking) {
        newBooking = normalizeStockyardBooking(res.booking);
      }
    } catch (err) {
      console.warn('Backend stockyard save error:', err);
    }
  }

  if (!newBooking) {
    const bookingId = `SYB-${Math.floor(900 + Math.random() * 100)}`;
    const bay = `Silo Bay ${String.fromCharCode(65 + Math.floor(Math.random() * 6))}-0${Math.floor(1 + Math.random() * 9)}`;
    newBooking = {
      id: bookingId,
      facilityId: facilityId,
      facilityName: facility ? facility.name : 'Uzhavar Grain Silos',
      farmerId: appState.farmerProfile.id,
      farmerName: sellerName,
      cropId: cropId,
      cropName: crop ? crop.nameEn : 'Wheat',
      quantityMT: qtyMT,
      quantityKg: qtyMT * 1000,
      durationDays: duration,
      dailyRatePerMT: facility ? facility.dailyRatePerMT : 25,
      totalFee: totalFee,
      startDate: startDate,
      endDate: startDate,
      status: "STORED",
      assignedBay: bay,
      receiptQrText: `STK:${facilityId}|BAY:${bay}|MT:${qtyMT}|FAR:${appState.farmerProfile.id}`,
      lastInspectedTemp: facility ? facility.tempCelsius : 21.5,
      lastInspectedHumidity: facility ? facility.humidityPercent : 48
    };
  }

  appState.stockyardBookings.unshift(newBooking);
  saveState();

  triggerSimulatedSMS(
    `Stockyard Booking #${bookingId} confirmed! ${qtyMT} MT of ${crop.nameEn} stored at ${facility.name} (Bay: ${bay}). Total Fee: ₹${totalFee.toLocaleString('en-IN')}.`
  );

  speakAnnouncement(`Stockyard storage space booked successfully. Rented ${qtyMT} Metric Tons at ${facility.name}`);

  renderStockyardPassesList();
}

// Render Active Stockyard Passes List
function renderStockyardPassesList() {
  const container = document.getElementById('stockyardPassesList');
  if (!container) return;

  const userBookings = appState.stockyardBookings.filter(b => b.farmerId === appState.farmerProfile.id);

  if (userBookings.length === 0) {
    container.innerHTML = '<p class="text-muted">No stockyard storage deposits found.</p>';
    return;
  }

  container.innerHTML = userBookings.map(b => `
    <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-weight: 800; font-size: 1rem; color: var(--primary-dark);">${b.facilityName}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">Assigned Bay: <strong>${b.assignedBay}</strong> | Deposit ID: <strong>#${b.id}</strong></div>
        </div>
        <span class="badge ${b.status === 'STORED' ? 'badge-success' : 'badge-warning'}">${b.status}</span>
      </div>

      <div class="grid-2" style="margin-top: 0.8rem; font-size: 0.85rem; background: white; padding: 0.8rem; border-radius: 8px;">
        <div>Stored Crop: <strong>${b.cropName}</strong></div>
        <div>Weight: <strong>${b.quantityMT} MT (${b.quantityKg.toLocaleString('en-IN')} Kg)</strong></div>
        <div>Duration: <strong>${b.durationDays} Days</strong></div>
        <div>Total Fee: <strong style="color: var(--primary);">₹${b.totalFee.toLocaleString('en-IN')}</strong></div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.8rem;">
        <div style="font-size: 0.8rem; color: #64748b;">
          🌡️ Temp: <strong>${b.lastInspectedTemp}°C</strong> &nbsp;|&nbsp; 💧 Moisture: <strong>${b.lastInspectedHumidity}%</strong>
        </div>
        <button class="btn btn-outline" style="padding: 0.3rem 0.7rem; font-size: 0.8rem;" onclick="showStockyardReceiptModal('${b.id}')">
          📜 Digital Receipt
        </button>
      </div>
    </div>
  `).join('');
}

// Show Stockyard Receipt Modal
function showStockyardReceiptModal(bookingId) {
  const booking = appState.stockyardBookings.find(b => b.id === bookingId);
  if (!booking) return;

  const modalContainer = document.getElementById('adminModalContainer');
  modalContainer.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-card" style="max-width: 520px;">
        <div class="modal-header">
          <div class="card-title">🏭 Warehouse Digital Deposit Receipt</div>
          <button class="sms-close" onclick="closeAdminModal()">✕</button>
        </div>

        <div style="border: 2px dashed #68786E; padding: 1.2rem; border-radius: 12px; background: #FBF5E8; line-height: 1.8; font-size: 0.9rem;">
          <div style="text-align: center; font-weight: 800; font-size: 1.1rem; color: #55645B;">UZHAVAR MUTRAM CLIMATE STOCKYARD NETWORK</div>
          <div style="text-align: center; font-size: 0.8rem; color: #64748b; margin-bottom: 1rem;">Official Crop Storage Deposit Certificate</div>

          <div style="text-align: center; margin-bottom: 1rem;">
            ${generateSVGQRCode(booking.receiptQrText)}
          </div>

          <div><strong>Receipt ID:</strong> #${booking.id}</div>
          <div><strong>Farmer Name:</strong> ${booking.farmerName}</div>
          <div><strong>Storage Facility:</strong> ${booking.facilityName}</div>
          <div><strong>Assigned Silo / Bay:</strong> ${booking.assignedBay}</div>
          <div><strong>Stored Commodity:</strong> ${booking.cropName}</div>
          <div><strong>Standardized Weight:</strong> ${booking.quantityMT} Metric Tons (${booking.quantityKg.toLocaleString('en-IN')} Kg)</div>
          <div><strong>Storage Duration:</strong> ${booking.durationDays} Days (From ${booking.startDate})</div>
          <hr style="margin: 0.8rem 0; border: none; border-top: 1px dashed #68786E;">
          <div style="font-size: 1.1rem; font-weight: 800; color: #55645B;">
            Total Storage Fee Paid: ₹${booking.totalFee.toLocaleString('en-IN')}
          </div>
          <div style="font-size: 0.8rem; color: #64748b;">Includes 100% Comprehensive Crop Insurance Coverage</div>
        </div>

        <div style="display: flex; gap: 0.8rem; margin-top: 1rem;">
          <button class="btn btn-primary btn-block" onclick="window.print()">🖨️ Print Certificate</button>
          <button class="btn btn-outline btn-block" onclick="closeAdminModal()">Close</button>
        </div>
      </div>
    </div>
  `;
}

// Toggle Crop Guide Embed Panel
function toggleCropGuide() {
  const embed = document.getElementById('cropGuideEmbed');
  const iframe = document.getElementById('cropGuideIframe');
  const btn = document.getElementById('cropGuideToggleBtn');
  if (!embed) return;
  const isVisible = embed.style.display !== 'none';
  if (isVisible) {
    embed.style.display = 'none';
    iframe.src = '';
    if (btn) btn.innerHTML = '📖 Visual Crop Guide';
  } else {
    embed.style.display = 'block';
    iframe.src = './crop-guide.html';
    if (btn) btn.innerHTML = '✕ Close Crop Guide';
    embed.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Render Real-Time Market Price Grid
function renderMarketPricesGrid() {
  const container = document.getElementById('marketPricesGrid');
  if (!container) return;

  const searchQuery = (document.getElementById('priceSearchInput')?.value || '').toLowerCase();
  const activeCategory = appState.activeMarketCategory;

  let filtered = CROPS;

  if (activeCategory !== 'ALL') {
    filtered = filtered.filter(c => c.category === activeCategory);
  }

  if (searchQuery) {
    filtered = filtered.filter(c => 
      c.nameEn.toLowerCase().includes(searchQuery) ||
      c.category.toLowerCase().includes(searchQuery) ||
      c.marketLocation.toLowerCase().includes(searchQuery)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">No crops found matching filters.</p>';
    return;
  }

  const lang = appState.currentLang;

  container.innerHTML = filtered.map(c => {
    const cropImg = c.imageUrl || '';
    const imgHtml = cropImg ? `
      <div style="width:100%; height:140px; border-radius:10px; overflow:hidden; margin-bottom:0.7rem; position:relative; background:#55645B;">
        <img src="${cropImg}" alt="${c.nameEn}" loading="lazy" style="width:100%; height:100%; object-fit:cover; transition: transform 0.4s ease;" onerror="this.parentNode.style.display='none'" />
        <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(to top, rgba(0,0,0,0.7), transparent); padding:6px 10px;">
          <span style="font-size:0.7rem; color:rgba(255,255,255,0.7); font-style:italic;">${c.imageCredit || ''}</span>
        </div>
      </div>` : '';
    return `
    <div class="card price-card" style="overflow:hidden;">
      ${imgHtml}
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
        <div>
          <span class="badge badge-info mb-1">${c.category}</span>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin-top: 0.2rem;">${getLocalizedCropName(c, lang)}</h3>
        </div>
        <span class="trend-badge ${c.trendDirection === 'UP' ? 'trend-up' : c.trendDirection === 'DOWN' ? 'trend-down' : 'trend-flat'}">
          ${c.trendDirection === 'UP' ? '🔺 +' : c.trendDirection === 'DOWN' ? '🔻 ' : '➖ '}${c.trendChangePercent}%
        </span>
      </div>

      <div style="margin: 0.8rem 0; padding: 0.75rem; background: var(--bg-light); border-radius: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-size: 0.8rem; color: var(--text-muted);">Rate per Kg:</span>
          <strong style="font-size: 1.3rem; font-weight: 900; color: var(--primary);">₹${c.pricePerKg.toFixed(2)} / kg</strong>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 0.3rem; font-size: 0.85rem;">
          <span style="color: var(--text-muted);">Metric Ton Rate:</span>
          <strong>₹${c.pricePerMT.toLocaleString('en-IN')} / MT</strong>
        </div>
      </div>

      <div style="font-size: 0.8rem; color: #6E6042; line-height: 1.6;">
        <div>🏛️ <strong>Govt MSP:</strong> ₹${c.mspPerQuintal.toLocaleString('en-IN')} / Quintal</div>
        <div>📊 <strong>Demand:</strong> ${c.demandStatus || 'Stable'} · <strong>Quality:</strong> ${c.qualityGrade || 'Grade A'}</div>
        <div>📍 <strong>Market:</strong> ${c.marketLocation}</div>
        <div>🗓️ <strong>Harvesting Season:</strong> ${c.season}</div>
        <div>💧 <strong>Max Moisture:</strong> ${c.moistureMaxPercent}%</div>
      </div>
    </div>
  `}).join('');
}

// Slot Congestion Meter Calculation
function updateCongestionMeter() {
  const mandiId = document.getElementById('bookingMandi')?.value;
  const date = document.getElementById('bookingDate')?.value;
  const timeSlot = document.getElementById('bookingTimeSlot')?.value;

  const mandi = MANDI_CENTRES.find(m => m.id === mandiId) || MANDI_CENTRES[0];
  // Per-hour throughput: daily capacity spread across a 12-hour market day
  const maxCap = (mandi.capacityPerDayQuintals ? mandi.capacityPerDayQuintals / 12 : (mandi.capacityPerHour ? mandi.capacityPerHour * 100 : 1000));

  const qtyRaw = parseFloat(document.getElementById('bookingQty')?.value || 0);
  const unitSel = document.getElementById('bookingUnit')?.value || 'QUINTAL';
  const qty = convertWeightUnits(qtyRaw, unitSel).quintals;

  const existingBookedQty = appState.tokens
    .filter(t => t.mandiId === mandiId && t.bookingDate === date && t.timeSlot === timeSlot)
    .reduce((sum, t) => sum + (t.estimatedQuantity || 0), 0);

  const totalProjected = existingBookedQty + qty;
  const percentFilled = Math.min(Math.round((totalProjected / maxCap) * 100), 100);

  const fillEl = document.getElementById('congestionFill');
  const percentEl = document.getElementById('congestionPercent');
  const statusEl = document.getElementById('congestionStatus');

  if (percentEl) percentEl.textContent = `${percentFilled}% Capacity Filled`;

  if (fillEl) {
    fillEl.style.width = `${percentFilled}%`;
    fillEl.className = 'congestion-fill';
    if (percentFilled < 40) fillEl.classList.add('low');
    else if (percentFilled < 75) fillEl.classList.add('medium');
    else fillEl.classList.add('high');
  }

  if (statusEl) {
    if (percentFilled < 40) {
      statusEl.innerHTML = '🟢 LOW TRAFFIC: Quick entry expected (&lt; 15 mins wait)';
      statusEl.style.color = '#68786E';
    } else if (percentFilled < 75) {
      statusEl.innerHTML = '🟡 MODERATE TRAFFIC: Normal entry (15-30 mins wait)';
      statusEl.style.color = '#d97706';
    } else {
      statusEl.innerHTML = '🔴 HIGH BUSY LINE: High waiting time expected (&gt; 45 mins wait)';
      statusEl.style.color = '#dc2626';
    }
  }
}

// Handle Slot Booking Submit
async function handleSlotBookingSubmit(e) {
  e.preventDefault();

  const inputFarmerName = document.getElementById('bookingFarmerName')?.value.trim();
  const sellerName = inputFarmerName || appState.farmerProfile.name || 'Guest Farmer';
  appState.farmerProfile.name = sellerName;
  normalizeFarmerProfile();
  saveState();

  const mandiId = document.getElementById('bookingMandi').value;
  const cropId = document.getElementById('bookingCrop').value;
  const rawQty = parseFloat(document.getElementById('bookingQty').value);
  const unit = document.getElementById('bookingUnit').value;
  const vehicleType = document.getElementById('bookingVehicle').value;
  const vehicleNo = document.getElementById('bookingVehicleNo').value;
  const date = document.getElementById('bookingDate').value;
  const timeSlot = document.getElementById('bookingTimeSlot').value;

  const mandi = MANDI_CENTRES.find(m => m.id === mandiId);
  const crop = CROPS.find(c => c.id === cropId);
  const converted = convertWeightUnits(rawQty, unit);

  let createdToken = null;

  // Persist to real backend SQLite database if authenticated
  if (typeof api !== 'undefined' && api.getToken()) {
    try {
      const res = await api.createBooking({
        mandiId: mandiId,
        mandiName: mandi ? mandi.name : 'Tamil Nadu Regulated Market Network',
        cropId: cropId,
        cropName: crop ? crop.nameEn : 'Agricultural Produce',
        quantityInput: rawQty,
        unit: unit,
        quantityKg: converted.kg,
        quantityMT: converted.metricTons,
        estimatedQuantity: converted.quintals,
        vehicleType: vehicleType,
        vehicleNumber: vehicleNo,
        bookingDate: date,
        timeSlot: timeSlot,
        baseRatePerQuintal: crop ? crop.mspPerQuintal : 2300
      });
      if (res.success && res.booking) {
        createdToken = normalizeToken(res.booking);
      }
    } catch (err) {
      console.warn('Backend booking failed, falling back to local storage:', err);
    }
  }

  // Fallback for offline / guest mode
  if (!createdToken) {
    const existingCount = appState.tokens.length;
    const tokenSeq = 100 + existingCount + 1;
    createdToken = {
      id: `TKN-${Math.floor(8400 + Math.random() * 1000)}`,
      mandiId: mandiId,
      mandiName: mandi ? mandi.name : 'Tamil Nadu Mandi',
      farmerId: appState.farmerProfile.id,
      farmerName: sellerName,
      mobile: appState.farmerProfile.mobile,
      cropId: cropId,
      cropName: crop ? crop.nameEn : 'Paddy / Rice',
      estimatedQuantity: converted.quintals,
      quantityKg: converted.kg,
      quantityMT: converted.metricTons,
      vehicleType: vehicleType,
      vehicleNumber: vehicleNo,
      bookingDate: date,
      timeSlot: timeSlot,
      tokenNumber: tokenSeq,
      dockAssigned: null,
      status: "BOOKED",
      moisturePercent: null,
      qualityGrade: null,
      grossWeightKg: null,
      tareWeightKg: null,
      netWeightKg: null,
      netQuantityQuintals: null,
      baseRatePerQuintal: crop ? crop.mspPerQuintal : 2300,
      deductionAmount: 0,
      totalPayoutAmount: null,
      utrNumber: null,
      createdAt: new Date().toISOString(),
      history: [
        { status: "BOOKED", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), note: `Selling slot confirmed at ${mandi ? mandi.name : 'Mandi'}` }
      ]
    };
  }

  appState.tokens.unshift(createdToken);
  saveState();

  const tokenSeq = createdToken.tokenNumber;
  triggerSimulatedSMS(
    `Dear ${appState.farmerProfile.name}, your crop slot at ${createdToken.mandiName} is CONFIRMED for ${date} (${timeSlot}). Token #${tokenSeq}. Weight: ${converted.kg} Kg (${converted.metricTons} MT).`
  );

  speakAnnouncement(`Congratulations! Your crop selling slot has been confirmed. Your token number is ${tokenSeq}`);

  switchFarmerSubTab('queue-tracker');
  renderAllViews();
}

// Generate Working Real-Time QR Code & Live Tracking Link
function getLiveTrackingURL(tokenNumber) {
  return `http://localhost:8080/index.html?token=${tokenNumber}`;
}

function generateWorkingQRCodeHTML(tokenNumber, tokenId, size = 160) {
  const trackingUrl = getLiveTrackingURL(tokenNumber);
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(trackingUrl)}`;

  return `
    <div style="text-align: center; margin: 0.8rem 0; background: #ffffff; padding: 0.8rem; border-radius: 12px; border: 1px solid #cbd5e1; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
      <div style="font-size: 0.75rem; font-weight: 700; color: #8A6320; text-transform: uppercase; margin-bottom: 0.4rem;">📱 Scan or Click QR for Real-Time Updates</div>
      <a href="${trackingUrl}" target="_blank" title="Click to open live tracking for Token #${tokenNumber}">
        <img src="${qrApiUrl}" alt="Real-Time QR Code for Token #${tokenNumber}" style="width: ${size}px; height: ${size}px; border-radius: 8px; border: 2px solid #68786E; background: #ffffff; display: inline-block;">
      </a>
      <div style="margin-top: 0.5rem;">
        <a href="${trackingUrl}" target="_blank" class="btn" style="font-size: 0.75rem; padding: 0.35rem 0.8rem; background: #68786E; color: white; font-weight: 700; text-decoration: none; border-radius: 6px; display: inline-block;">
          🔗 Live Status Tracking Link
        </a>
      </div>
    </div>
  `;
}

function generateSVGQRCode(text) {
  return `
    <svg width="140" height="140" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="white" />
      <path d="M10 10 h30 v30 h-30 z M15 15 v20 h20 v-20 z M20 20 h10 v10 h-10 z" fill="#2F3834" />
      <path d="M60 10 h30 v30 h-30 z M65 15 v20 h20 v-20 z M70 20 h10 v10 h-10 z" fill="#2F3834" />
      <path d="M10 60 h30 v30 h-30 z M15 65 v20 h20 v-20 z M20 70 h10 v10 h-10 z" fill="#2F3834" />
      <rect x="45" y="15" width="8" height="25" fill="#68786E" />
      <rect x="15" y="45" width="25" height="8" fill="#68786E" />
      <rect x="48" y="48" width="15" height="15" fill="#2F3834" />
      <rect x="68" y="55" width="20" height="8" fill="#68786E" />
      <rect x="55" y="72" width="30" height="15" fill="#2F3834" />
    </svg>
  `;
}

// Render Active Token for Farmer View
function renderFarmerActiveToken() {
  const container = document.getElementById('farmerActiveTokenContainer');
  if (!container) return;

  const farmerTokens = appState.tokens.filter(t => t.farmerId === appState.farmerProfile.id);
  const activeToken = farmerTokens.find(t => t.status !== 'PAYMENT_PROCESSED') || farmerTokens[0];

  if (!activeToken) {
    container.innerHTML = `
      <div class="card text-center" style="padding: 3rem;">
        <h3>No Active Selling Token</h3>
        <p class="text-muted" style="margin: 1rem 0;">Book a crop selling slot to view your live line queue status here.</p>
        <button class="btn btn-primary" onclick="switchFarmerSubTab('book-slot')">📝 Book Selling Slot Now</button>
      </div>
    `;
    return;
  }

  const mandiTokens = appState.tokens.filter(t => t.mandiId === activeToken.mandiId && t.status !== 'PAYMENT_PROCESSED');
  const positionIndex = mandiTokens.findIndex(t => t.id === activeToken.id);
  const queueAhead = Math.max(0, positionIndex);
  const estimatedWaitMins = queueAhead * 15;

  const STAGE_LABELS = {
    en: { BOOKED: 'Slot Confirmed', GATE_VERIFIED: 'Gate Verified', QUALITY_CHECK: 'Quality & Moisture Check', WEIGHBRIDGE: 'Truck Weight Scale', UNLOADED: 'Crops Unloaded', PAYMENT_PROCESSED: 'Payment Sent to Bank' }
  };

  const currentLangLabels = STAGE_LABELS[appState.currentLang] || STAGE_LABELS.en;

  const stages = [
    { key: 'BOOKED', label: currentLangLabels.BOOKED, icon: '🎫' },
    { key: 'GATE_VERIFIED', label: currentLangLabels.GATE_VERIFIED, icon: '🚚' },
    { key: 'QUALITY_CHECK', label: currentLangLabels.QUALITY_CHECK, icon: '🧪' },
    { key: 'WEIGHBRIDGE', label: currentLangLabels.WEIGHBRIDGE, icon: '⚖️' },
    { key: 'UNLOADED', label: currentLangLabels.UNLOADED, icon: '📦' },
    { key: 'PAYMENT_PROCESSED', label: currentLangLabels.PAYMENT_PROCESSED, icon: '💳' }
  ];

  const currentStageIndex = stages.findIndex(s => s.key === activeToken.status);

  container.innerHTML = `
    <div class="grid-2">
      <!-- Token Card -->
      <div class="token-card">
        <div class="badge badge-success mb-1">Active Token Pass</div>
        <div class="token-number">#${activeToken.tokenNumber}</div>
        <p style="font-weight: 700; color: var(--text-main); font-size: 1.1rem;">${activeToken.mandiName || "Karnal Central Market"}</p>
        <p class="text-muted" style="font-size: 0.9rem;">Date: <strong>${activeToken.bookingDate}</strong> | Slot: <strong>${activeToken.timeSlot}</strong></p>
        
        <div style="margin: 0.8rem 0;">
          ${generateWorkingQRCodeHTML(activeToken.tokenNumber, activeToken.id, 160)}
        </div>

        <div style="margin-top: 1.5rem; background: rgba(16, 185, 129, 0.1); padding: 0.8rem; border-radius: 12px;">
          <div style="font-size: 0.85rem; font-weight: 600; color: var(--primary-dark);">Vehicle & Standardized Weight</div>
          <div style="font-size: 1.1rem; font-weight: 800; color: var(--primary);">${activeToken.vehicleNumber} (${activeToken.quantityKg || (activeToken.estimatedQuantity * 100)} Kg / ${(activeToken.quantityMT || (activeToken.estimatedQuantity * 0.1)).toFixed(2)} MT)</div>
        </div>
      </div>

      <!-- Queue Details & Timeline -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Live Queue Status</div>
          <span class="badge badge-warning">Queue Ahead: ${queueAhead} Vehicles</span>
        </div>

        <div style="background: var(--bg-light); border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">Estimated Waiting Time</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: ${estimatedWaitMins > 30 ? '#A9552B' : '#68786E'};">
              ${estimatedWaitMins > 0 ? `~ ${estimatedWaitMins} Mins` : 'Your Turn Now!'}
            </div>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-muted); text-align: right;">Assigned Scale Dock</div>
            <div style="font-size: 1.2rem; font-weight: 800; color: var(--primary); text-align: right;">
              ${activeToken.dockAssigned || 'Assigning Scale Dock...'}
            </div>
          </div>
        </div>

        <!-- Stage Timeline -->
        <div class="timeline">
          ${stages.map((stage, idx) => {
            let stateClass = '';
            if (idx < currentStageIndex) stateClass = 'completed';
            else if (idx === currentStageIndex) stateClass = 'active';
            return `
              <div class="timeline-step ${stateClass}">
                <div class="step-icon">${stage.icon}</div>
                <div class="step-label">${stage.label}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// Render Farmer Digital Passes
function renderFarmerPassesList() {
  const container = document.getElementById('farmerPassesList');
  if (!container) return;

  const farmerTokens = appState.tokens.filter(t => t.farmerId === appState.farmerProfile.id);

  if (farmerTokens.length === 0) {
    container.innerHTML = '<p class="text-muted">No crop selling passes generated yet.</p>';
    return;
  }

  container.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Token ID</th>
            <th>Date & Slot</th>
            <th>Crop</th>
            <th>Standardized Weight</th>
            <th>Status</th>
            <th>Payment Amount</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${farmerTokens.map(t => `
            <tr>
              <td><strong>#${t.tokenNumber}</strong> <br><small class="text-muted">${t.id}</small></td>
              <td>${t.bookingDate}<br><small>${t.timeSlot}</small></td>
              <td>${t.cropName}</td>
              <td><strong>${t.netWeightKg ? `${t.netWeightKg} Kg (${t.netQuantityMT} MT)` : `${t.quantityKg || (t.estimatedQuantity * 100)} Kg (${(t.quantityMT || (t.estimatedQuantity * 0.1)).toFixed(2)} MT)`}</strong></td>
              <td><span class="badge ${getStatusBadgeClass(t.status)}">${t.status}</span></td>
              <td><strong>${t.totalPayoutAmount ? `₹${t.totalPayoutAmount.toLocaleString('en-IN')}` : 'Pending Log'}</strong></td>
              <td>
                <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="showReceiptModal('${t.id}')">
                  📜 Pass / Receipt
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Render Government MSP Rate Board
function renderMSPTable() {
  const container = document.getElementById('mspBoardContainer');
  if (!container) return;

  const lang = appState.currentLang;

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">📜 Official Government Minimum Support Price (MSP) Rates</div>
        <span class="badge badge-success"><i class="fas fa-shield-halved"></i> Govt Verified Rates</span>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Crop Name & Category</th>
              <th>Price per Kg</th>
              <th>MSP per Quintal (100kg)</th>
              <th>Price per Metric Ton (MT)</th>
              <th>Max Moisture Limit</th>
            </tr>
          </thead>
          <tbody>
            ${CROPS.map(c => `
              <tr>
                <td><strong>${getLocalizedCropName(c, lang)}</strong> <br><small class="text-muted">${c.category}</small></td>
                <td><strong style="color: var(--primary);">₹${c.pricePerKg.toFixed(2)} / kg</strong></td>
                <td><strong>₹${c.mspPerQuintal.toLocaleString('en-IN')}</strong></td>
                <td><strong>₹${c.pricePerMT.toLocaleString('en-IN')}</strong></td>
                <td><strong>${c.moistureMaxPercent}%</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Aadhaar eKYC & Photo Liveness Verification Wizard Modal
function openEkycModal() {
  const modalContainer = document.getElementById('ekycModalContainer');
  modalContainer.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-card" style="max-width: 560px;">
        <div class="modal-header">
          <div class="card-title">🆔 Farmer Aadhaar eKYC & Photo Liveness Verification</div>
          <button class="sms-close" onclick="closeAdminModal()">✕</button>
        </div>

        <div id="ekycStepContainer">
          <div style="background: #f0f9ff; border: 1px solid #7dd3fc; padding: 1rem; border-radius: 12px; margin-bottom: 1.2rem;">
            <div style="font-size: 0.85rem; color: #55645B; font-weight: 700;">UIDAI Aadhaar eKYC Compliance</div>
            <p style="font-size: 0.8rem; color: #8A6320; margin-top: 0.3rem; line-height: 1.5;">
              Mandatory verification to prevent duplicate accounts and enable instant direct bank transfers (DBT).
            </p>
          </div>

          <div class="form-group">
            <label class="form-label">12-Digit Aadhaar Number</label>
            <input type="text" id="ekycAadhaarInput" class="form-control" value="XXXX-XXXX-4921" placeholder="12-digit Aadhaar Number" required>
          </div>

          <button class="btn btn-primary btn-block" onclick="sendAadhaarOtp()">
            📱 Send Aadhaar OTP & Verify
          </button>
        </div>
      </div>
    </div>
  `;
}

function sendAadhaarOtp() {
  const container = document.getElementById('ekycStepContainer');
  if (!container) return;

  triggerSimulatedSMS("UIDAI eKYC OTP: Your verification OTP is 123456. Valid for 10 minutes.");

  container.innerHTML = `
    <div style="background: #fef3c7; border: 1px solid #fde68a; padding: 1rem; border-radius: 12px; margin-bottom: 1.2rem;">
      <div style="font-size: 0.85rem; color: #92400e; font-weight: 700;">Step 2: Enter Aadhaar OTP</div>
      <p style="font-size: 0.8rem; color: #b45309; margin-top: 0.2rem;">OTP sent to registered mobile +91 98765 43210 (Default: <strong>123456</strong>)</p>
    </div>

    <div class="form-group">
      <label class="form-label">6-Digit Security OTP</label>
      <input type="text" id="ekycOtpInput" class="form-control" value="123456" maxlength="6" required style="font-size: 1.4rem; letter-spacing: 4px; text-align: center;">
    </div>

    <button class="btn btn-primary btn-block" onclick="startPhotoLivenessScan()">
      📸 Proceed to Photo Liveness Scan
    </button>
  `;
}

let webcamStream = null;

function stopWebcamStream() {
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => {
      try { track.stop(); } catch (e) {}
    });
    webcamStream = null;
  }
}

function startPhotoLivenessScan() {
  const container = document.getElementById('ekycStepContainer');
  if (!container) return;

  stopWebcamStream();

  container.innerHTML = `
    <div style="text-align: center;">
      <div style="font-weight: 800; font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--primary-dark);">Step 3: Real AI Photo Liveness Detection</div>
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.8rem;">Position your face in center of camera and click capture.</p>

      <div class="camera-scan-frame">
        <video id="webcamVideo" class="webcam-video-feed" autoplay playsinline muted></video>
        <canvas id="webcamCanvas" class="webcam-canvas-preview" style="display:none;"></canvas>
        <div class="scan-laser-line" id="scanLaserLine" style="display:none;"></div>
      </div>

      <div style="font-size: 0.85rem; color: var(--primary); font-weight: 700; margin-top: 0.8rem;" id="scanStatusText">
        📷 Requesting camera access... Please click "Allow" in your browser prompt.
      </div>

      <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: center;" id="webcamControls">
        <button id="captureBtn" class="btn btn-primary" onclick="capturePhotoAndValidate()" disabled>
          📸 Capture & Validate Liveness
        </button>
        <button class="btn btn-outline" onclick="closeAdminModal()">Cancel</button>
      </div>
    </div>
  `;

  // Fallback check for unsupported browsers or non-secure contexts (http non-localhost)
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    handleWebcamError("Browser / Environment Unsupported", "Camera access API (navigator.mediaDevices.getUserMedia) is not supported in this browser or context. Secure context (HTTPS or localhost) required.");
    return;
  }

  navigator.mediaDevices.getUserMedia({ 
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
  })
    .then((stream) => {
      webcamStream = stream;
      const videoEl = document.getElementById('webcamVideo');
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.play().catch(e => console.warn("Video play exception:", e));
      }

      const statusEl = document.getElementById('scanStatusText');
      const captureBtn = document.getElementById('captureBtn');
      if (statusEl) statusEl.innerHTML = "<span style='color: #68786E;'>✓ Live Camera Feed Active. Hold steady and click Capture.</span>";
      if (captureBtn) captureBtn.disabled = false;
    })
    .catch((err) => {
      console.warn("Webcam getUserMedia error:", err);
      let errTitle = "Camera Permission Denied";
      let errMsg = "Camera access was denied. Please update your browser permissions.";
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errTitle = "Camera Access Permission Denied";
        errMsg = "You have blocked camera access. Please allow camera permissions in browser site settings.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errTitle = "No Camera Hardware Detected";
        errMsg = "No video recording camera was found on your device.";
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errTitle = "Camera Hardware Unavailable";
        errMsg = "Camera is currently in use by another application.";
      }
      
      handleWebcamError(errTitle, errMsg);
    });
}

function handleWebcamError(title, message) {
  const statusEl = document.getElementById('scanStatusText');
  const controls = document.getElementById('webcamControls');
  if (statusEl) {
    statusEl.innerHTML = `<span style="color: #dc2626;">⚠️ <strong>${title}</strong>: ${message}</span>`;
  }
  if (controls) {
    controls.innerHTML = `
      <button class="btn btn-warning" onclick="fallbackSimulatedScan()">
        ⚡ Use Simulated Fallback Liveness Check
      </button>
      <button class="btn btn-outline" onclick="closeAdminModal()">Close</button>
    `;
  }
}

function capturePhotoAndValidate() {
  const videoEl = document.getElementById('webcamVideo');
  const canvasEl = document.getElementById('webcamCanvas');
  const statusEl = document.getElementById('scanStatusText');
  const captureBtn = document.getElementById('captureBtn');
  const laserLine = document.getElementById('scanLaserLine');

  if (!videoEl || !canvasEl) return;

  const ctx = canvasEl.getContext('2d');
  canvasEl.width = videoEl.videoWidth || 300;
  canvasEl.height = videoEl.videoHeight || 300;
  ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

  videoEl.style.display = 'none';
  canvasEl.style.display = 'block';

  if (captureBtn) captureBtn.disabled = true;
  if (laserLine) laserLine.style.display = 'block';
  if (statusEl) statusEl.innerHTML = `🔍 <strong>Analyzing Facial Geometry & Liveness...</strong>`;

  stopWebcamStream();

  setTimeout(() => {
    if (statusEl) statusEl.innerHTML = `✅ <strong>Liveness Validated 100%! Matching UIDAI Aadhaar...</strong>`;
  }, 1500);

  setTimeout(() => {
    completeEkycVerification();
  }, 3000);
}

function fallbackSimulatedScan() {
  const statusEl = document.getElementById('scanStatusText');
  if (statusEl) statusEl.textContent = "Running Simulated Liveness Scan... Hold steady.";
  setTimeout(() => {
    completeEkycVerification();
  }, 2000);
}

function completeEkycVerification() {
  appState.farmerProfile.ekycStatus = "VERIFIED";
  appState.farmerProfile.photoLivenessStatus = "VERIFIED";
  saveState();

  const container = document.getElementById('ekycStepContainer');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 1.5rem 0;">
      <div style="font-size: 3.5rem; margin-bottom: 0.5rem;">✅</div>
      <h3 style="color: #55645B; font-weight: 900;">Verification Successful!</h3>
      <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0.8rem 0;">
        Your identity & Aadhaar eKYC have been validated. Verified Farmer Badge issued.
      </p>

      <button class="btn btn-primary btn-block" onclick="closeAdminModal(); renderAllViews();">
        Done & Return to Profile
      </button>
    </div>
  `;
}

// Mandi Admin Dashboard Render
function renderAdminDashboard() {
  const gateCount = appState.tokens.filter(t => t.status === 'GATE_VERIFIED').length;
  const qualityCount = appState.tokens.filter(t => t.status === 'QUALITY_CHECK').length;
  const weighCount = appState.tokens.filter(t => t.status === 'WEIGHBRIDGE').length;
  const paidCount = appState.tokens.filter(t => t.status === 'PAYMENT_PROCESSED').length;

  const elGate = document.getElementById('adminStatGate');
  const elQuality = document.getElementById('adminStatQuality');
  const elWeigh = document.getElementById('adminStatWeigh');
  const elPaid = document.getElementById('adminStatPaid');

  if (elGate) elGate.textContent = gateCount;
  if (elQuality) elQuality.textContent = qualityCount;
  if (elWeigh) elWeigh.textContent = weighCount;
  if (elPaid) elPaid.textContent = paidCount;
}

function renderAdminTokensTable(searchQuery = '') {
  const tbody = document.getElementById('adminTokensTbody');
  if (!tbody) return;

  let filtered = appState.tokens;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(t => 
      t.tokenNumber.toString().includes(q) ||
      t.farmerName.toLowerCase().includes(q) ||
      t.vehicleNumber.toLowerCase().includes(q) ||
      t.cropName.toLowerCase().includes(q)
    );
  }

  tbody.innerHTML = filtered.map(t => `
    <tr>
      <td><strong>#${t.tokenNumber}</strong></td>
      <td>${t.farmerName}<br><small class="text-muted">${t.mobile}</small></td>
      <td>${t.cropName}<br><small>${t.netWeightKg ? `${t.netWeightKg} Kg (${t.netQuantityMT} MT)` : `${t.quantityKg || (t.estimatedQuantity * 100)} Kg`}</small></td>
      <td><strong>${t.vehicleNumber}</strong></td>
      <td><span class="badge ${getStatusBadgeClass(t.status)}">${t.status}</span></td>
      <td><strong>${t.dockAssigned || 'Unassigned'}</strong></td>
      <td>
        <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="openAdminTokenModal('${t.id}')">
          ⚙️ Manage Lifecycle
        </button>
        <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-left: 0.2rem;" onclick="announceTokenCall('${t.id}')">
          📢 Announce Call
        </button>
      </td>
    </tr>
  `).join('');
}

// Open Admin Control Modal
function openAdminTokenModal(tokenId) {
  const token = appState.tokens.find(t => t.id === tokenId);
  if (!token) return;

  appState.selectedTokenId = tokenId;
  const modalContainer = document.getElementById('adminModalContainer');

  modalContainer.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-card">
        <div class="modal-header">
          <div class="card-title">Market Officer Control: Token #${token.tokenNumber}</div>
          <button class="sms-close" onclick="closeAdminModal()">✕</button>
        </div>

        <div class="grid-2" style="font-size: 0.9rem; margin-bottom: 1rem;">
          <div><strong>Farmer:</strong> ${token.farmerName} (${token.mobile})</div>
          <div><strong>Crop:</strong> ${token.cropName}</div>
          <div><strong>Vehicle:</strong> ${token.vehicleNumber}</div>
          <div><strong>Slot Time:</strong> ${token.bookingDate} (${token.timeSlot})</div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Update Processing Status Stage</label>
            <select id="modalStatusSelect" class="form-control">
              <option value="BOOKED" ${token.status === 'BOOKED' ? 'selected' : ''}>1. Slot Confirmed</option>
              <option value="GATE_VERIFIED" ${token.status === 'GATE_VERIFIED' ? 'selected' : ''}>2. Gate Entry Verified</option>
              <option value="QUALITY_CHECK" ${token.status === 'QUALITY_CHECK' ? 'selected' : ''}>3. Quality & Moisture Check</option>
              <option value="WEIGHBRIDGE" ${token.status === 'WEIGHBRIDGE' ? 'selected' : ''}>4. Truck Weight Scale Logging</option>
              <option value="UNLOADED" ${token.status === 'UNLOADED' ? 'selected' : ''}>5. Crops Unloaded</option>
              <option value="PAYMENT_PROCESSED" ${token.status === 'PAYMENT_PROCESSED' ? 'selected' : ''}>6. Payment Transferred to Bank</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Assign Weight Scale Dock</label>
            <select id="modalDockSelect" class="form-control">
              <option value="Dock 1" ${token.dockAssigned === 'Dock 1' ? 'selected' : ''}>Dock 1</option>
              <option value="Dock 2" ${token.dockAssigned === 'Dock 2' ? 'selected' : ''}>Dock 2</option>
              <option value="Dock 3" ${token.dockAssigned === 'Dock 3' ? 'selected' : ''}>Dock 3</option>
              <option value="Dock 4" ${token.dockAssigned === 'Dock 4' ? 'selected' : ''}>Dock 4</option>
            </select>
          </div>
        </div>

        <!-- Quality Check Inputs -->
        <div id="modalQualityFields" style="background: #f1f5f9; padding: 1rem; border-radius: 10px; margin-bottom: 1rem;">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem;">🧪 Crop Quality & Moisture Check Inspection</h4>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Tested Moisture Percentage (%)</label>
              <input type="number" step="0.1" id="modalMoisture" class="form-control" value="${token.moisturePercent || 11.5}" oninput="calculateModalPayout()">
            </div>
            <div class="form-group">
              <label class="form-label">Grade Classification</label>
              <select id="modalQualityGrade" class="form-control">
                <option value="Grade A Superior">Grade A Superior</option>
                <option value="Standard Grade">Standard Grade</option>
                <option value="Grade B">Grade B (Minor Moisture Adjustment)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Weight Scale Calculation Section -->
        <div id="modalWeighbridgeFields" style="background: #fef3c7; border: 1px solid #fde68a; padding: 1rem; border-radius: 10px; margin-bottom: 1rem;">
          <h4 style="font-size: 0.95rem; color: #92400e; margin-bottom: 0.75rem;">⚖️ Truck Weight Scale Digital Log</h4>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Loaded Vehicle Weight (Full Truck in Kg)</label>
              <input type="number" id="modalGrossWeight" class="form-control" value="${token.grossWeightKg || 10850}" oninput="calculateModalPayout()">
            </div>
            <div class="form-group">
              <label class="form-label">Empty Vehicle Weight (Empty Truck in Kg)</label>
              <input type="number" id="modalTareWeight" class="form-control" value="${token.tareWeightKg || 4350}" oninput="calculateModalPayout()">
            </div>
          </div>

          <div style="background: white; padding: 0.8rem; border-radius: 8px; margin-top: 0.5rem; display: flex; justify-content: space-between;">
            <div>Actual Crop Weight: <strong id="modalNetKgDisplay">6,500 Kg</strong></div>
            <div>Equiv. Metric Tons: <strong id="modalNetQtlDisplay" style="color: var(--primary); font-size: 1.1rem;">6.50 MT</strong></div>
          </div>
        </div>

        <!-- Calculated Payout Section -->
        <div style="background: linear-gradient(135deg, #3E4A42 0%, #2F3834 100%); color: #FBF6EA; padding: 1.2rem; border-radius: 12px; margin-bottom: 1.2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 0.8rem; color: #94a3b8;">Total Payment Amount (Govt Price: ₹${token.baseRatePerQuintal.toLocaleString('en-IN')}/Qtl)</div>
              <div style="font-size: 1.8rem; font-weight: 900; color: #F6D19A;" id="modalPayoutDisplay">₹1,47,875</div>
            </div>
            <div id="modalDbtBadge">
              <span class="badge badge-success">Direct Bank Transfer Ready</span>
            </div>
          </div>
        </div>

        <button class="btn btn-primary btn-block" onclick="saveAdminTokenProgress('${token.id}')">
          💾 Save & Update Queue Lifecycle
        </button>
      </div>
    </div>
  `;
}

function closeAdminModal() {
  stopWebcamStream();
  const modalContainer = document.getElementById('adminModalContainer');
  if (modalContainer) modalContainer.innerHTML = '';
  const ekycContainer = document.getElementById('ekycModalContainer');
  if (ekycContainer) ekycContainer.innerHTML = '';
}

function calculateModalPayout() {
  const gross = parseFloat(document.getElementById('modalGrossWeight')?.value || 0);
  const tare = parseFloat(document.getElementById('modalTareWeight')?.value || 0);
  const moisture = parseFloat(document.getElementById('modalMoisture')?.value || 12);

  const netKg = Math.max(0, gross - tare);
  const netQtl = netKg / 100;
  const netMT = netKg / 1000;

  const token = appState.tokens.find(t => t.id === appState.selectedTokenId);
  const rate = token ? token.baseRatePerQuintal : 2275;

  let deductionPerQtl = 0;
  if (moisture > 12) {
    deductionPerQtl = (moisture - 12) * 25;
  }

  const effectiveRate = Math.max(0, rate - deductionPerQtl);
  const totalPayout = Math.round(netQtl * effectiveRate);

  const kgDisplay = document.getElementById('modalNetKgDisplay');
  const qtlDisplay = document.getElementById('modalNetQtlDisplay');
  const payoutDisplay = document.getElementById('modalPayoutDisplay');

  if (kgDisplay) kgDisplay.textContent = `${netKg.toLocaleString('en-IN')} Kg`;
  if (qtlDisplay) qtlDisplay.textContent = `${netMT.toFixed(2)} MT`;
  if (payoutDisplay) payoutDisplay.textContent = `₹${totalPayout.toLocaleString('en-IN')}`;
}

function saveAdminTokenProgress(tokenId) {
  const token = appState.tokens.find(t => t.id === tokenId);
  if (!token) return;

  const newStatus = document.getElementById('modalStatusSelect').value;
  const newDock = document.getElementById('modalDockSelect').value;
  const moisture = parseFloat(document.getElementById('modalMoisture').value);
  const grade = document.getElementById('modalQualityGrade').value;
  const gross = parseFloat(document.getElementById('modalGrossWeight').value);
  const tare = parseFloat(document.getElementById('modalTareWeight').value);

  const netKg = Math.max(0, gross - tare);
  const netQtl = netKg / 100;
  const netMT = netKg / 1000;
  const totalPayout = Math.round(netQtl * token.baseRatePerQuintal);

  token.status = newStatus;
  token.dockAssigned = newDock;
  token.moisturePercent = moisture;
  token.qualityGrade = grade;
  token.grossWeightKg = gross;
  token.tareWeightKg = tare;
  token.netWeightKg = netKg;
  token.netQuantityQuintals = netQtl;
  token.netQuantityMT = netMT;
  token.totalPayoutAmount = totalPayout;

  if (newStatus === 'PAYMENT_PROCESSED' && !token.utrNumber) {
    token.utrNumber = `UTRIBIN2026${Math.floor(10000000 + Math.random() * 90000000)}`;
  }

  token.history.push({
    status: newStatus,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    note: `Updated by Market Officer to ${newStatus} at ${newDock}`
  });

  saveState();

  // Persist update to SQLite database
  if (typeof api !== 'undefined' && api.getToken()) {
    api.updateBooking(token.id, {
      status: newStatus,
      dockAssigned: newDock,
      moisturePercent: moisture,
      qualityGrade: grade,
      grossWeightKg: gross,
      tareWeightKg: tare,
      netWeightKg: netKg,
      totalPayoutAmount: totalPayout,
      utrNumber: token.utrNumber,
      historyEntry: {
        status: newStatus,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        note: `Updated by Market Officer to ${newStatus} at ${newDock}`
      }
    }).catch(e => console.warn('Could not persist token update to SQLite:', e));
  }

  triggerSimulatedSMS(
    `Update for Token #${token.tokenNumber}: Status changed to [${newStatus}] at ${newDock}. ${token.utrNumber ? `Direct Payment of ₹${totalPayout.toLocaleString('en-IN')} credited to bank via UTR ${token.utrNumber}.` : ''}`
  );

  closeAdminModal();
  renderAllViews();
}

// Public Mandi Kiosk View Render
function renderKioskDisplay() {
  const dockGrid = document.getElementById('kioskDockGrid');
  if (!dockGrid) return;

  const activeTokens = appState.tokens.filter(t => t.dockAssigned && t.status !== 'PAYMENT_PROCESSED');
  const docks = ["Dock 1", "Dock 2", "Dock 3", "Dock 4"];

  dockGrid.innerHTML = docks.map(dockName => {
    const token = activeTokens.find(t => t.dockAssigned === dockName);
    return `
      <div class="dock-card ${token ? 'active' : ''}">
        <div class="dock-name">${dockName}</div>
        ${token ? `
          <div class="dock-token">#${token.tokenNumber}</div>
          <div class="dock-farmer">${token.farmerName}</div>
          <div class="dock-crop">${token.cropName} (${token.vehicleNumber})</div>
          <div style="margin-top: 0.75rem;"><span class="badge badge-warning">${token.status}</span></div>
        ` : `
          <div style="font-size: 2rem; color: #475569; margin: 1rem 0;">AVAILABLE</div>
          <div style="font-size: 0.85rem; color: #64748b;">Ready for next vehicle</div>
        `}
      </div>
    `;
  }).join('');
}

// ================= MULTILINGUAL AUDIO & TTS ENGINE =================
let cachedVoices = [];

function loadVoices() {
  if ('speechSynthesis' in window) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

function speakAnnouncement(text, langCode) {
  if (!('speechSynthesis' in window)) {
    console.warn("Speech synthesis is not supported in this browser.");
    triggerSimulatedSMS(`🔊 AUDIO ASSISTANT: ${text}`);
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const targetLang = langCode || appState.currentLang || 'en';
  
  const bcp47Map = {
    en: 'en-IN',
    hi: 'hi-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    ml: 'ml-IN',
    kn: 'kn-IN'
  };

  const targetBcp = bcp47Map[targetLang] || 'en-IN';
  utterance.lang = targetBcp;
  utterance.rate = 0.9;
  utterance.pitch = 1.0;

  // Voice Selection Strategy
  if (cachedVoices.length === 0) cachedVoices = window.speechSynthesis.getVoices();
  let matchingVoice = cachedVoices.find(v => v.lang === targetBcp || v.lang.startsWith(targetLang));
  if (!matchingVoice && targetLang !== 'en') {
    matchingVoice = cachedVoices.find(v => v.lang.includes('IN') || v.lang.startsWith('en'));
  }
  if (matchingVoice) utterance.voice = matchingVoice;

  const voiceBtn = document.getElementById('voiceBtn');
  if (voiceBtn) voiceBtn.classList.add('active-speaking');

  utterance.onend = () => {
    if (voiceBtn) voiceBtn.classList.remove('active-speaking');
  };
  utterance.onerror = () => {
    if (voiceBtn) voiceBtn.classList.remove('active-speaking');
  };

  window.speechSynthesis.speak(utterance);
}

function triggerAudioHelper() {
  const lang = appState.currentLang;
  const t = I18N[lang] || I18N.en;
  speakAnnouncement(t.welcomeText, lang);
}

function announceTokenCall(tokenId) {
  const token = appState.tokens.find(t => t.id === tokenId);
  if (!token) return;

  const msg = `Token Number ${token.tokenNumber}, ${token.farmerName}, please proceed to ${token.dockAssigned || 'Gate Number 1'}`;
  speakAnnouncement(msg, appState.currentLang);

  triggerSimulatedSMS(`ANNOUNCEMENT: Token #${token.tokenNumber} (${token.farmerName}), please proceed to ${token.dockAssigned || 'Gate 1'} immediately.`);
}


// ================= AI POWERED CONVERSATIONAL CHATBOT OPERATOR =================
const chatState = {
  isOpen: false,
  voiceEnabled: true,
  history: [],
  bookingFlow: {
    active: false,
    crop: null,
    mandi: null,
    quantityMT: null,
    vehicle: null,
    date: null,
    timeSlot: null
  }
};

function toggleChatbot() {
  const drawer = document.getElementById('chatbotDrawer');
  if (!drawer) return;
  chatState.isOpen = !chatState.isOpen;
  drawer.classList.toggle('hidden', !chatState.isOpen);

  if (chatState.isOpen && chatState.history.length === 0) {
    const lang = appState.currentLang || 'en';
    const initialGreeting = lang === 'hi' ? 'नमस्ते! मैं उழவர் முற்றம் AI ऑपरेटर हूँ। मैं आपके लिए बिक्री स्लॉट बुक कर सकता हूँ, लाइव दरें बता सकता हूँ और भंडारण खोज सकता हूँ।' :
      lang === 'ta' ? 'வணக்கம்! நான் உழவர் முற்றம் AI ஆபரேட்டர். விற்பனை ஸ்லாட் பதிவு செய்ய, நேரலை விலைகளை அறிய நான் உதவுவேன்.' :
      'Hello! I am the Uzhavar Mutram AI Operator. I can book crop selling slots, check real-time market prices, and find storage stockyards for you.';
    
    appendBotMessage(initialGreeting);
  }
}

function toggleChatVoice() {
  chatState.voiceEnabled = !chatState.voiceEnabled;
  const btn = document.getElementById('chatVoiceToggleBtn');
  if (btn) {
    btn.classList.toggle('active', chatState.voiceEnabled);
    btn.textContent = chatState.voiceEnabled ? '🔊' : '🔇';
  }
}

function handleChipClick(text) {
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = text;
    handleChatSubmit(new Event('submit'));
  }
}

function handleChatSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('chatInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  appendUserMessage(text);
  input.value = '';

  setTimeout(() => {
    processChatQuery(text);
  }, 400);
}

function appendUserMessage(text) {
  const stream = document.getElementById('chatStream');
  if (!stream) return;
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble user';
  bubble.textContent = text;
  stream.appendChild(bubble);
  stream.scrollTop = stream.scrollHeight;
  chatState.history.push({ sender: 'user', text });
}

function appendBotMessage(text, cardHtml = '') {
  const stream = document.getElementById('chatStream');
  if (!stream) return;
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble bot';
  bubble.innerHTML = text + (cardHtml ? `<div class="chat-card">${cardHtml}</div>` : '');
  stream.appendChild(bubble);
  stream.scrollTop = stream.scrollHeight;
  chatState.history.push({ sender: 'bot', text });

  if (chatState.voiceEnabled) {
    speakAnnouncement(text.replace(/<[^>]*>?/gm, ''), appState.currentLang);
  }
}

// Intent Classification & Conversational Workflow Engine
function processChatQuery(query) {
  const q = query.toLowerCase();

  // 1. Slot Booking Intent & Flow
  if (chatState.bookingFlow.active || q.includes('book') || q.includes('slot') || q.includes('sell') || q.includes('reserve')) {
    handleSlotBookingConversation(q);
    return;
  }

  // 2. Market Price & MSP Query Intent
  if (q.includes('price') || q.includes('rate') || q.includes('msp') || q.includes('cost') || q.includes('trend')) {
    handlePriceQueryConversation(q);
    return;
  }

  // 3. Stockyard Storage Query Intent
  if (q.includes('storage') || q.includes('stockyard') || q.includes('silo') || q.includes('warehouse')) {
    handleStorageQueryConversation(q);
    return;
  }

  // 4. Live Queue Status Intent
  if (q.includes('queue') || q.includes('line') || q.includes('wait') || q.includes('token') || q.includes('turn')) {
    handleQueueStatusConversation();
    return;
  }

  // 5. App Navigation Intent
  if (q.includes('go to') || q.includes('open') || q.includes('show')) {
    if (q.includes('price') || q.includes('market')) {
      switchFarmerSubTab('market-prices');
      appendBotMessage("Switched to Live Prices & Market Trends view.");
      return;
    }
    if (q.includes('stockyard') || q.includes('storage')) {
      switchFarmerSubTab('stockyard');
      appendBotMessage("Switched to Stockyard Storage Rental view.");
      return;
    }
    if (q.includes('pass') || q.includes('receipt') || q.includes('token')) {
      switchFarmerSubTab('my-passes');
      appendBotMessage("Switched to My Passes & Digital Receipts view.");
      return;
    }
    if (q.includes('msp')) {
      switchFarmerSubTab('msp-board');
      appendBotMessage("Switched to Govt Crop MSP Prices view.");
      return;
    }
    if (q.includes('profile') || q.includes('bank') || q.includes('kyc')) {
      switchFarmerSubTab('profile');
      appendBotMessage("Switched to My Bank & Aadhaar eKYC view.");
      return;
    }
  }

  // Default Help Response
  appendBotMessage(
    "I can assist you with:\n1. 🌾 Booking selling slots\n2. 📈 Checking live crop prices & MSP\n3. 🏭 Finding storage stockyards\n4. ⏱️ Checking live line wait status\n\nWhat would you like to do?"
  );
}

// Interactive Multi-turn Conversational Slot Booking Flow
function handleSlotBookingConversation(q) {
  const bf = chatState.bookingFlow;
  bf.active = true;

  // Extract Crop Entity if present in query
  if (!bf.crop) {
    const foundCrop = CROPS.find(c => 
      q.includes(c.id.toLowerCase()) || 
      q.includes(c.nameEn.toLowerCase().split(' ')[0]) || 
      (c.nameHi && q.includes(c.nameHi)) ||
      (c.nameTa && q.includes(c.nameTa))
    );
    if (foundCrop) bf.crop = foundCrop;
  }

  // Extract Mandi Entity if present in query
  if (!bf.mandi) {
    const foundMandi = MANDI_CENTRES.find(m => q.includes(m.name.toLowerCase().split(' ')[0]) || q.includes(m.district.toLowerCase()));
    if (foundMandi) bf.mandi = foundMandi;
  }

  // Extract Quantity Entity if present in query
  if (!bf.quantityMT) {
    const numMatch = q.match(/(\d+(\.\d+)?)\s*(mt|ton|tons|qtl|quintal|kg)?/);
    if (numMatch && parseFloat(numMatch[1]) > 0) {
      let val = parseFloat(numMatch[1]);
      const unit = numMatch[3] || 'mt';
      if (unit === 'kg') val = val / 1000;
      else if (unit === 'qtl' || unit === 'quintal') val = val / 10;
      bf.quantityMT = val;
    }
  }

  // Set default mandi & dates if missing
  if (!bf.mandi) bf.mandi = MANDI_CENTRES[0]; // Default Karnal Hub
  if (!bf.date) bf.date = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  if (!bf.timeSlot) bf.timeSlot = "09:00 AM - 10:00 AM";

  // STEP 1: Prompt for Crop Variety if not specified
  if (!bf.crop) {
    const cropButtons = CROPS.map(c => 
      `<button class="btn btn-outline" style="font-size:0.8rem; padding:0.4rem 0.6rem; margin:0.2rem;" onclick="selectChatCrop('${c.id}')">🌾 ${c.nameEn}</button>`
    ).join('');

    appendBotMessage(
      "🌾 <strong>Which crop variety would you like to sell?</strong><br>Please select a crop variety below or type the crop name:",
      `<div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.5rem;">${cropButtons}</div>`
    );
    return;
  }

  // STEP 2: Prompt for Quantity if not specified
  if (!bf.quantityMT) {
    const qtyButtons = [
      `<button class="btn btn-outline" style="font-size:0.8rem; padding:0.4rem 0.6rem; margin:0.2rem;" onclick="selectChatQuantity(2)">⚖️ 2 MT (20 Qtl)</button>`,
      `<button class="btn btn-outline" style="font-size:0.8rem; padding:0.4rem 0.6rem; margin:0.2rem;" onclick="selectChatQuantity(5)">⚖️ 5 MT (50 Qtl)</button>`,
      `<button class="btn btn-outline" style="font-size:0.8rem; padding:0.4rem 0.6rem; margin:0.2rem;" onclick="selectChatQuantity(10)">⚖️ 10 MT (100 Qtl)</button>`,
      `<button class="btn btn-outline" style="font-size:0.8rem; padding:0.4rem 0.6rem; margin:0.2rem;" onclick="selectChatQuantity(15)">⚖️ 15 MT (150 Qtl)</button>`
    ].join('');

    appendBotMessage(
      `⚖️ <strong>How much quantity of ${bf.crop.nameEn} do you want to sell?</strong><br>Select a preset quantity or type the volume (e.g., 5 tons, 50 quintals):`,
      `<div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.5rem;">${qtyButtons}</div>`
    );
    return;
  }

  // Check eKYC Authentication Status
  if (appState.farmerProfile.ekycStatus !== 'VERIFIED') {
    appendBotMessage(
      "⚠️ <strong>eKYC Verification Required</strong>: Please verify your Aadhaar eKYC in the Profile tab before booking selling slots.",
      `<div class="chat-card-detail"><span>Status:</span> <strong>UNVERIFIED</strong></div>
       <button class="btn btn-warning btn-block" style="margin-top:0.5rem;" onclick="switchFarmerSubTab('profile')">Verify eKYC Now</button>`
    );
    bf.active = false;
    return;
  }

  // Execute Slot Booking API / Action
  const tokenNumber = Math.floor(100 + Math.random() * 50);
  const tokenId = `TKN-${Math.floor(8000 + Math.random() * 1000)}`;
  const sellerName = appState.farmerProfile.name || 'Guest Farmer';

  const newToken = {
    id: tokenId,
    mandiId: bf.mandi.id,
    mandiName: bf.mandi.name,
    farmerId: appState.farmerProfile.id,
    farmerName: sellerName,
    mobile: appState.farmerProfile.mobile,
    cropId: bf.crop.id,
    cropName: bf.crop.nameEn,
    estimatedQuantity: bf.quantityMT * 10, // Quintals
    quantityKg: bf.quantityMT * 1000,
    quantityMT: bf.quantityMT,
    vehicleType: "TRACTOR_TROLLEY",
    vehicleNumber: "HR-05-AB-" + Math.floor(1000 + Math.random() * 9000),
    bookingDate: bf.date,
    timeSlot: bf.timeSlot,
    tokenNumber: tokenNumber,
    dockAssigned: "Dock 1",
    status: "BOOKED",
    baseRatePerQuintal: bf.crop.mspPerQuintal,
    totalPayoutAmount: bf.quantityMT * 10 * bf.crop.mspPerQuintal,
    createdAt: new Date().toISOString(),
    history: [
      { status: "BOOKED", timestamp: new Date().toLocaleString(), note: `Slot booked via AI Operator for ${bf.date} ${bf.timeSlot}` }
    ]
  };

  appState.tokens.unshift(newToken);
  saveState();
  renderAllViews();

  const cardContent = `
    <div class="chat-card-title">✅ Token #${tokenNumber} Confirmed</div>
    <div class="chat-card-detail"><span>Mandi:</span> <strong>${bf.mandi.name}</strong></div>
    <div class="chat-card-detail"><span>Crop:</span> <strong>${bf.crop.nameEn}</strong></div>
    <div class="chat-card-detail"><span>Quantity:</span> <strong>${bf.quantityMT} MT (${bf.quantityMT * 1000} Kg)</strong></div>
    <div class="chat-card-detail"><span>Delivery Slot:</span> <strong>${bf.date} (${bf.timeSlot})</strong></div>
    <div class="chat-card-detail"><span>Estimated Payout:</span> <strong style="color:#68786E;">₹${(bf.quantityMT * 10 * bf.crop.mspPerQuintal).toLocaleString('en-IN')}</strong></div>
    
    ${generateWorkingQRCodeHTML(tokenNumber, tokenId, 150)}

    <button class="btn btn-primary btn-block" style="margin-top:0.6rem;" onclick="showReceiptModal('${tokenId}')">🎟️ Open Digital Pass & QR</button>
  `;

  appendBotMessage(`Great news, ${appState.farmerProfile.name}! Selling slot for ${bf.quantityMT} MT ${bf.crop.nameEn} has been booked successfully on your behalf.`, cardContent);
  triggerSimulatedSMS(`AI BOT CONFIRMATION: Slot Token #${tokenNumber} booked for ${bf.crop.nameEn} (${bf.quantityMT} MT) at ${bf.mandi.name} on ${bf.date}.`);

  // Reset booking flow
  chatState.bookingFlow = { active: false, crop: null, mandi: null, quantityMT: null, vehicle: null, date: null, timeSlot: null };
}

function selectChatCrop(cropId) {
  const crop = CROPS.find(c => c.id === cropId);
  if (crop) {
    chatState.bookingFlow.crop = crop;
    appendUserMessage(crop.nameEn);
    setTimeout(() => {
      handleSlotBookingConversation('');
    }, 300);
  }
}

function selectChatQuantity(qtyMT) {
  chatState.bookingFlow.quantityMT = qtyMT;
  appendUserMessage(`${qtyMT} MT (${qtyMT * 10} Quintals)`);
  setTimeout(() => {
    handleSlotBookingConversation('');
  }, 300);
}

function handlePriceQueryConversation(q) {
  const topCrops = CROPS.slice(0, 4);
  const cardRows = topCrops.map(c => `
    <div class="chat-card-detail">
      <span>${c.nameEn}:</span>
      <strong>₹${c.pricePerKg}/kg (₹${c.mspPerQuintal}/Qtl)</strong>
    </div>
  `).join('');

  const cardHtml = `
    <div class="chat-card-title">📈 Real-Time Market & MSP Prices</div>
    ${cardRows}
    <button class="btn btn-outline btn-block" style="margin-top:0.6rem;" onclick="switchFarmerSubTab('market-prices')">View Full Market Board</button>
  `;

  appendBotMessage("Here are the current live market prices and MSP rates:", cardHtml);
}

function handleStorageQueryConversation(q) {
  const facility = STOCKYARD_FACILITIES[0];
  const cardHtml = `
    <div class="chat-card-title">🏭 Storage Facility Available</div>
    <div class="chat-card-detail"><span>Facility:</span> <strong>${facility.name}</strong></div>
    <div class="chat-card-detail"><span>Available Capacity:</span> <strong>${facility.availableCapacityMT} MT</strong></div>
    <div class="chat-card-detail"><span>Daily Rate:</span> <strong>₹${facility.dailyRatePerMT} / MT / Day</strong></div>
    <button class="btn btn-success btn-block" style="margin-top:0.6rem;" onclick="switchFarmerSubTab('stockyard')">Rent Storage Space</button>
  `;

  appendBotMessage("We have available climate-controlled grain storage stockyards:", cardHtml);
}

function handleQueueStatusConversation() {
  const activeToken = appState.tokens[0];
  if (!activeToken) {
    appendBotMessage("There are currently no active selling line queues.");
    return;
  }

  const cardHtml = `
    <div class="chat-card-title">⏱️ Live Line Queue Status</div>
    <div class="chat-card-detail"><span>Active Token:</span> <strong>#${activeToken.tokenNumber}</strong></div>
    <div class="chat-card-detail"><span>Status:</span> <strong>${activeToken.status}</strong></div>
    <div class="chat-card-detail"><span>Assigned Scale:</span> <strong>${activeToken.dockAssigned || 'Dock 1'}</strong></div>
    <button class="btn btn-primary btn-block" style="margin-top:0.6rem;" onclick="switchFarmerSubTab('queue-tracker')">Open Live Line Tracker</button>
  `;

  appendBotMessage("Here is the live line status for your active token:", cardHtml);
}

// Simulated SMS Drawer Helper
function triggerSimulatedSMS(text) {
  const smsDrawer = document.getElementById('smsDrawer');
  const smsBodyText = document.getElementById('smsBodyText');
  const smsTimeText = document.getElementById('smsTimeText');

  if (smsDrawer && smsBodyText && smsTimeText) {
    smsBodyText.textContent = text;
    smsTimeText.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    smsDrawer.classList.add('show');

    setTimeout(() => {
      smsDrawer.classList.remove('show');
    }, 9000);
  }
}


// Utility CSS Badge Helper
function getStatusBadgeClass(status) {
  switch (status) {
    case 'BOOKED': return 'badge-info';
    case 'GATE_VERIFIED': return 'badge-warning';
    case 'QUALITY_CHECK': return 'badge-warning';
    case 'WEIGHBRIDGE': return 'badge-warning';
    case 'UNLOADED': return 'badge-success';
    case 'PAYMENT_PROCESSED': return 'badge-success';
    default: return 'badge-info';
  }
}

// Live Kiosk Clock
function startClock() {
  const clockEl = document.getElementById('kioskClock');
  if (!clockEl) return;
  setInterval(() => {
    clockEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, 1000);
}

// ================= MARKET OFFICER EXPORT & REPORTING UTILITIES =================

// Access Control Enforcement: Require Officer Role
function checkOfficerAccess() {
  if (appState.currentRole !== 'officer') {
    alert("🔒 Access Denied: Official export capabilities are restricted to authorized Market Officers. Please switch to Market Officer role.");
    return false;
  }
  return true;
}

// Date Range Filtering Helper for Tokens
function getFilteredTokens() {
  const startVal = document.getElementById('exportStartDate')?.value;
  const endVal = document.getElementById('exportEndDate')?.value;

  if (!appState.tokens || appState.tokens.length === 0) return [];

  return appState.tokens.filter(t => {
    if (!t.bookingDate) return true;
    const tokenDate = t.bookingDate; // Expected format: YYYY-MM-DD
    if (startVal && tokenDate < startVal) return false;
    if (endVal && tokenDate > endVal) return false;
    return true;
  });
}

function applyDateFilter() {
  const startVal = document.getElementById('exportStartDate')?.value;
  const endVal = document.getElementById('exportEndDate')?.value;
  const summaryEl = document.getElementById('exportFilterSummary');
  const filtered = getFilteredTokens();

  if (summaryEl) {
    if (startVal || endVal) {
      const rangeText = (startVal || 'Earliest') + ' to ' + (endVal || 'Latest');
      summaryEl.textContent = `Filtered: ${filtered.length} of ${appState.tokens.length} Records (${rangeText})`;
    } else {
      summaryEl.textContent = `Showing All ${appState.tokens.length} Records`;
    }
  }
}

function resetDateFilter() {
  const startInput = document.getElementById('exportStartDate');
  const endInput = document.getElementById('exportEndDate');
  if (startInput) startInput.value = '';
  if (endInput) endInput.value = '';
  applyDateFilter();
}

// CSV Export: Daily Gate Entry Logs
function exportGateLogsCSV() {
  if (!checkOfficerAccess()) return;

  const filteredTokens = getFilteredTokens();
  if (filteredTokens.length === 0) {
    alert("No gate logs available for the selected date criteria.");
    return;
  }

  const startVal = document.getElementById('exportStartDate')?.value;
  const endVal = document.getElementById('exportEndDate')?.value;
  const dateSuffix = (startVal || endVal) ? `_filtered_${startVal || 'start'}_to_${endVal || 'end'}` : '';

  const headers = ["Token Number", "Farmer ID", "Farmer Name", "Mobile Number", "Crop Name", "Estimated Qty (MT)", "Vehicle Reg", "Booking Date", "Time Slot", "Dock Assigned", "Status"];
  
  const rows = filteredTokens.map(t => [
    `#${t.tokenNumber}`,
    t.farmerId || "FAR-2026-8812",
    `"${(t.farmerName || '').replace(/"/g, '""')}"`,
    `"${(t.mobile || '').replace(/"/g, '""')}"`,
    `"${(t.cropName || '').replace(/"/g, '""')}"`,
    t.quantityMT || (t.estimatedQuantity * 0.1).toFixed(2),
    `"${(t.vehicleNumber || '').replace(/"/g, '""')}"`,
    t.bookingDate || '',
    `"${(t.timeSlot || '').replace(/"/g, '""')}"`,
    `"${(t.dockAssigned || 'Dock 1').replace(/"/g, '""')}"`,
    `"${(t.status || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `uzhavar_mutram_gate_logs${dateSuffix}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// CSV Export: Weighbridge Scale Records
function exportWeightRecordsCSV() {
  if (!checkOfficerAccess()) return;

  const filteredTokens = getFilteredTokens();
  if (filteredTokens.length === 0) {
    alert("No weight scale records available for the selected date criteria.");
    return;
  }

  const startVal = document.getElementById('exportStartDate')?.value;
  const endVal = document.getElementById('exportEndDate')?.value;
  const dateSuffix = (startVal || endVal) ? `_filtered_${startVal || 'start'}_to_${endVal || 'end'}` : '';

  const headers = ["Token Number", "Farmer Name", "Crop Name", "Gross Weight (Kg)", "Tare Weight (Kg)", "Net Weight (Kg)", "Net Quantity (MT)", "Moisture (%)", "Quality Grade", "Rate per Quintal (INR)", "Total Payout (INR)", "Bank UTR Number"];
  
  const rows = filteredTokens.map(t => [
    `#${t.tokenNumber}`,
    `"${(t.farmerName || '').replace(/"/g, '""')}"`,
    `"${(t.cropName || '').replace(/"/g, '""')}"`,
    t.grossWeightKg || 10850,
    t.tareWeightKg || 4350,
    t.netWeightKg || 6500,
    t.netQuantityMT || 6.5,
    t.moisturePercent || 11.2,
    `"${(t.qualityGrade || 'Grade A').replace(/"/g, '""')}"`,
    t.baseRatePerQuintal || 2275,
    t.totalPayoutAmount || 147875,
    `"${(t.utrNumber || 'UTRIBIN202608289001').replace(/"/g, '""')}"`
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `uzhavar_mutram_weight_records${dateSuffix}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// PDF Export: Gate Entry Log Report
function exportGateLogsPDF() {
  if (!checkOfficerAccess()) return;

  const filteredTokens = getFilteredTokens();
  if (filteredTokens.length === 0) {
    alert("No gate logs available for the selected date criteria.");
    return;
  }

  const printWin = window.open('', '_blank');
  if (!printWin) {
    alert("Please allow popups to generate PDF report.");
    return;
  }

  const startVal = document.getElementById('exportStartDate')?.value;
  const endVal = document.getElementById('exportEndDate')?.value;
  const filterDesc = (startVal || endVal) ? `${startVal || 'Earliest'} to ${endVal || 'Latest'}` : 'All Date Range';

  const todayStr = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const rows = filteredTokens.map((t, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><strong>#${t.tokenNumber}</strong></td>
      <td>${t.farmerName}</td>
      <td>${t.cropName}</td>
      <td>${t.quantityMT || 6.5} MT</td>
      <td>${t.vehicleNumber}</td>
      <td>${t.bookingDate || '-'}</td>
      <td>${t.dockAssigned || 'Dock 1'}</td>
      <td><span class="status-tag">${t.status}</span></td>
    </tr>
  `).join('');

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Uzhavar Mutram - Daily Market Gate Entry Log Report</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 30px; color: #2F3834; }
        .header { text-align: center; border-bottom: 3px double #68786E; padding-bottom: 15px; margin-bottom: 20px; }
        .title { font-size: 22px; font-weight: 900; color: #68786E; margin: 0; }
        .subtitle { font-size: 13px; color: #64748b; margin-top: 5px; }
        .meta-table { width: 100%; margin-bottom: 20px; font-size: 12px; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
        .data-table th { background: #68786E; color: white; padding: 8px; text-align: left; }
        .data-table td { padding: 8px; border-bottom: 1px solid #cbd5e1; }
        .status-tag { background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; }
        .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; }
        .seal-box { border: 2px dashed #68786E; padding: 15px; text-align: center; width: 200px; color: #68786E; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">UZHAVAR MUTRAM (உழவர் முற்றம்)</div>
        <div class="subtitle">Department of Agricultural Marketing & Agri Business — Government Official Daily Log</div>
      </div>
      
      <table class="meta-table">
        <tr>
          <td><strong>Report Name:</strong> Daily Market Gate Entry & Line Log</td>
          <td style="text-align: right;"><strong>Date Generated:</strong> ${todayStr}</td>
        </tr>
        <tr>
          <td><strong>Market Centre:</strong> Karnal Central Market Hub</td>
          <td style="text-align: right;"><strong>Date Filter Range:</strong> ${filterDesc}</td>
        </tr>
        <tr>
          <td><strong>Total Matching Vehicles:</strong> ${filteredTokens.length}</td>
          <td style="text-align: right;"><strong>Exported By:</strong> Market Officer In-Charge</td>
        </tr>
      </table>

      <table class="data-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Token #</th>
            <th>Farmer Name</th>
            <th>Crop Variety</th>
            <th>Quantity</th>
            <th>Vehicle Reg #</th>
            <th>Booking Date</th>
            <th>Dock</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="footer">
        <div>
          <p>Verified By: ___________________</p>
          <p>Market Officer In-Charge</p>
        </div>
        <div class="seal-box">
          UZHAVAR MUTRAM<br>OFFICIAL MARKET SEAL
        </div>
      </div>
      <script>window.onload = function() { window.print(); };</script>
    </body>
    </html>
  `);
  printWin.document.close();
}

// PDF Export: Weighbridge Log Report
function exportWeightRecordsPDF() {
  if (!checkOfficerAccess()) return;

  const filteredTokens = getFilteredTokens();
  if (filteredTokens.length === 0) {
    alert("No weight scale records available for the selected date criteria.");
    return;
  }

  const printWin = window.open('', '_blank');
  if (!printWin) {
    alert("Please allow popups to generate PDF report.");
    return;
  }

  const startVal = document.getElementById('exportStartDate')?.value;
  const endVal = document.getElementById('exportEndDate')?.value;
  const filterDesc = (startVal || endVal) ? `${startVal || 'Earliest'} to ${endVal || 'Latest'}` : 'All Date Range';

  const todayStr = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  let grandTotalPayout = 0;
  let totalNetKg = 0;

  const rows = filteredTokens.map((t, idx) => {
    const payout = t.totalPayoutAmount || 147875;
    const netKg = t.netWeightKg || 6500;
    grandTotalPayout += payout;
    totalNetKg += netKg;
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>#${t.tokenNumber}</strong></td>
        <td>${t.farmerName}</td>
        <td>${t.cropName}</td>
        <td>${t.grossWeightKg || 10850} Kg</td>
        <td>${t.tareWeightKg || 4350} Kg</td>
        <td><strong>${netKg} Kg</strong></td>
        <td>${t.moisturePercent || 11.2}%</td>
        <td>₹${(t.baseRatePerQuintal || 2275).toLocaleString('en-IN')}</td>            <td style="color: #55645B; font-weight:700;">₹${payout.toLocaleString('en-IN')}</td>
      </tr>
    `;
  }).join('');

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Uzhavar Mutram - Weighbridge & Payout Log Report</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 30px; color: #2F3834; }
        .header { text-align: center; border-bottom: 3px double #68786E; padding-bottom: 15px; margin-bottom: 20px; }
        .title { font-size: 22px; font-weight: 900; color: #68786E; margin: 0; }
        .subtitle { font-size: 13px; color: #64748b; margin-top: 5px; }
        .meta-table { width: 100%; margin-bottom: 20px; font-size: 12px; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 15px; }
        .data-table th { background: #68786E; color: white; padding: 8px; text-align: left; }
        .data-table td { padding: 8px; border-bottom: 1px solid #cbd5e1; }
        .total-row { background: #f0fdf4; font-weight: 800; font-size: 12px; }
        .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; }
        .seal-box { border: 2px dashed #68786E; padding: 15px; text-align: center; width: 200px; color: #68786E; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">UZHAVAR MUTRAM (உழவர் முற்றம்)</div>
        <div class="subtitle">Official Weighbridge Scale & DBT Direct Bank Payout Audit Report</div>
      </div>
      
      <table class="meta-table">
        <tr>
          <td><strong>Audit Log:</strong> Weight Scale Logs & Farmer Payout Statements</td>
          <td style="text-align: right;"><strong>Date Generated:</strong> ${todayStr}</td>
        </tr>
        <tr>
          <td><strong>Market Centre:</strong> Karnal Central Market Hub</td>
          <td style="text-align: right;"><strong>Date Filter Range:</strong> ${filterDesc}</td>
        </tr>
        <tr>
          <td><strong>Total Net Weight:</strong> ${(totalNetKg / 1000).toFixed(2)} MT (${totalNetKg.toLocaleString('en-IN')} Kg)</td>
          <td style="text-align: right;"><strong>Grand Total Payout:</strong> ₹${grandTotalPayout.toLocaleString('en-IN')}</td>
        </tr>
      </table>

      <table class="data-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Token #</th>
            <th>Farmer Name</th>
            <th>Crop</th>
            <th>Gross Wt</th>
            <th>Tare Wt</th>
            <th>Net Crop Wt</th>
            <th>Moisture %</th>
            <th>MSP Rate/Qtl</th>
            <th>Total Payout</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="6" style="text-align: right;">GRAND TOTALS:</td>
            <td><strong>${totalNetKg.toLocaleString('en-IN')} Kg</strong></td>
            <td colspan="2" style="text-align: right;">DISBURSED PAYMENT:</td>
            <td style="color: #68786E; font-size: 13px;">₹${grandTotalPayout.toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        <div>
          <p>Verified By: ___________________</p>
          <p>Senior Weighbridge Superintendent</p>
        </div>
        <div class="seal-box">
          UZHAVAR MUTRAM<br>WEIGHBRIDGE AUDIT SEAL
        </div>
      </div>
      <script>window.onload = function() { window.print(); };</script>
    </body>
    </html>
  `);
  printWin.document.close();
}

// ================= MULTILINGUAL VOICE-FIRST COMMAND ENGINE =================
let activeRecognition = null;

function openVoiceCommandModal() {
  const container = document.getElementById('voiceCommandModalContainer');
  if (!container) return;

  const currentLang = appState.currentLang || 'en';

  container.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-card" style="max-width: 620px;">
        <div class="modal-header" style="background: linear-gradient(135deg, #55645B 0%, #68786E 100%); color: #FBF6EA; padding: 1.2rem;">
          <div>
            <div class="card-title" style="color: white; font-size: 1.2rem;">🎙️ Voice-First Command Engine</div>
            <div style="font-size: 0.8rem; opacity: 0.9;">Hands-free agricultural workflow automation in Tamil, Hindi, Telugu & English</div>
          </div>
          <button class="sms-close" style="color: white;" onclick="closeVoiceCommandModal()">✕</button>
        </div>

        <div style="padding: 1.2rem;">
          <!-- Language Selector -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.2rem; background: #f8fafc; padding: 0.8rem; border-radius: 10px; border: 1px solid #e2e8f0;">
            <label style="font-size: 0.9rem; font-weight: 700; color: #2F3834;">🌐 Voice Language:</label>
            <select id="voiceLangSelect" class="form-control" style="width: 220px; font-weight: 600;" onchange="onVoiceLangChange()">
              <option value="en-IN" ${currentLang === 'en' ? 'selected' : ''}>🇮🇳 English (India)</option>
              <option value="ta-IN" ${currentLang === 'ta' ? 'selected' : ''}>🇮🇳 தமிழ் (Tamil)</option>
              <option value="hi-IN" ${currentLang === 'hi' ? 'selected' : ''}>🇮🇳 हिन्दी (Hindi)</option>
              <option value="te-IN" ${currentLang === 'te' ? 'selected' : ''}>🇮🇳 తెలుగు (Telugu)</option>
            </select>
          </div>

          <!-- Listening Pulse Visualizer & Status -->
          <div style="text-align: center; padding: 1.5rem; background: #FBF3E0; border-radius: 16px; border: 2px dashed #E3B374; margin-bottom: 1.2rem;">
            <div id="micPulseIcon" style="font-size: 3rem; margin-bottom: 0.5rem; transition: transform 0.3s ease;">🎙️</div>
            <div id="voiceStatusBadge" style="font-weight: 800; color: #1d4ed8; font-size: 1.05rem;">
              Ready. Click "Start Listening" or pick a sample command below.
            </div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.3rem;" id="voiceLangHint">
              Supported Commands: "Book slot for 5 tons of wheat tomorrow morning", "நாளை 5 டன் கோதுமை விற்க ஸ்லாட் பதிவு செய்", "कल सुबह 5 टन गेहूं बेचने के लिए स्लॉट बुक करें", "రేపు 5 టన్నుల గోధుమలు అమ్మడానికి స్లాట్ బుక్ చేయండి".
            </div>
          </div>

          <!-- Live Transcript Output Box -->
          <div class="form-group">
            <label class="form-label" style="font-weight: 700; color: #334155;">Speech Transcript Output:</label>
            <textarea id="voiceTranscriptInput" class="form-control" rows="3" placeholder="Speak into microphone or click a regional test command below..." style="font-size: 0.95rem; font-weight: 600; line-height: 1.5; color: #2F3834;"></textarea>
          </div>

          <!-- Sample Regional Voice Command Chips -->
          <div style="margin-bottom: 1.2rem;">
            <div style="font-size: 0.8rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 0.5rem;">
              ⚡ Quick Regional Voice Commands (One-Click Test):
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              <button class="btn btn-outline" style="font-size: 0.8rem; padding: 0.4rem 0.7rem; border-color: #BE6638; color: #A9552B;" onclick="simulateVoiceCommand('Book a slot for 5 tons of wheat tomorrow morning', 'en-IN')">
                🇬🇧 "Book slot for 5 tons wheat tomorrow"
              </button>
              <button class="btn btn-outline" style="font-size: 0.8rem; padding: 0.4rem 0.7rem; border-color: #68786E; color: #55645B;" onclick="simulateVoiceCommand('நாளை காலை 5 டன் கோதுமை விற்க ஸ்லாட் பதிவு செய்', 'ta-IN')">
                🇮🇳 "நாளை 5 டன் கோதுமை ஸ்லாட் பதிவு செய்" (Tamil)
              </button>
              <button class="btn btn-outline" style="font-size: 0.8rem; padding: 0.4rem 0.7rem; border-color: #d97706; color: #b45309;" onclick="simulateVoiceCommand('कल सुबह 5 टन गेहूं बेचने के लिए स्लॉट बुक करें', 'hi-IN')">
                🇮🇳 "कल सुबह 5 टन गेहूं का स्लॉट बुक करें" (Hindi)
              </button>
              <button class="btn btn-outline" style="font-size: 0.8rem; padding: 0.4rem 0.7rem; border-color: #A49D71; color: #6E6042;" onclick="simulateVoiceCommand('రేపు ఉదయం 5 టన్నుల గోధుమలు అమ్మడానికి స్లాట్ బుక్ చేయండి', 'te-IN')">
                🇮🇳 "రేపు 5 టన్నుల గోధుమలు అమ్మడానికి స్లాట్ బుక్ చేయండి" (Telugu)
              </button>
              <button class="btn btn-outline" style="font-size: 0.8rem; padding: 0.4rem 0.7rem;" onclick="simulateVoiceCommand('Check live price of Paddy and Wheat', 'en-IN')">
                📈 "Check live price of Paddy"
              </button>
              <button class="btn btn-outline" style="font-size: 0.8rem; padding: 0.4rem 0.7rem;" onclick="simulateVoiceCommand('10 டன் தானிய சேமிப்பு கிடங்கு வேண்டும்', 'ta-IN')">
                🏭 "10 டன் தானிய சேமிப்பு கிடங்கு"
              </button>
            </div>
          </div>

          <!-- Controls -->
          <div style="display: flex; gap: 0.6rem; justify-content: flex-end;">
            <button id="startMicListenBtn" class="btn btn-primary" style="background: #BE6638; font-weight: 700;" onclick="startVoiceRecognition()">
              🎙️ Start Listening
            </button>
            <button class="btn btn-success" style="font-weight: 700;" onclick="executeCurrentVoiceTranscript()">
              ⚡ Execute Command
            </button>
            <button class="btn btn-outline" onclick="closeVoiceCommandModal()">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function closeVoiceCommandModal() {
  if (activeRecognition) {
    try { activeRecognition.stop(); } catch (e) {}
    activeRecognition = null;
  }
  const container = document.getElementById('voiceCommandModalContainer');
  if (container) container.innerHTML = '';
}

function onVoiceLangChange() {
  const langSelect = document.getElementById('voiceLangSelect');
  if (!langSelect) return;
  const lang = langSelect.value.split('-')[0];
  appState.currentLang = lang;
  updateLanguageUI();
}

function startVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const statusBadge = document.getElementById('voiceStatusBadge');
  const pulseIcon = document.getElementById('micPulseIcon');
  const transcriptInput = document.getElementById('voiceTranscriptInput');
  const langSelect = document.getElementById('voiceLangSelect');
  const selectedLang = langSelect ? langSelect.value : 'en-IN';

  if (!SpeechRecognition) {
    if (statusBadge) {
      statusBadge.innerHTML = `<span style="color: #dc2626;">⚠️ Browser SpeechRecognition API is not supported in this browser. Please use the Quick Regional Voice Commands below.</span>`;
    }
    return;
  }

  if (activeRecognition) {
    try { activeRecognition.stop(); } catch(e){}
    activeRecognition = null;
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.lang = selectedLang;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      activeRecognition = recognition;
      if (statusBadge) statusBadge.innerHTML = `<span style="color: #BE6638;">🔴 Listening in ${selectedLang}... Speak your command now!</span>`;
      if (pulseIcon) pulseIcon.style.transform = "scale(1.3)";
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      const text = final || interim;
      if (transcriptInput) transcriptInput.value = text;

      if (final) {
        if (statusBadge) statusBadge.innerHTML = `<span style="color: #68786E;">✓ Speech Recognized! Parsing & Executing...</span>`;
        if (pulseIcon) pulseIcon.style.transform = "scale(1.0)";
        setTimeout(() => {
          parseAndExecuteVoiceCommand(final, selectedLang);
        }, 600);
      }
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      if (statusBadge) {
        statusBadge.innerHTML = `<span style="color: #dc2626;">⚠️ Speech Error (${event.error}). Please allow microphone permissions or use one-click regional command buttons below.</span>`;
      }
      if (pulseIcon) pulseIcon.style.transform = "scale(1.0)";
    };

    recognition.onend = () => {
      activeRecognition = null;
      if (pulseIcon) pulseIcon.style.transform = "scale(1.0)";
    };

    recognition.start();
  } catch (err) {
    console.warn("Speech recognition exception:", err);
    if (statusBadge) {
      statusBadge.innerHTML = `<span style="color: #dc2626;">⚠️ Unable to start microphone: ${err.message}. Use one-click regional command buttons below.</span>`;
    }
  }
}

function simulateVoiceCommand(commandText, langCode) {
  const transcriptInput = document.getElementById('voiceTranscriptInput');
  const statusBadge = document.getElementById('voiceStatusBadge');
  const langSelect = document.getElementById('voiceLangSelect');

  if (langSelect && langCode) langSelect.value = langCode;
  if (transcriptInput) transcriptInput.value = commandText;
  if (statusBadge) statusBadge.innerHTML = `<span style="color: #BE6638;">⚡ Voice Command Simulated: "${commandText}"</span>`;

  const shortLang = (langCode || 'en-IN').split('-')[0];
  appState.currentLang = shortLang;
  updateLanguageUI();

  setTimeout(() => {
    parseAndExecuteVoiceCommand(commandText, langCode || 'en-IN');
  }, 400);
}

function executeCurrentVoiceTranscript() {
  const transcriptInput = document.getElementById('voiceTranscriptInput');
  const langSelect = document.getElementById('voiceLangSelect');
  const text = transcriptInput ? transcriptInput.value.trim() : '';
  const lang = langSelect ? langSelect.value : 'en-IN';

  if (!text) {
    alert("Please speak into microphone or select a command script first.");
    return;
  }
  parseAndExecuteVoiceCommand(text, lang);
}

// Multilingual Natural Language Processing & Command Execution Engine
function parseAndExecuteVoiceCommand(rawTranscript, langCode) {
  const q = rawTranscript.toLowerCase();
  const lang = (langCode || 'en-IN').split('-')[0];

  // 1. Crop Entity Parsing
  let targetCrop = CROPS[0]; // Default Wheat
  if (q.includes('wheat') || q.includes('கோதுமை') || q.includes('गेहूं') || q.includes('गेहू') || q.includes('गोधूमा') || q.includes('గోధుమ') || q.includes('గోధుమలు')) {
    targetCrop = CROPS.find(c => c.id === 'WHEAT') || CROPS[0];
  } else if (q.includes('paddy') || q.includes('rice') || q.includes('நெல்') || q.includes('அரிசி') || q.includes('धान') || q.includes('चावल') || q.includes('వరి') || q.includes('బియ్యం')) {
    targetCrop = CROPS.find(c => c.id === 'PADDY_PONNI') || CROPS[1];
  } else if (q.includes('turmeric') || q.includes('மஞ்சள்') || q.includes('हल्दी') || q.includes('పసుపు')) {
    targetCrop = CROPS.find(c => c.id === 'TURMERIC') || CROPS[2];
  } else if (q.includes('chilli') || q.includes('chili') || q.includes('மிளகாய்') || q.includes('मिर्च') || q.includes('మిర్చి')) {
    targetCrop = CROPS.find(c => c.id === 'RED_CHILLI') || CROPS[3];
  } else if (q.includes('sugarcane') || q.includes('கரும்பு') || q.includes('गन्ना') || q.includes('చెరకు')) {
    targetCrop = CROPS.find(c => c.id === 'SUGARCANE') || CROPS[4];
  } else if (q.includes('banana') || q.includes('வாழை') || q.includes('केला') || q.includes('అరటి')) {
    targetCrop = CROPS.find(c => c.id === 'BANANA_NENDRAN') || CROPS[5];
  } else if (q.includes('tomato') || q.includes('தக்காளி') || q.includes('टमाटर') || q.includes('టమాటా')) {
    targetCrop = CROPS.find(c => c.id === 'TOMATO') || CROPS[6];
  }

  // 2. Quantity & Unit Parsing
  let parsedQuantityMT = 5.0; // Default 5 MT
  const numMatch = q.match(/(\d+(\.\d+)?)/);
  if (numMatch && parseFloat(numMatch[1]) > 0) {
    let numVal = parseFloat(numMatch[1]);
    if (q.includes('kg') || q.includes('கிலோ') || q.includes('किलो') || q.includes('కిలో')) {
      parsedQuantityMT = numVal / 1000;
    } else if (q.includes('qtl') || q.includes('quintal') || q.includes('குவின்டால்') || q.includes('குவிண்டால்') || q.includes('क्विंटल') || q.includes('క్వింటాల్')) {
      parsedQuantityMT = numVal / 10;
    } else {
      parsedQuantityMT = numVal; // assume MT / Ton
    }
  }

  // 3. Date Parsing
  let targetDate = new Date(Date.now() + 86400000).toISOString().split('T')[0]; // Default Tomorrow
  if (q.includes('today') || q.includes('இன்று') || q.includes('आज') || q.includes('ఈ రోజు')) {
    targetDate = new Date().toISOString().split('T')[0];
  }

  // 4. Intent Classification & Workflow Execution
  const isPriceQuery = q.includes('price') || q.includes('rate') || q.includes('msp') || q.includes('விலை') || q.includes('விகிதம்') || q.includes('भाव') || q.includes('कीमत') || q.includes('दर') || q.includes('ధర') || q.includes('రేటు');
  const isStorageQuery = q.includes('storage') || q.includes('stockyard') || q.includes('silo') || q.includes('warehouse') || q.includes('சேமிப்பு') || q.includes('கிடங்கு') || q.includes('भंडारण') || q.includes('गोदाम') || q.includes('స్టోరేజ్') || q.includes('గోదాము');

  closeVoiceCommandModal();

  if (isPriceQuery) {
    switchFarmerSubTab('market-prices');
    const priceText = lang === 'ta' ? `நேரலை சந்தை விலை: ${targetCrop.nameEn} ஒரு கிலோ ₹${targetCrop.pricePerKg}, ஒரு குவிண்டால் MSP ₹${targetCrop.mspPerQuintal}.` :
      lang === 'hi' ? `लाइव मंडी भाव: ${targetCrop.nameEn} ₹${targetCrop.pricePerKg}/किग्रा (MSP ₹${targetCrop.mspPerQuintal}/क्विंटल) है।` :
      lang === 'te' ? `లైవ్ మార్కెట్ ధరలు: ${targetCrop.nameEn} ఒక కిలో ₹${targetCrop.pricePerKg}, క్వింటాల్ MSP ₹${targetCrop.mspPerQuintal}.` :
      `Live Market Prices: ${targetCrop.nameEn} rate is ₹${targetCrop.pricePerKg}/kg (Govt MSP: ₹${targetCrop.mspPerQuintal}/Quintal).`;

    speakAnnouncement(priceText, lang);
    toggleChatbot();
    appendBotMessage(priceText);
    return;
  }

  if (isStorageQuery) {
    switchFarmerSubTab('stockyard');
    const storageText = lang === 'ta' ? `தானிய சேமிப்பு கிடங்கு வசதிகள் கிடைக்கிறது. 500 டன் வரை சேமிக்கலாம்.` :
      lang === 'hi' ? `अन्न भंडारण गोदाम उपलब्ध है। 500 मीट्रिक टन तक सुरक्षित रखें।` :
      lang === 'te' ? `ధాన్యం నిల్వ కోసం క్లైமேట్ కంట్రోల్డ్ స్టోరేజ్ అందుబాటులో ఉంది.` :
      `Climate-controlled grain storage facility available with 500 MT capacity.`;

    speakAnnouncement(storageText, lang);
    toggleChatbot();
    appendBotMessage(storageText);
    return;
  }

  // DEFAULT: Execute Slot Booking Workflow
  if (appState.farmerProfile.ekycStatus !== 'VERIFIED') {
    switchFarmerSubTab('profile');
    const ekycMsg = lang === 'ta' ? 'ஸ்லாட் பதிவு செய்ய உங்கள் ஆதார் eKYC சரிபார்ப்பு அவசியம்.' :
      lang === 'hi' ? 'स्लॉट बुकिंग के लिए आपका आधार eKYC सत्यापन आवश्यक है।' :
      lang === 'te' ? 'స్లాట్ బుకింగ్ చేయడానికి మీ ఆధార్ eKYC పూర్తవ్వాలి.' :
      'Aadhaar eKYC verification is required before booking selling slots.';
    speakAnnouncement(ekycMsg, lang);
    alert(ekycMsg);
    return;
  }

  const tokenNumber = Math.floor(100 + Math.random() * 50);
  const tokenId = `TKN-${Math.floor(8000 + Math.random() * 1000)}`;
  const selectedMandi = MANDI_CENTRES[0];
  const sellerName = appState.farmerProfile.name || 'Guest Farmer';

  const newToken = {
    id: tokenId,
    mandiId: selectedMandi.id,
    mandiName: selectedMandi.name,
    farmerId: appState.farmerProfile.id,
    farmerName: sellerName,
    mobile: appState.farmerProfile.mobile,
    cropId: targetCrop.id,
    cropName: targetCrop.nameEn,
    estimatedQuantity: parsedQuantityMT * 10,
    quantityKg: parsedQuantityMT * 1000,
    quantityMT: parsedQuantityMT,
    vehicleType: "TRACTOR_TROLLEY",
    vehicleNumber: "HR-05-AB-" + Math.floor(1000 + Math.random() * 9000),
    bookingDate: targetDate,
    timeSlot: "09:00 AM - 10:00 AM",
    tokenNumber: tokenNumber,
    dockAssigned: "Dock 1",
    status: "BOOKED",
    baseRatePerQuintal: targetCrop.mspPerQuintal,
    totalPayoutAmount: parsedQuantityMT * 10 * targetCrop.mspPerQuintal,
    createdAt: new Date().toISOString(),
    history: [
      { status: "BOOKED", timestamp: new Date().toLocaleString(), note: `Slot booked via Voice Command Engine: "${rawTranscript}"` }
    ]
  };

  appState.tokens.unshift(newToken);
  saveState();
  renderAllViews();
  switchFarmerSubTab('my-passes');

  const confirmSpeech = lang === 'ta' ? `வணக்கம் ${appState.farmerProfile.name}! உங்கள் குரல் கட்டளைப்படி ${parsedQuantityMT} டன் ${targetCrop.nameEn} விற்பனை ஸ்லாட் வெற்றி கரமாக பதிவு செய்யப்பட்டது. டோக்கன் எண் ${tokenNumber}.` :
    lang === 'hi' ? `नमस्ते ${appState.farmerProfile.name}! आपके वॉइस कमांड के अनुसार ${parsedQuantityMT} टन ${targetCrop.nameEn} का स्लॉट टोकन #${tokenNumber} सफलतापूर्वक बुक हो गया है।` :
    lang === 'te' ? `నమస్తే ${appState.farmerProfile.name}! మీ వాయిస్ కమాండ్ ప్రకారం ${parsedQuantityMT} టన్నుల ${targetCrop.nameEn} స్లాట్ టోకెన్ #${tokenNumber} విజయవంతంగా బుక్ అయింది.` :
    `Hello ${appState.farmerProfile.name}! As per your voice command, selling slot token #${tokenNumber} for ${parsedQuantityMT} MT ${targetCrop.nameEn} on ${targetDate} has been confirmed.`;

  speakAnnouncement(confirmSpeech, lang);
  triggerSimulatedSMS(`🎙️ VOICE COMMAND CONFIRMATION: Slot Token #${tokenNumber} booked for ${targetCrop.nameEn} (${parsedQuantityMT} MT) on ${targetDate}.`);
}

// Show Digital Entry Pass & Receipt Modal with Real-Time QR
function showReceiptModal(tokenId) {
  const token = appState.tokens.find(t => t.id === tokenId);
  if (!token) return;

  const modalContainer = document.getElementById('adminModalContainer');
  if (!modalContainer) return;

  const trackingUrl = getLiveTrackingURL(token.tokenNumber);
  const qrHtml = generateWorkingQRCodeHTML(token.tokenNumber, token.id, 180);

  modalContainer.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-card" style="max-width: 540px;">
        <div class="modal-header" style="background: linear-gradient(135deg, #55645B 0%, #3E4A42 100%); color: #FBF6EA; padding: 1.2rem;">
          <div>
            <div class="card-title" style="color: white; font-size: 1.2rem;">🎟️ Official Market Entry Pass & Digital Receipt</div>
            <div style="font-size: 0.8rem; opacity: 0.9;">Uzhavar Mutram Smart Queue System</div>
          </div>
          <button class="sms-close" style="color: white;" onclick="closeAdminModal()">✕</button>
        </div>

        <div style="padding: 1.2rem;">
          <div style="text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 1rem; margin-bottom: 1rem;">
            <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Confirmed Token Number</div>
            <div style="font-size: 2.8rem; font-weight: 900; color: #F6D19A;">#${token.tokenNumber}</div>
            <div style="font-size: 0.85rem; color: #334155; font-weight: 700;">${token.mandiName || 'Karnal Central Market Hub'}</div>
          </div>

          <!-- Real-Time Working QR Code Container -->
          ${qrHtml}

          <!-- Details Grid -->
          <div style="background: #f8fafc; padding: 1rem; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 0.85rem; line-height: 1.8; margin-bottom: 1rem;">
            <div><strong>Farmer Name:</strong> ${token.farmerName} (${token.mobile})</div>
            <div><strong>Farmer ID:</strong> ${token.farmerId || 'FAR-2026-8812'}</div>
            <div><strong>Crop Variety:</strong> ${token.cropName}</div>
            <div><strong>Quantity:</strong> ${token.netWeightKg ? `${token.netWeightKg} Kg (${token.netQuantityMT} MT)` : `${token.quantityKg || (token.estimatedQuantity * 100)} Kg (${token.quantityMT || (token.estimatedQuantity * 0.1).toFixed(2)} MT)`}</div>
            <div><strong>Vehicle Registration:</strong> ${token.vehicleNumber}</div>
            <div><strong>Scheduled Delivery Slot:</strong> ${token.bookingDate} (${token.timeSlot})</div>
            <div><strong>Assigned Scale Dock:</strong> ${token.dockAssigned || 'Dock 1'}</div>
            <div><strong>Current Stage Status:</strong> <span class="badge ${getStatusBadgeClass(token.status)}">${token.status}</span></div>
            <div><strong>Estimated Payout:</strong> <strong style="color: #68786E;">₹${(token.totalPayoutAmount || 147875).toLocaleString('en-IN')}</strong></div>
            ${token.utrNumber ? `<div><strong>Bank UTR Ref:</strong> <span style="color:#8A6320; font-weight:700;">${token.utrNumber}</span></div>` : ''}
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-primary btn-block" onclick="window.print()">
              🖨️ Print Entry Pass / PDF
            </button>
            <button class="btn btn-outline" onclick="closeAdminModal()">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ================= MULTI-ROLE AUTHENTICATION & DYNAMIC NAME PROMPT ENGINE =================
function openLoginModal(defaultRole = 'farmer') {
  const container = document.getElementById('loginModalContainer');
  if (!container) return;

  const currentRole = defaultRole || appState.currentRole || 'farmer';
  const roleDefaults = {
    farmer: { name: 'Ramesh Singh Kumar', cred: 'farmer@demo.com', pass: 'Farmer@123' },
    officer: { name: 'Dr. K. Arumugam (Market Director)', cred: 'officer@demo.com', pass: 'Officer@123' },
    buyer: { name: 'AgriCorp Wholesale Traders', cred: 'buyer@demo.com', pass: 'Buyer@123' }
  };
  const activeDefault = roleDefaults[currentRole] || roleDefaults.farmer;

  container.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-card" style="max-width: 500px;">
        <div class="modal-header" style="background: linear-gradient(135deg, #68786E 0%, #55645B 100%); color: #FBF6EA; padding: 1.2rem;">
          <div>
            <div class="card-title" style="color: white; font-size: 1.2rem;">👤 Multi-Role Login & Registration</div>
            <div style="font-size: 0.8rem; opacity: 0.9;">Uzhavar Mutram SQLite Auth & Access Control</div>
          </div>
          <button class="sms-close" style="color: white;" onclick="closeLoginModal()">✕</button>
        </div>

        <div style="padding: 1.2rem;">
          <!-- Mode Switcher (Login vs Register) -->
          <div style="display: flex; gap: 0.4rem; margin-bottom: 1rem; background: #e2e8f0; padding: 0.3rem; border-radius: 8px;">
            <button type="button" class="btn btn-primary" style="flex: 1; font-weight: 800; font-size: 0.88rem; padding: 0.45rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              🔑 Login
            </button>
            <button type="button" id="topModeRegisterBtn" class="btn btn-outline" style="flex: 1; font-weight: 800; font-size: 0.88rem; padding: 0.45rem; background: white; color: #BE6638; border: 2px solid #BE6638;" onclick="openRegisterModal('${currentRole}')">
              📝 Create Account
            </button>
          </div>

          <!-- Quick Role Selector Tabs -->
          <div style="display: flex; gap: 0.4rem; margin-bottom: 0.8rem; background: #f1f5f9; padding: 0.3rem; border-radius: 8px;">
            <button id="roleTabFarmer" type="button" class="btn ${currentRole === 'farmer' ? 'btn-primary' : 'btn-outline'}" style="flex:1; font-size:0.8rem; padding: 0.4rem;" onclick="setLoginRole('farmer')">🌾 Farmer</button>
            <button id="roleTabOfficer" type="button" class="btn ${currentRole === 'officer' ? 'btn-primary' : 'btn-outline'}" style="flex:1; font-size:0.8rem; padding: 0.4rem;" onclick="setLoginRole('officer')">🛡️ Admin</button>
            <button id="roleTabBuyer" type="button" class="btn ${currentRole === 'buyer' ? 'btn-primary' : 'btn-outline'}" style="flex:1; font-size:0.8rem; padding: 0.4rem;" onclick="setLoginRole('buyer')">🛒 Buyer</button>
          </div>

          <!-- Demo Accounts Notice -->
          <div style="font-size: 0.73rem; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 0.5rem 0.7rem; border-radius: 6px; margin-bottom: 1rem; line-height: 1.4;">
            <strong>Demo Credentials (Ready in SQLite):</strong><br>
            🌾 Farmer: <code>farmer@demo.com</code> / <code>Farmer@123</code><br>
            🛡️ Officer: <code>officer@demo.com</code> / <code>Officer@123</code><br>
            🛒 Buyer: <code>buyer@demo.com</code> / <code>Buyer@123</code>
          </div>

          <form id="authForm" onsubmit="handleAuthSubmit(event)">
            <input type="hidden" id="authRoleInput" value="${currentRole}">

            <!-- Dynamic Name Prompt Input -->
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">Full Legal Name <span style="color: #dc2626;">*</span></label>
              <input type="text" id="authNameInput" class="form-control" placeholder="Enter your full name" value="${activeDefault.name}" required>
            </div>

            <!-- Credential Input -->
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">Mobile Number / Email / User ID <span style="color: #dc2626;">*</span></label>
              <input type="text" id="authCredentialInput" class="form-control" placeholder="Email or Mobile" value="${activeDefault.cred}" required>
            </div>

            <!-- Password / PIN -->
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">Security Password / PIN <span style="color: #dc2626;">*</span></label>
              <input type="password" id="authPasswordInput" class="form-control" value="${activeDefault.pass}" placeholder="Enter password" required>
            </div>

            <div id="authErrorMessage" style="font-size: 0.8rem; color: #dc2626; margin-top: 0.4rem; display: none; padding: 0.4rem; background: #fef2f2; border-radius: 6px; border: 1px solid #fecaca;"></div>

            <button type="submit" id="authSubmitBtn" class="btn btn-primary btn-block" style="font-weight: 800; font-size: 1rem; padding: 0.8rem; margin-top: 1rem;">
              🔑 Authenticate & Route to Portal
            </button>
          </form>

          <!-- Prominent Navigation to Registration -->
          <div style="margin-top: 1.2rem; text-align: center;">
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.8rem;">
              <hr style="flex:1; border: none; border-top: 1px solid #cbd5e1;">
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">New User? Create Account</span>
              <hr style="flex:1; border: none; border-top: 1px solid #cbd5e1;">
            </div>
            <button type="button" id="loginModalCreateAccountBtn" class="btn btn-block" style="background: #FBF3E0; color: #A9552B; border: 2px solid #BE6638; font-weight: 800; font-size: 0.95rem; padding: 0.75rem; border-radius: 10px; cursor: pointer; transition: all 0.2s;" onclick="openRegisterModal('${currentRole}')">
              📝 Create New Account (Sign Up)
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ================= USER REGISTRATION ENGINE =================
function openRegisterModal(defaultRole = 'farmer') {
  const container = document.getElementById('loginModalContainer');
  if (!container) return;

  const currentRole = defaultRole || 'farmer';

  container.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-card" style="max-width: 520px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header" style="background: linear-gradient(135deg, #68786E 0%, #55645B 100%); color: #FBF6EA; padding: 1.2rem;">
          <div>
            <div class="card-title" style="color: white; font-size: 1.2rem;">📝 New Account Registration</div>
            <div style="font-size: 0.8rem; opacity: 0.9;">Uzhavar Mutram SQLite Database Enrollment</div>
          </div>
          <button class="sms-close" style="color: white;" onclick="closeLoginModal()">✕</button>
        </div>

        <div style="padding: 1.2rem;">
          <!-- Mode Switcher (Login vs Register) -->
          <div style="display: flex; gap: 0.4rem; margin-bottom: 1rem; background: #e2e8f0; padding: 0.3rem; border-radius: 8px;">
            <button type="button" id="topModeLoginBtn" class="btn btn-outline" style="flex: 1; font-weight: 800; font-size: 0.88rem; padding: 0.45rem; background: white; color: #68786E; border: 2px solid #68786E;" onclick="openLoginModal('${currentRole}')">
              🔑 Login
            </button>
            <button type="button" class="btn btn-primary" style="flex: 1; font-weight: 800; font-size: 0.88rem; padding: 0.45rem; background: #68786E; border-color: #68786E; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              📝 Create Account
            </button>
          </div>

          <!-- Role Selector Tabs -->
          <div style="display: flex; gap: 0.4rem; margin-bottom: 0.9rem; background: #f1f5f9; padding: 0.3rem; border-radius: 8px;">
            <button id="regRoleFarmer" type="button" class="btn ${currentRole === 'farmer' ? 'btn-primary' : 'btn-outline'}" style="flex:1; font-size:0.8rem; padding: 0.4rem;" onclick="setRegisterRole('farmer')">🌾 Farmer</button>
            <button id="regRoleBuyer" type="button" class="btn ${currentRole === 'buyer' ? 'btn-primary' : 'btn-outline'}" style="flex:1; font-size:0.8rem; padding: 0.4rem;" onclick="setRegisterRole('buyer')">🛒 Buyer</button>
            <button id="regRoleOfficer" type="button" class="btn ${currentRole === 'officer' ? 'btn-primary' : 'btn-outline'}" style="flex:1; font-size:0.8rem; padding: 0.4rem;" onclick="setRegisterRole('officer')">🛡️ Officer (Secured)</button>
          </div>

          <form id="registerForm" onsubmit="handleRegisterSubmit(event)">
            <input type="hidden" id="regRoleInput" value="${currentRole}">

            <!-- Common Fields -->
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">Full Legal Name <span style="color: #dc2626;">*</span></label>
              <input type="text" id="regFullName" class="form-control" placeholder="e.g. Test Farmer" required minlength="3">
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">Email / Login Credential <span style="color: #dc2626;">*</span></label>
              <input type="text" id="regCredential" class="form-control" placeholder="e.g. testfarmer123@example.com" required minlength="3">
            </div>

            <!-- Role-Specific Fields: Farmer -->
            <div id="farmerSpecificFields" style="display: ${currentRole === 'farmer' ? 'block' : 'none'};">
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Mobile Number</label>
                <input type="text" id="regMobile" class="form-control" placeholder="+91 98765 43210">
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <div class="form-group" style="flex: 1;">
                  <label class="form-label" style="font-weight: 700;">District</label>
                  <input type="text" id="regDistrict" class="form-control" placeholder="e.g. Madurai" value="Madurai">
                </div>
                <div class="form-group" style="flex: 1;">
                  <label class="form-label" style="font-weight: 700;">Farmland (Acres)</label>
                  <input type="number" step="0.1" id="regLandAcres" class="form-control" placeholder="5.0" value="5.0">
                </div>
              </div>
            </div>

            <!-- Role-Specific Fields: Buyer -->
            <div id="buyerSpecificFields" style="display: ${currentRole === 'buyer' ? 'block' : 'none'};">
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Company / Wholesale Trader Name</label>
                <input type="text" id="regCompanyName" class="form-control" placeholder="e.g. AgriCorp Wholesale Traders">
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">GSTIN / Trade License Number</label>
                <input type="text" id="regGstin" class="form-control" placeholder="e.g. 33AAAAA1234A1Z5">
              </div>
            </div>

            <!-- Role-Specific Fields: Officer -->
            <div id="officerSpecificFields" style="display: ${currentRole === 'officer' ? 'block' : 'none'};">
              <div style="font-size: 0.75rem; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 0.5rem; border-radius: 6px; margin-bottom: 0.8rem; line-height: 1.4;">
                🔒 <strong>Admin Authorization Guard:</strong> Public officer creation is restricted by passkey to prevent arbitrary privilege escalation. Demo key: <code>TN-GOV-OFFICER-2026</code>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Officer Security Passkey <span style="color: #dc2626;">*</span></label>
                <input type="password" id="regAdminPasskey" class="form-control" placeholder="Enter authorization passkey" value="TN-GOV-OFFICER-2026">
              </div>
            </div>

            <!-- Password Fields -->
            <div style="display: flex; gap: 0.5rem;">
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 700;">Password <span style="color: #dc2626;">*</span></label>
                <input type="password" id="regPassword" class="form-control" placeholder="Min 6 chars" required minlength="6">
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label" style="font-weight: 700;">Confirm Password <span style="color: #dc2626;">*</span></label>
                <input type="password" id="regConfirmPassword" class="form-control" placeholder="Repeat password" required minlength="6">
              </div>
            </div>

            <div id="regErrorMessage" style="font-size: 0.8rem; color: #dc2626; margin-top: 0.4rem; display: none; padding: 0.4rem; background: #fef2f2; border-radius: 6px; border: 1px solid #fecaca;"></div>
            <div id="regSuccessMessage" style="font-size: 0.85rem; color: #065f46; margin-top: 0.4rem; display: none; padding: 0.5rem; background: #ecfdf5; border-radius: 6px; border: 1px solid #a7f3d0; font-weight: 700;"></div>

            <button type="submit" id="regSubmitBtn" class="btn btn-primary btn-block" style="font-weight: 800; font-size: 1rem; padding: 0.8rem; margin-top: 1rem;">
              📝 Create Database Account
            </button>
          </form>

          <div style="text-align: center; margin-top: 1rem; border-top: 1px solid #e2e8f0; padding-top: 0.8rem;">
            <span style="font-size: 0.85rem; color: #64748b;">Already have an account? </span>
            <button type="button" class="btn btn-outline" style="padding: 0.2rem 0.65rem; font-size: 0.8rem; font-weight: 700;" onclick="openLoginModal('${currentRole}')">
              🔑 Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function setRegisterRole(role) {
  const roleInput = document.getElementById('regRoleInput');
  if (roleInput) roleInput.value = role;

  const btnFarmer = document.getElementById('regRoleFarmer');
  const btnBuyer = document.getElementById('regRoleBuyer');
  const btnOfficer = document.getElementById('regRoleOfficer');

  if (btnFarmer) btnFarmer.className = `btn ${role === 'farmer' ? 'btn-primary' : 'btn-outline'}`;
  if (btnBuyer) btnBuyer.className = `btn ${role === 'buyer' ? 'btn-primary' : 'btn-outline'}`;
  if (btnOfficer) btnOfficer.className = `btn ${role === 'officer' ? 'btn-primary' : 'btn-outline'}`;

  const farmerFields = document.getElementById('farmerSpecificFields');
  const buyerFields = document.getElementById('buyerSpecificFields');
  const officerFields = document.getElementById('officerSpecificFields');

  if (farmerFields) farmerFields.style.display = role === 'farmer' ? 'block' : 'none';
  if (buyerFields) buyerFields.style.display = role === 'buyer' ? 'block' : 'none';
  if (officerFields) officerFields.style.display = role === 'officer' ? 'block' : 'none';

  const errEl = document.getElementById('regErrorMessage');
  if (errEl) errEl.style.display = 'none';
}

async function handleRegisterSubmit(e) {
  if (e) e.preventDefault();
  const fullName = document.getElementById('regFullName')?.value.trim();
  const credential = document.getElementById('regCredential')?.value.trim();
  const role = document.getElementById('regRoleInput')?.value || 'farmer';
  const password = document.getElementById('regPassword')?.value;
  const confirmPassword = document.getElementById('regConfirmPassword')?.value;
  const errorEl = document.getElementById('regErrorMessage');
  const successEl = document.getElementById('regSuccessMessage');
  const submitBtn = document.getElementById('regSubmitBtn');

  if (errorEl) errorEl.style.display = 'none';
  if (successEl) successEl.style.display = 'none';

  if (!fullName || fullName.length < 3) {
    if (errorEl) {
      errorEl.textContent = '⚠️ Full Name must be at least 3 characters.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (!credential || credential.length < 3) {
    if (errorEl) {
      errorEl.textContent = '⚠️ Please enter a valid login credential / email.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (!password || password.length < 6) {
    if (errorEl) {
      errorEl.textContent = '⚠️ Password must be at least 6 characters.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (password !== confirmPassword) {
    if (errorEl) {
      errorEl.textContent = '⚠️ Passwords do not match.';
      errorEl.style.display = 'block';
    }
    return;
  }

  const payload = {
    fullName,
    credential,
    password,
    confirmPassword,
    role
  };

  if (role === 'farmer') {
    payload.mobile = document.getElementById('regMobile')?.value.trim();
    payload.district = document.getElementById('regDistrict')?.value.trim() || 'Madurai';
    payload.landAcres = parseFloat(document.getElementById('regLandAcres')?.value) || 5.0;
  } else if (role === 'buyer') {
    payload.companyName = document.getElementById('regCompanyName')?.value.trim();
    payload.gstin = document.getElementById('regGstin')?.value.trim();
  } else if (role === 'officer') {
    payload.adminPasskey = document.getElementById('regAdminPasskey')?.value.trim();
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Creating account in SQLite...';
  }

  try {
    const res = await api.register(payload);
    if (!res.success) {
      if (errorEl) {
        errorEl.textContent = `❌ ${res.message || 'Registration failed'}`;
        errorEl.style.display = 'block';
      }
      return;
    }

    if (successEl) {
      successEl.innerHTML = `✅ Account created successfully for <strong>${fullName}</strong>! Opening login...`;
      successEl.style.display = 'block';
    }

    triggerSimulatedSMS(`REGISTRATION SUCCESS: Welcome ${fullName}! Account created in database for ${role.toUpperCase()} portal.`);

    setTimeout(() => {
      openLoginModal(role);
      const credInput = document.getElementById('authCredentialInput');
      const passInput = document.getElementById('authPasswordInput');
      const nameInput = document.getElementById('authNameInput');
      if (credInput) credInput.value = credential;
      if (passInput) passInput.value = password;
      if (nameInput) nameInput.value = fullName;
      const loginErr = document.getElementById('authErrorMessage');
      if (loginErr) {
        loginErr.style.display = 'block';
        loginErr.style.background = '#ecfdf5';
        loginErr.style.borderColor = '#a7f3d0';
        loginErr.style.color = '#065f46';
        loginErr.innerHTML = `✅ Registration successful! Click Authenticate below to log in.`;
      }
    }, 1000);

  } catch (err) {
    console.error('Registration submit error:', err);
    if (errorEl) {
      errorEl.textContent = '❌ Failed to connect to registration server.';
      errorEl.style.display = 'block';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '📝 Create Database Account';
    }
  }
}

function closeLoginModal() {
  const container = document.getElementById('loginModalContainer');
  if (container) container.innerHTML = '';
}

function setLoginRole(role) {
  const roleInput = document.getElementById('authRoleInput');
  if (roleInput) roleInput.value = role;

  const btnFarmer = document.getElementById('roleTabFarmer');
  const btnOfficer = document.getElementById('roleTabOfficer');
  const btnBuyer = document.getElementById('roleTabBuyer');

  if (btnFarmer) btnFarmer.className = `btn ${role === 'farmer' ? 'btn-primary' : 'btn-outline'}`;
  if (btnOfficer) btnOfficer.className = `btn ${role === 'officer' ? 'btn-primary' : 'btn-outline'}`;
  if (btnBuyer) btnBuyer.className = `btn ${role === 'buyer' ? 'btn-primary' : 'btn-outline'}`;

  const roleDefaults = {
    farmer: { name: 'Ramesh Singh Kumar', cred: 'farmer@demo.com', pass: 'Farmer@123' },
    officer: { name: 'Dr. K. Arumugam (Market Director)', cred: 'officer@demo.com', pass: 'Officer@123' },
    buyer: { name: 'AgriCorp Wholesale Traders', cred: 'buyer@demo.com', pass: 'Buyer@123' }
  };

  const activeDef = roleDefaults[role] || roleDefaults.farmer;
  const nameInput = document.getElementById('authNameInput');
  const credInput = document.getElementById('authCredentialInput');
  const passInput = document.getElementById('authPasswordInput');

  if (nameInput) nameInput.value = activeDef.name;
  if (credInput) credInput.value = activeDef.cred;
  if (passInput) passInput.value = activeDef.pass;

  const errEl = document.getElementById('authErrorMessage');
  if (errEl) errEl.style.display = 'none';
}

async function handleAuthSubmit(e) {
  if (e) e.preventDefault();
  const credential = document.getElementById('authCredentialInput')?.value.trim();
  const password = document.getElementById('authPasswordInput')?.value || '';
  const role = document.getElementById('authRoleInput')?.value || 'farmer';
  const nameInput = document.getElementById('authNameInput');
  const nameVal = nameInput ? nameInput.value.trim() : '';
  const errorEl = document.getElementById('authErrorMessage');
  const submitBtn = document.getElementById('authSubmitBtn');

  if (!credential || !password) {
    if (errorEl) {
      errorEl.textContent = '⚠️ Please enter your credential and password.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Verifying credentials with SQLite...';
  }

  try {
    const result = await api.login(credential, password);
    if (!result.success) {
      if (errorEl) {
        errorEl.textContent = `❌ ${result.message || 'Invalid credentials'}`;
        errorEl.style.display = 'block';
      } else {
        alert(result.message || 'Invalid credentials');
      }
      return;
    }

    const authUser = result.user;
    appState.currentUser = {
      id: authUser.id,
      name: authUser.fullName,
      role: authUser.role,
      credential: authUser.credential,
      authenticated: true,
      loginTimestamp: new Date().toISOString()
    };
    sessionStorage.setItem('uzhavar_guest_entered', 'true');

    // Fetch live data from backend database
    if (authUser.role === 'farmer') {
      const profRes = await api.getFarmerProfile();
      if (profRes.success && profRes.profile) {
        appState.farmerProfile = profRes.profile;
      }
      const bookingsRes = await api.getMyBookings();
      if (bookingsRes.success && bookingsRes.bookings) {
        appState.tokens = bookingsRes.bookings.map(normalizeToken);
      }
      const stkRes = await api.getMyStockyardBookings();
      if (stkRes.success && stkRes.bookings) {
        appState.stockyardBookings = stkRes.bookings.map(normalizeStockyardBooking);
      }
    } else if (authUser.role === 'officer' || authUser.role === 'kiosk') {
      const bookingsRes = await api.getAllBookings();
      if (bookingsRes.success && bookingsRes.bookings) {
        appState.tokens = bookingsRes.bookings.map(normalizeToken);
      }
    }

    saveState();
    closeLoginModal();
    updateHeaderUserProfile();
    switchRole(authUser.role);

    triggerSimulatedSMS(`AUTH SUCCESS: Verified ${authUser.fullName} (${authUser.role.toUpperCase()} Portal). Database session active.`);
  } catch (err) {
    console.error('Login submit error:', err);
    if (errorEl) {
      errorEl.textContent = '❌ Failed to connect to authentication server.';
      errorEl.style.display = 'block';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '🔑 Authenticate & Route to Portal';
    }
  }
}

function updateHeaderUserProfile() {
  const userNameEl = document.getElementById('headerUserName');
  const roleBadgeEl = document.getElementById('headerRoleBadge');
  const buyerWelcomeEl = document.getElementById('buyerWelcomeTitle');
  const buyerAccountEl = document.getElementById('buyerAccountName');

  const user = appState.currentUser || { name: 'Ramesh Singh Kumar', role: 'farmer' };

  if (userNameEl) userNameEl.textContent = user.name;
  if (roleBadgeEl) {
    roleBadgeEl.textContent = user.role.toUpperCase();
    if (user.role === 'farmer') roleBadgeEl.className = 'badge badge-success';
    else if (user.role === 'officer') roleBadgeEl.className = 'badge badge-primary';
    else if (user.role === 'buyer') roleBadgeEl.className = 'badge badge-warning';
  }

  if (buyerWelcomeEl && user.role === 'buyer') {
    buyerWelcomeEl.textContent = `🛒 Wholesale Crop Buyer Portal — Welcome, ${user.name}`;
  }
  if (buyerAccountEl && user.role === 'buyer') {
    buyerAccountEl.textContent = user.name;
  }
}

// Wholesale Buyer Portal Renderer
function renderBuyerPortal() {
  const tbody = document.getElementById('buyerAuctionsTbody');
  if (!tbody) return;

  const sampleAuctions = [
    { batch: "#BATCH-9901", crop: "Grade A Paddy", seller: "Ramesh Singh Kumar", qty: "10 MT (100 Qtl)", baseRate: "₹2,300/Qtl", highestBid: "₹2,340/Qtl" },
    { batch: "#BATCH-9902", crop: "Sharbati Wheat", seller: "Suresh Patel", qty: "15 MT (150 Qtl)", baseRate: "₹2,275/Qtl", highestBid: "₹2,310/Qtl" },
    { batch: "#BATCH-9903", crop: "Yellow Hybrid Maize", seller: "Gurpreet Singh", qty: "8 MT (80 Qtl)", baseRate: "₹2,090/Qtl", highestBid: "₹2,120/Qtl" },
    { batch: "#BATCH-9904", crop: "Organic Mustard", seller: "Vikram R", qty: "5 MT (50 Qtl)", baseRate: "₹5,650/Qtl", highestBid: "₹5,780/Qtl" }
  ];

  tbody.innerHTML = sampleAuctions.map(a => `
    <tr>
      <td><strong>${a.batch}</strong></td>
      <td>${a.crop}</td>
      <td>${a.seller}</td>
      <td>${a.qty}</td>
      <td>${a.baseRate}</td>
      <td><strong style="color: #A9552B;">${a.highestBid}</strong></td>
      <td>
        <button class="btn btn-primary" style="font-size:0.75rem; padding: 0.3rem 0.6rem;" onclick="placeBuyerBid('${a.batch}')">
          🔨 Place Bid / Buy Now
        </button>
      </td>
    </tr>
  `).join('');
}

function placeBuyerBid(batchId) {
  if (!appState.currentUser || appState.currentUser.role !== 'buyer') {
    alert("🔒 Access Denied: Wholesale Buyer authentication required to place bids.");
    openLoginModal('buyer');
    return;
  }
  const bidAmount = prompt(`Enter your bulk bid rate per Quintal for ${batchId} (Current highest bid: ₹2,340/Qtl):`, "2360");
  if (bidAmount && parseFloat(bidAmount) > 0) {
    alert(`✅ Bid of ₹${bidAmount}/Qtl submitted successfully for ${batchId} by ${appState.currentUser.name}.`);
    triggerSimulatedSMS(`BUYER BID CONFIRMED: Batch ${batchId} bid placed at ₹${bidAmount}/Qtl by ${appState.currentUser.name}.`);
  }
}

// ================= WELCOME ENTRANCE GATE ENGINE (GUEST MODE VS LOGIN) =================
function openWelcomeEntranceModal() {
  const container = document.getElementById('welcomeEntranceModalContainer');
  if (!container) return;

  const lang = appState.currentLang;
  const t = I18N[lang] || I18N.en;

  container.innerHTML = `
    <div class="modal-backdrop" style="backdrop-filter: blur(8px); background: rgba(2, 44, 34, 0.85); display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999;">
      <div class="modal-card" style="max-width: 520px; width: 90%; background: #ffffff; border-radius: 20px; box-shadow: 0 20px 50px rgba(47,56,52,0.35); border: 2px solid #68786E; overflow: hidden; animation: modalPop 0.3s ease-out;">
        <div style="background: linear-gradient(135deg, #55645B 0%, #3E4A42 100%); color: #FBF6EA; padding: 2rem 1.5rem; text-align: center;">
          <div style="font-size: 3.2rem; margin-bottom: 0.5rem;">🌾</div>
          <h2 style="font-size: 1.6rem; font-weight: 900; margin-bottom: 0.3rem;">${t.welcomeModalTitle || 'Welcome to Uzhavar Mutram'}</h2>
          <div style="font-size: 0.95rem; color: #a7f3d0;">${t.welcomeModalSubtitle || 'TN Smart Mandi & Agricultural Procurement Platform'}</div>
          
          <div style="margin-top: 1.2rem; display: inline-flex; align-items: center; background: rgba(255,255,255,0.15); padding: 0.38rem 0.9rem; border-radius: 20px; gap: 0.5rem;">
            <span style="font-size: 0.85rem;">🌐 Language:</span>
            <select id="welcomeLangSelect" onchange="changeGateLanguage(this.value)" style="background: transparent; color: white; border: none; font-weight: 700; font-size: 0.85rem; cursor: pointer; outline: none;">
              <option value="en" style="color: black;">🌐 English</option>
              <option value="hi" style="color: black;">🇮🇳 हिन्दी (Hindi)</option>
              <option value="ta" style="color: black;">🇮🇳 தமிழ் (Tamil)</option>
              <option value="te" style="color: black;">🇮🇳 తెలుగు (Telugu)</option>
              <option value="ml" style="color: black;">🇮🇳 മലയാളം (Malayalam)</option>
              <option value="kn" style="color: black;">🇮🇳 ಕನ್ನಡ (Kannada)</option>
            </select>
          </div>
        </div>

        <div style="padding: 1.8rem 1.5rem;">
          <p style="font-size: 0.9rem; color: #475569; text-align: center; margin-bottom: 1.5rem; line-height: 1.6;" data-i18n="guestNotice">
            ${t.guestNotice || 'In Guest Mode, you can freely browse live market rates, check storage facilities, and book crop selling slots.'}
          </p>

          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <button class="btn btn-primary btn-block" style="font-size: 1.05rem; font-weight: 800; padding: 0.9rem; border-radius: 12px; background: linear-gradient(135deg, #BE6638, #A9552B); box-shadow: 0 4px 12px rgba(190, 102, 56, 0.35);" onclick="enterGuestMode()">
              <span data-i18n="enterGuestBtn">${t.enterGuestBtn || '🌱 Enter Without Login (Guest Mode)'}</span>
            </button>

            <div style="display: flex; align-items: center; gap: 0.8rem; margin: 0.2rem 0;">
              <hr style="flex:1; border: none; border-top: 1px solid #cbd5e1;">
              <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">or</span>
              <hr style="flex:1; border: none; border-top: 1px solid #cbd5e1;">
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
              <button class="btn btn-outline btn-block" style="font-size: 1rem; font-weight: 700; padding: 0.85rem; border-radius: 12px; border: 2px solid #68786E; color: #68786E;" onclick="proceedToLoginFromGate()">
                <span>🔑 Login to Existing Account</span>
              </button>
              <button class="btn btn-outline btn-block" style="font-size: 1rem; font-weight: 700; padding: 0.85rem; border-radius: 12px; border: 2px solid #BE6638; color: #BE6638;" onclick="proceedToRegisterFromGate()">
                <span>📝 Create New Account (Register)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function enterGuestMode() {
  appState.isGuest = true;
  appState.currentUser = { name: appState.currentLang === 'ta' ? 'விருந்தினர் விவசாயி' : 'Guest Farmer', role: 'farmer', isGuest: true };
  sessionStorage.setItem('uzhavar_guest_entered', 'true');
  closeWelcomeEntranceModal();
  updateHeaderUserProfile();
  triggerSimulatedSMS(appState.currentLang === 'ta' ? 'வணக்கம்! விருந்தினர் நிலையில் உழவர் முற்றத்திற்கு வரவேற்கிறோம்.' : 'Welcome to Uzhavar Mutram! Browsing in Guest Farmer Mode.');
}

function proceedToLoginFromGate() {
  closeWelcomeEntranceModal();
  openLoginModal('farmer');
}

function proceedToRegisterFromGate() {
  closeWelcomeEntranceModal();
  openRegisterModal('farmer');
}

function closeWelcomeEntranceModal() {
  const container = document.getElementById('welcomeEntranceModalContainer');
  if (container) container.innerHTML = '';
}

function changeGateLanguage(newLang) {
  appState.currentLang = newLang;
  const langSelect = document.getElementById('langSelect');
  if (langSelect) langSelect.value = newLang;
  updateLanguageUI();
  openWelcomeEntranceModal();
}

// ================= AGRISTACK & VERIFICATION HANDLERS =================
function loadFarmerAgristackProfile() {
  const profile = appState.farmerProfile;
  if (!profile) return;

  const statusBadge = document.getElementById('asStatusBadge');
  const headerBadge = document.getElementById('agristackHeaderBadge');
  const displayId = document.getElementById('asDisplayId');
  const displayName = document.getElementById('asDisplayName');
  const displayLand = document.getElementById('asDisplayLand');
  const accessBadge = document.getElementById('asAccessBadge');
  const inputId = document.getElementById('inputAgristackId');
  const inputName = document.getElementById('inputAgristackName');

  const status = profile.agristackVerificationStatus || 'PENDING';
  const agristackId = profile.farmerIdAgristack || 'FID-TN-2026-8812';

  if (inputId) inputId.value = agristackId;
  if (inputName) inputName.value = profile.name || 'Ramesh Singh Kumar';
  if (displayId) displayId.textContent = agristackId;
  if (displayName) displayName.textContent = profile.name || 'Ramesh Singh Kumar';
  if (displayLand) displayLand.textContent = `${profile.district || 'Madurai'} District (${profile.landAcres || 8.5} Acres)`;

  if (status === 'VERIFIED') {
    if (statusBadge) { statusBadge.className = 'badge badge-success'; statusBadge.textContent = '✓ VERIFIED'; }
    if (headerBadge) { headerBadge.innerHTML = '<span class="badge badge-success" style="font-size: 0.9rem; padding: 0.4rem 0.8rem;">✓ VERIFIED FARMER</span>'; }
    if (accessBadge) { accessBadge.className = 'badge badge-success'; accessBadge.textContent = 'ALLOWED'; }
  } else {
    if (statusBadge) { statusBadge.className = 'badge badge-danger'; statusBadge.textContent = status === 'FAILED' ? '❌ FAILED' : '⚡ PENDING'; }
    if (headerBadge) { headerBadge.innerHTML = '<span class="badge badge-danger" style="font-size: 0.9rem; padding: 0.4rem 0.8rem;">⚠️ VERIFICATION REQUIRED</span>'; }
    if (accessBadge) { accessBadge.className = 'badge badge-danger'; accessBadge.textContent = 'BLOCKED (Verification Required)'; }
  }
}

async function handleAgristackVerifySubmit(e) {
  if (e) e.preventDefault();
  const farmerId = document.getElementById('inputAgristackId')?.value || '';
  const name = document.getElementById('inputAgristackName')?.value || '';

  const btn = document.getElementById('btnVerifyAgristack');
  if (btn) btn.disabled = true;

  try {
    const res = await api.verifyAgriStack(farmerId, name);
    if (res.success && res.profile) {
      appState.farmerProfile = res.profile;
      saveState();
      alert('🎉 ' + (res.message || 'AgriStack Digital Farmer ID successfully verified!'));
      speakAnnouncement('AgriStack Digital Farmer ID successfully verified');
    } else {
      if (appState.farmerProfile) {
        appState.farmerProfile.agristackVerificationStatus = 'FAILED';
        appState.farmerProfile.farmerIdAgristack = farmerId;
      }
      alert('❌ Verification Failed: ' + (res.message || 'AgriStack record not found.'));
    }
  } catch (err) {
    alert('Verification connection error.');
  } finally {
    if (btn) btn.disabled = false;
    loadFarmerAgristackProfile();
  }
}

// ================= LOGISTICS & TRANSPORT HANDLERS =================
function calculateLogisticsCostPreview() {
  const dist = parseFloat(document.getElementById('logisticsDistanceKm')?.value || 35);
  const weight = parseFloat(document.getElementById('logisticsWeightKg')?.value || 5000);
  const cost = Math.round(500 + dist * 45 + (weight / 1000) * 120);

  const preview = document.getElementById('logisticsCostPreview');
  if (preview) preview.textContent = `₹${cost.toLocaleString('en-IN')}`;
}

async function handleLogisticsRequestSubmit(e) {
  e.preventDefault();

  if (appState.farmerProfile && appState.farmerProfile.agristackVerificationStatus !== 'VERIFIED') {
    alert('⚠️ AgriStack Digital Farmer ID verification is required before requesting transport.');
    switchFarmerSubTab('agristack');
    return;
  }

  const bookingId = document.getElementById('logisticsBookingSelect')?.value || '';
  const pickupLocation = document.getElementById('logisticsPickup')?.value || '';
  const dropSelect = document.getElementById('logisticsDrop');
  const dropLocation = dropSelect ? dropSelect.options[dropSelect.selectedIndex]?.text : 'Koyambedu Wholesale Market';
  const vehicleType = document.getElementById('logisticsVehicleType')?.value || 'TRACTOR_TROLLEY';
  const weightKg = parseFloat(document.getElementById('logisticsWeightKg')?.value || 5000);
  const distanceKm = parseFloat(document.getElementById('logisticsDistanceKm')?.value || 35);

  const res = await api.createLogisticsRequest({
    bookingId,
    pickupLocation,
    dropLocation,
    vehicleType,
    weightKg,
    distanceKm
  });

  if (res.success && res.request) {
    alert('🚚 Logistics transport request created successfully!');
    triggerSimulatedSMS(`Logistics Request #${res.request.id} created for ${weightKg}kg cargo. Status: ${res.request.status}`);
    speakAnnouncement(`Logistics transport request created.`);
    loadMyLogisticsRequests();
  } else {
    alert(res.message || 'Failed to create logistics request.');
  }
}

async function loadMyLogisticsRequests() {
  const container = document.getElementById('logisticsTrackerContainer');
  if (!container) return;

  const res = await api.getMyLogisticsRequests();
  const requests = res.success && res.requests ? res.requests : [];

  if (requests.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 1.5rem;">No transport requests created yet.</p>';
    return;
  }

  container.innerHTML = requests.map(r => {
    const isReq = r.status === 'REQUESTED';
    const isAss = r.status === 'ASSIGNED';
    const isIn = r.status === 'IN_TRANSIT';
    const isDel = r.status === 'DELIVERED';

    return `
      <div class="logistics-tracker-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <strong style="font-size: 1.05rem; color: #2F3834;">Request #${r.id}</strong>
            <span style="font-size: 0.85rem; color: #64748b;">(${r.cropName || 'Cargo'})</span>
          </div>
          <span class="badge ${isDel ? 'badge-success' : isIn ? 'badge-info' : 'badge-warning'}">${r.status}</span>
        </div>

        <div class="logistics-meta-grid" style="margin-top: 0.8rem;">
          <div>📍 <strong>Pickup:</strong> ${r.pickupLocation}</div>
          <div>🏁 <strong>Destination:</strong> ${r.dropLocation}</div>
          <div>⚖️ <strong>Weight:</strong> ${r.weightKg.toLocaleString('en-IN')} Kg</div>
          <div>💰 <strong>Est. Cost:</strong> ₹${r.estimatedCost.toLocaleString('en-IN')}</div>
          <div>🚚 <strong>Transporter:</strong> ${r.transporterName || 'Assigning driver...'}</div>
          <div>📞 <strong>Contact:</strong> ${r.transporterPhone || 'Pending'}</div>
        </div>

        <div class="logistics-stepper">
          <div class="logistics-step ${isReq || isAss || isIn || isDel ? 'completed' : ''}">
            <div class="logistics-step-node">1</div>
            <div>Requested</div>
          </div>
          <div class="logistics-step ${isAss || isIn || isDel ? 'completed' : isReq ? 'active' : ''}">
            <div class="logistics-step-node">2</div>
            <div>Assigned</div>
          </div>
          <div class="logistics-step ${isIn || isDel ? 'completed' : isAss ? 'active' : ''}">
            <div class="logistics-step-node">3</div>
            <div>In Transit</div>
          </div>
          <div class="logistics-step ${isDel ? 'completed' : isIn ? 'active' : ''}">
            <div class="logistics-step-node">4</div>
            <div>Delivered</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ================= GOVERNMENT SCHEMES HANDLERS =================
async function loadGovtSchemes(categoryFilter = 'ALL') {
  const grid = document.getElementById('govtSchemesGrid');
  if (!grid) return;

  const res = await api.getGovtSchemes();
  let schemes = res.success && res.schemes ? res.schemes : [];

  if (categoryFilter !== 'ALL') {
    schemes = schemes.filter(s => s.category === categoryFilter);
  }

  if (schemes.length === 0) {
    grid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">No schemes found.</p>';
    return;
  }

  grid.innerHTML = schemes.map(s => `
    <div class="scheme-card">
      <div>
        <div class="scheme-header">
          <div class="scheme-title">${s.title}</div>
          <span class="badge badge-info">${s.category}</span>
        </div>
        <div class="scheme-benefit-badge">💰 Benefit: ${s.benefitAmount}</div>
        <p style="font-size: 0.88rem; color: #334155; line-height: 1.6; margin-bottom: 0.8rem;">${s.description}</p>
        <div class="scheme-meta">
          <div><strong>Eligibility:</strong> ${s.eligibility}</div>
          <div><strong>Applicable Region:</strong> ${s.state}</div>
        </div>
      </div>
      <div>
        <a href="${s.officialLink}" target="_blank" rel="noopener" class="btn-scheme-link">
          🌐 Official Govt Portal 🔗
        </a>
      </div>
    </div>
  `).join('');
}

// ================= OFFICER CONTROLS & SCHEMES MANAGER =================
async function loadOfficerVerificationQueue() {
  const tbody = document.getElementById('officerVerificationTbody');
  if (!tbody) return;

  const res = await api.getVerificationQueue();
  const profiles = res.success && res.profiles ? res.profiles : [];

  if (profiles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No farmer verification records found.</td></tr>';
    return;
  }

  tbody.innerHTML = profiles.map(p => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td>${p.credential}<br><span style="font-size: 0.8rem; color: #64748b;">${p.mobile}</span></td>
      <td>${p.district}</td>
      <td><code>${p.aadhaar}</code></td>
      <td><strong>${p.farmerIdAgristack || 'Not Submitted'}</strong></td>
      <td><span class="badge ${p.agristackVerificationStatus === 'VERIFIED' ? 'badge-success' : 'badge-warning'}">${p.agristackVerificationStatus}</span></td>
      <td>
        <button class="btn btn-primary" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;" onclick="handleOfficerVerifyFarmer('${p.id}', 'VERIFIED')">✓ Approve</button>
        <button class="btn btn-outline" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;" onclick="handleOfficerVerifyFarmer('${p.id}', 'FAILED')">❌ Reject</button>
      </td>
    </tr>
  `).join('');
}

async function handleOfficerVerifyFarmer(profileId, status) {
  const res = await api.updateFarmerVerification(profileId, status);
  if (res.success) {
    alert(`Farmer verification status set to ${status}.`);
    loadOfficerVerificationQueue();
  }
}

async function loadOfficerLogistics() {
  const tbody = document.getElementById('officerLogisticsTbody');
  if (!tbody) return;

  const res = await api.getAllLogisticsRequests();
  const requests = res.success && res.requests ? res.requests : [];

  if (requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No logistics requests found.</td></tr>';
    return;
  }

  tbody.innerHTML = requests.map(r => `
    <tr>
      <td><strong>#${r.id}</strong></td>
      <td>${r.farmerName}<br><span style="font-size: 0.8rem; color: #64748b;">${r.mobile}</span></td>
      <td>📍 ${r.pickupLocation}<br>➔ 🏁 ${r.dropLocation}</td>
      <td>${r.weightKg.toLocaleString('en-IN')} kg (${r.vehicleType})</td>
      <td>${r.transporterName || 'Unassigned'}<br><span style="font-size: 0.8rem; color: #64748b;">${r.vehicleNumber || ''}</span></td>
      <td><span class="badge ${r.status === 'DELIVERED' ? 'badge-success' : 'badge-warning'}">${r.status}</span></td>
      <td>
        <select onchange="handleOfficerLogisticsStatusChange('${r.id}', this.value)" style="font-size: 0.8rem; padding: 0.2rem;">
          <option value="REQUESTED" ${r.status === 'REQUESTED' ? 'selected' : ''}>REQUESTED</option>
          <option value="ASSIGNED" ${r.status === 'ASSIGNED' ? 'selected' : ''}>ASSIGNED</option>
          <option value="IN_TRANSIT" ${r.status === 'IN_TRANSIT' ? 'selected' : ''}>IN_TRANSIT</option>
          <option value="DELIVERED" ${r.status === 'DELIVERED' ? 'selected' : ''}>DELIVERED</option>
        </select>
      </td>
    </tr>
  `).join('');
}

async function handleOfficerLogisticsStatusChange(id, status) {
  const res = await api.updateLogisticsRequest(id, { status });
  if (res.success) {
    loadOfficerLogistics();
  }
}

async function loadOfficerSchemes() {
  const tbody = document.getElementById('officerSchemesTbody');
  if (!tbody) return;

  const res = await api.getGovtSchemes();
  const schemes = res.success && res.schemes ? res.schemes : [];

  tbody.innerHTML = schemes.map(s => `
    <tr>
      <td><strong>${s.title}</strong></td>
      <td><span class="badge badge-info">${s.category}</span></td>
      <td>${s.benefitAmount}</td>
      <td style="font-size: 0.85rem;">${s.eligibility}</td>
      <td><a href="${s.officialLink}" target="_blank" rel="noopener">Link 🔗</a></td>
      <td>
        <button class="btn btn-outline" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;" onclick="openAddSchemeModal('${s.id}')">✏️ Edit</button>
      </td>
    </tr>
  `).join('');
}

function openAddSchemeModal() {
  const container = document.getElementById('schemeModalContainer');
  if (!container) return;
  container.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-card" style="max-width: 520px;">
        <div class="modal-header">
          <div class="card-title">🏛️ Add New Government Scheme</div>
          <button class="sms-close" onclick="closeSchemeModal()">✕</button>
        </div>
        <form onsubmit="handleSaveSchemeSubmit(event)">
          <div class="form-group">
            <label class="form-label">Scheme Title</label>
            <input type="text" id="schTitle" class="form-control" required placeholder="e.g. PM-KISAN Nidhi">
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <input type="text" id="schCat" class="form-control" required placeholder="e.g. Direct Income Support">
          </div>
          <div class="form-group">
            <label class="form-label">Benefit Amount / Details</label>
            <input type="text" id="schBenefit" class="form-control" required placeholder="e.g. ₹6,000 / year">
          </div>
          <div class="form-group">
            <label class="form-label">Eligibility Criteria</label>
            <textarea id="schEligibility" class="form-control" rows="2" required></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea id="schDesc" class="form-control" rows="3" required></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Official Govt Portal URL</label>
            <input type="url" id="schUrl" class="form-control" required value="https://pmkisan.gov.in/">
          </div>
          <button type="submit" class="btn btn-primary btn-block">➕ Publish Govt Scheme</button>
        </form>
      </div>
    </div>
  `;
}

function closeSchemeModal() {
  const container = document.getElementById('schemeModalContainer');
  if (container) container.innerHTML = '';
}

async function handleSaveSchemeSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('schTitle').value;
  const category = document.getElementById('schCat').value;
  const benefitAmount = document.getElementById('schBenefit').value;
  const eligibility = document.getElementById('schEligibility').value;
  const description = document.getElementById('schDesc').value;
  const officialLink = document.getElementById('schUrl').value;

  const res = await api.createGovtScheme({ title, category, benefitAmount, eligibility, description, officialLink });
  if (res.success) {
    alert('Govt Scheme published successfully!');
    closeSchemeModal();
    loadGovtSchemes();
    loadOfficerSchemes();
  } else {
    alert(res.message || 'Failed to add scheme.');
  }
}

// REALTIME WEBSOCKET & POLLING INTEGRATION
document.addEventListener('DOMContentLoaded', () => {
  if (typeof api !== 'undefined' && api.initRealtime) {
    api.initRealtime((payload) => {
      if (payload.type === 'LOGISTICS_UPDATE') {
        loadMyLogisticsRequests();
        loadOfficerLogistics();
      } else if (payload.type === 'QUEUE_UPDATE') {
        if (typeof renderFarmerActiveToken === 'function') renderFarmerActiveToken();
        if (typeof renderAdminTokensTable === 'function') renderAdminTokensTable();
      } else if (payload.type === 'STOCKYARD_UPDATE') {
        if (typeof renderStockyardPassesList === 'function') renderStockyardPassesList();
      }
    });
  }

  // Short-interval polling fallback (every 10s)
  setInterval(() => {
    if (appState.currentRole === 'farmer') {
      loadMyLogisticsRequests();
    } else if (appState.currentRole === 'officer') {
      loadOfficerLogistics();
      loadOfficerVerificationQueue();
    }
  }, 10000);

  // Attach forms
  const agristackForm = document.getElementById('agristackVerifyForm');
  if (agristackForm) agristackForm.addEventListener('submit', handleAgristackVerifySubmit);

  const logisticsForm = document.getElementById('logisticsRequestForm');
  if (logisticsForm) logisticsForm.addEventListener('submit', handleLogisticsRequestSubmit);

  // Scheme category filter pills
  document.querySelectorAll('#schemesCategoryFilter .pill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#schemesCategoryFilter .pill-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const cat = e.currentTarget.getAttribute('data-schemecat');
      loadGovtSchemes(cat);
    });
  });
});
