
// Simple License Service for Monthly Rentals
// In a real production environment, use asymmetric encryption (public/private keys).
// For this standalone app, we use a shared secret HMAC-like approach.

const LICENSE_STORAGE_KEY = "clover_pos_license";
const SECRET_SALT = "CLOVER_POS_SECURE_SALT_2025_PAKISTAN"; // Change this in production!

export interface LicenseData {
  storeName: string;
  restaurant_id: string; // Ties license to a specific SaaS tenant
  expiryDate: string; // ISO Date string
  type: 'monthly' | 'yearly' | 'lifetime';
}

export const licenseService = {
  // Generate a license key (Admin only function - exposed here for demo/generator)
  generateLicense: (data: LicenseData): string => {
    const payload = JSON.stringify(data);
    const signature = licenseService.createSignature(payload);
    // Format: Base64(payload)|signature
    return btoa(payload) + "." + signature;
  },

  // Validate a license key
  validateLicense: (key: string): { valid: boolean; data?: LicenseData; error?: string } => {
    try {
      if (!key) return { valid: false, error: "No license key found" };

      const [encodedPayload, signature] = key.split(".");
      if (!encodedPayload || !signature) return { valid: false, error: "Invalid license format" };

      const payload = atob(encodedPayload);
      const expectedSignature = licenseService.createSignature(payload);

      if (signature !== expectedSignature) {
        return { valid: false, error: "Invalid license signature" };
      }

      const data: LicenseData = JSON.parse(payload);
      const expiry = new Date(data.expiryDate);
      const now = new Date();

      if (expiry < now) {
        return { valid: false, error: "License expired on " + expiry.toLocaleDateString(), data };
      }

      return { valid: true, data };
    } catch (e) {
      console.error("License validation error:", e);
      return { valid: false, error: "Corrupt license data" };
    }
  },

  // Create a simple hash signature
  createSignature: (payload: string): string => {
    let hash = 0;
    const str = payload + SECRET_SALT;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  },

  saveLicense: (key: string) => {
    localStorage.setItem(LICENSE_STORAGE_KEY, key);
  },

  getLicense: (): string | null => {
    return localStorage.getItem(LICENSE_STORAGE_KEY);
  },
  
  clearLicense: () => {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
  }
};
