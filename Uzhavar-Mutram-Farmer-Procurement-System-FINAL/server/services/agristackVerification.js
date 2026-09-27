/**
 * Uzhavar Mutram - AgriStack Digital Farmer ID Verification Adapter Service
 * 
 * NOTE FOR PRODUCTION DEPLOYMENT:
 * Production use requires official AgriStack API access and OAuth2/HMAC credentials 
 * from the Government of India / Ministry of Agriculture & Farmers Welfare (https://agristack.gov.in/).
 * This environment uses a realistic mock verification stub implementing the exact same 
 * async contract and response schema for end-to-end integration testing.
 */

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verify Digital Farmer ID against AgriStack Registry
 * @param {string} farmerId - AgriStack Digital Farmer ID (e.g. FID-TN-2026-8812)
 * @param {string} name - Farmer full legal name
 * @param {string} [dob] - Optional date of birth
 * @returns {Promise<{success: boolean, status: 'VERIFIED'|'FAILED'|'PENDING', farmerId: string, verifiedName?: string, landRecordId?: string, district?: string, state?: string, message?: string}>}
 */
async function verifyFarmerId(farmerId, name, dob) {
  // Simulate realistic network latency to AgriStack central gateway
  await wait(300);

  if (!farmerId || typeof farmerId !== 'string') {
    return {
      success: false,
      status: 'FAILED',
      farmerId: '',
      message: 'Digital Farmer ID is required.'
    };
  }

  const cleanId = farmerId.trim().toUpperCase();

  // Test failure trigger for integration testing
  if (cleanId.includes('REJECT') || cleanId.includes('FAIL') || cleanId.endsWith('0000')) {
    return {
      success: false,
      status: 'FAILED',
      farmerId: cleanId,
      message: 'AgriStack Verification Failed: Digital Farmer ID not found or land title mismatch in state land records.'
    };
  }

  // Basic format validation: accepts FID-xxx, AGRI-xxx, or 8+ alphanumeric characters
  const validFormatRegex = /^(FID-|AGRI-|IND-|TN-)[A-Z0-9-]{4,20}$|^[A-Z0-9]{8,20}$/i;
  if (!validFormatRegex.test(cleanId)) {
    return {
      success: false,
      status: 'FAILED',
      farmerId: cleanId,
      message: 'Invalid AgriStack ID format. Expected format: FID-TN-2026-XXXX or AGRI-XXXXXXX'
    };
  }

  // Mock successful response matching government AgriStack API specs
  return {
    success: true,
    status: 'VERIFIED',
    farmerId: cleanId,
    verifiedName: name || 'Ramesh Singh Kumar',
    landRecordId: 'TN-LND-' + Math.floor(10000 + Math.random() * 90000),
    district: 'Madurai',
    state: 'Tamil Nadu',
    verifiedAt: new Date().toISOString(),
    message: 'AgriStack Digital Farmer ID successfully verified against State Land Records Registry.'
  };
}

module.exports = {
  verifyFarmerId
};
