/**
 * Rotaract Loop - 100% Google Sheets Dedicated REST API Client
 * Interfaces directly with Google Apps Script Web App for single-source-of-truth persistence.
 */
(function() {
  'use strict';

  /**
   * Helper to perform fetch with timeout protection
   */
  async function fetchWithTimeout(url, options = {}, timeoutMs = 18000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Please check your internet connection and try again.');
      }
      throw err;
    }
  }

  const API = {
    /**
     * Submit a new registration to Google Sheets (Public Write-Only)
     * @param {Object} formData Form answers
     * @returns {Promise<{success: boolean, id?: string, message?: string, error?: string}>}
     */
    async submitApplication(formData) {
      if (!CONFIG.appsScriptUrl || CONFIG.appsScriptUrl.includes('YOUR_DEPLOYED_WEBAPP_ID_HERE')) {
        return {
          success: false,
          error: 'Google Apps Script URL has not been configured in assets/js/config.js.'
        };
      }

      try {
        const payload = {
          action: 'submit',
          clientRequestId: 'REQ-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000),
          ...formData
        };

        const response = await fetchWithTimeout(
          CONFIG.appsScriptUrl,
          {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          },
          CONFIG.requestTimeoutMs || 18000
        );

        if (!response.ok) {
          throw new Error('Server returned HTTP status ' + response.status);
        }

        const result = await response.json();
        if (result && result.success) {
          return {
            success: true,
            id: result.id,
            message: result.message || 'Your registration for Rotaract Loop has been received successfully.'
          };
        }

        return {
          success: false,
          error: result.error || 'The submission could not be processed by the server.'
        };
      } catch (err) {
        console.error('Submission error:', err);
        return {
          success: false,
          error: err.message || 'Could not connect to the submission server. Please check your connection.'
        };
      }
    },

    /**
     * Authenticate an admin against the 'Admins' sheet tab
     * @param {string} email Admin email
     * @param {string} password Admin password
     * @returns {Promise<{success: boolean, sessionToken?: string, user?: Object, error?: string}>}
     */
    async login(email, password) {
      if (!email || !password) {
        return { success: false, error: 'Email and password are required.' };
      }

      if (!CONFIG.appsScriptUrl || CONFIG.appsScriptUrl.includes('YOUR_DEPLOYED_WEBAPP_ID_HERE')) {
        return { success: false, error: 'Google Apps Script URL is not configured in config.js.' };
      }

      try {
        const payload = {
          action: 'login',
          email: email.trim(),
          password: password.trim()
        };

        const response = await fetchWithTimeout(
          CONFIG.appsScriptUrl,
          {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          },
          15000
        );

        const result = await response.json();
        return result;
      } catch (err) {
        console.error('Login network error:', err);
        return { success: false, error: 'Network error connecting to verification server.' };
      }
    },

    /**
     * Validate an existing session token
     * @param {string} sessionToken 
     * @returns {Promise<{valid: boolean, user?: Object, error?: string}>}
     */
    async verifySession(sessionToken) {
      if (!sessionToken) return { valid: false };

      try {
        const payload = {
          action: 'verifySession',
          sessionToken: sessionToken.trim()
        };

        const response = await fetchWithTimeout(
          CONFIG.appsScriptUrl,
          {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          },
          10000
        );

        const result = await response.json();
        return {
          valid: !!(result && result.valid),
          user: result.user || null,
          error: result.error || null
        };
      } catch (err) {
        console.warn('Session check network error:', err);
        return { valid: false, error: 'Network error verifying session.' };
      }
    },

    /**
     * Log out and invalidate session in Google Apps Script CacheService
     * @param {string} sessionToken 
     */
    async logout(sessionToken) {
      if (!sessionToken) return { success: true };

      try {
        const payload = {
          action: 'logout',
          sessionToken: sessionToken.trim()
        };

        await fetchWithTimeout(
          CONFIG.appsScriptUrl,
          {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          },
          6000
        );
      } catch (e) {
        // Silently ignore logout network failures
      }
      return { success: true };
    },

    /**
     * Fetch all registrations for the admin dashboard (Protected via sessionToken)
     * @param {string} sessionToken Active admin session token
     * @returns {Promise<{success: boolean, data?: Array, count?: number, error?: string}>}
     */
    async getApplications(sessionToken) {
      if (!sessionToken) {
        return { success: false, error: 'Session token is missing. Please log in.' };
      }

      try {
        const payload = {
          action: 'getApplications',
          sessionToken: sessionToken.trim()
        };

        const response = await fetchWithTimeout(
          CONFIG.appsScriptUrl,
          {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          },
          CONFIG.requestTimeoutMs || 20000
        );

        const result = await response.json();
        if (result && result.success) {
          return {
            success: true,
            data: result.data || [],
            count: result.count || (result.data ? result.data.length : 0)
          };
        }

        return {
          success: false,
          error: result.error || 'Failed to retrieve registrations from the database.'
        };
      } catch (err) {
        console.error('Fetch registrations error:', err);
        return {
          success: false,
          error: 'Network error loading registrations. ' + (err.message || '')
        };
      }
    },

    /**
     * Update application status in Google Sheets (Protected via sessionToken)
     * @param {string} id Application ID (e.g., 'LOOP-2026-123456')
     * @param {string} newStatus New status string
     * @param {string} sessionToken Active admin session token
     * @param {string} [adminNotes] Optional notes
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async updateStatus(id, newStatus, sessionToken, adminNotes) {
      if (!id || !newStatus || !sessionToken) {
        return { success: false, error: 'Missing required parameters.' };
      }

      try {
        const payload = {
          action: 'updateStatus',
          sessionToken: sessionToken.trim(),
          id: id,
          status: newStatus,
          adminNotes: adminNotes !== undefined ? adminNotes : undefined
        };

        const response = await fetchWithTimeout(
          CONFIG.appsScriptUrl,
          {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          },
          15000
        );

        const result = await response.json();
        return {
          success: !!result.success,
          error: result.error || null
        };
      } catch (err) {
        console.error('Update status error:', err);
        return { success: false, error: 'Network error updating status.' };
      }
    },

    // Backward-compatible alias for legacy calls
    async verifyAdminToken(sessionToken) {
      const res = await this.verifySession(sessionToken);
      return { valid: res.valid, error: res.error };
    }
  };

  window.RotaractLoopAPI = API;
  window.RotaractBizAPI = API; // Backward-compatible alias
})();
