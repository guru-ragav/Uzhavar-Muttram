// Uzhavar Mutram API Client - Unified Backend Interface
const api = {
  getToken() {
    return sessionStorage.getItem('uzhavar_token');
  },

  setToken(token) {
    if (token) {
      sessionStorage.setItem('uzhavar_token', token);
    } else {
      sessionStorage.removeItem('uzhavar_token');
    }
  },

  clearToken() {
    sessionStorage.removeItem('uzhavar_token');
  },

  getHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json'
    };
    const token = this.getToken();
    if (includeAuth && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  async health() {
    try {
      const res = await fetch('/api/health');
      return await res.json();
    } catch (err) {
      return { success: false, database: 'disconnected', error: err.message };
    }
  },

  async login(credential, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, password })
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        this.setToken(data.token);
      }
      return data;
    } catch (err) {
      return { success: false, message: 'Network or server connection failed.' };
    }
  },

  async register(registrationData) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData)
      });
      const data = await res.json();
      return {
        status: res.status,
        ...data
      };
    } catch (err) {
      return { success: false, message: 'Network or server connection failed.' };
    }
  },

  async getMe() {
    const token = this.getToken();
    if (!token) return { success: false, message: 'No token' };
    try {
      const res = await fetch('/api/auth/me', {
        headers: this.getHeaders(true)
      });
      if (!res.ok) {
        this.clearToken();
        return { success: false, message: 'Invalid session' };
      }
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async getFarmerProfile() {
    try {
      const res = await fetch('/api/farmer/profile', {
        headers: this.getHeaders(true)
      });
      if (!res.ok) return { success: false };
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async updateFarmerProfile(profileData) {
    try {
      const res = await fetch('/api/farmer/profile', {
        method: 'PATCH',
        headers: this.getHeaders(true),
        body: JSON.stringify(profileData)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async createBooking(bookingData) {
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(bookingData)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async getMyBookings() {
    try {
      const res = await fetch('/api/bookings/mine', {
        headers: this.getHeaders(true)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async getAllBookings() {
    try {
      const res = await fetch('/api/bookings', {
        headers: this.getHeaders(true)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async updateBooking(id, updateData) {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: this.getHeaders(true),
        body: JSON.stringify(updateData)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async createStockyardBooking(bookingData) {
    try {
      const res = await fetch('/api/stockyard-bookings', {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(bookingData)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async getMyStockyardBookings() {
    try {
      const res = await fetch('/api/stockyard-bookings/mine', {
        headers: this.getHeaders(true)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // ================= AGRISTACK DIGITAL FARMER ID =================
  async verifyAgriStack(farmerId, name, dob) {
    try {
      const res = await fetch('/api/farmer/verify-agristack', {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({ farmerId, name, dob })
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async getVerificationQueue() {
    try {
      const res = await fetch('/api/officer/verification-queue', {
        headers: this.getHeaders(true)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async updateFarmerVerification(profileId, status, farmerIdAgristack) {
    try {
      const res = await fetch(`/api/officer/verify-farmer/${profileId}`, {
        method: 'PATCH',
        headers: this.getHeaders(true),
        body: JSON.stringify({ status, farmerIdAgristack })
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // ================= LOGISTICS & TRANSPORT =================
  async createLogisticsRequest(logisticsData) {
    try {
      const res = await fetch('/api/logistics', {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(logisticsData)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async getMyLogisticsRequests() {
    try {
      const res = await fetch('/api/logistics/mine', {
        headers: this.getHeaders(true)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async getAllLogisticsRequests() {
    try {
      const res = await fetch('/api/logistics', {
        headers: this.getHeaders(true)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async updateLogisticsRequest(id, updateData) {
    try {
      const res = await fetch(`/api/logistics/${id}`, {
        method: 'PATCH',
        headers: this.getHeaders(true),
        body: JSON.stringify(updateData)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async getTransporters() {
    try {
      const res = await fetch('/api/transporters', {
        headers: this.getHeaders(true)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async addTransporter(transporterData) {
    try {
      const res = await fetch('/api/transporters', {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(transporterData)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // ================= GOVERNMENT SCHEMES =================
  async getGovtSchemes() {
    try {
      const res = await fetch('/api/schemes');
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async createGovtScheme(schemeData) {
    try {
      const res = await fetch('/api/schemes', {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(schemeData)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async updateGovtScheme(id, schemeData) {
    try {
      const res = await fetch(`/api/schemes/${id}`, {
        method: 'PATCH',
        headers: this.getHeaders(true),
        body: JSON.stringify(schemeData)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // ================= REAL-TIME WEBSOCKET LISTENER =================
  initRealtime(onMessageCallback) {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      let ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('⚡ Real-time WebSocket connection established');
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (onMessageCallback) onMessageCallback(payload);
        } catch (e) {}
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        // Reconnect attempt after 5 seconds if connection drops
        setTimeout(() => this.initRealtime(onMessageCallback), 5000);
      };
    } catch (err) {
      console.warn('WebSocket init failed, falling back to HTTP polling.');
    }
  }
};

window.api = api;
