/**
 * ============================================================================
 * ROTARACT LOOP - 100% GOOGLE SHEETS REST API BACKEND
 * ============================================================================
 * 
 * Features:
 * - Single source of truth: 100% Google Sheets managed (Zero Firebase required).
 * - Admin authentication managed via a private 'Admins' sheet tab in this spreadsheet.
 * - Secure server-side session management via Google CacheService (2-hour auto-expiry).
 * - Brute-force protection: Automatic 15-minute account lockout after 5 failed attempts.
 * - Public submission endpoint (write-only) with bot honeypot and formula injection defense.
 * - All timestamps standardized to Indian Standard Time (IST, UTC+05:30 / Asia/Kolkata).
 * 
 * ----------------------------------------------------------------------------
 * SETUP INSTRUCTIONS:
 * ----------------------------------------------------------------------------
 * 1. Open Google Sheets (https://sheets.new) and title your spreadsheet:
 *    e.g. "Rotaract Loop Registrations 2026-27"
 * 
 * 2. Click: Extensions > Apps Script
 * 
 * 3. Replace all code in Code.gs with this file and save (Cmd+S).
 * 
 * 4. Click "Deploy" (top right) > "New deployment"
 *    - Type: "Web app"
 *    - Description: "Rotaract Loop REST API"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (Required for public submissions)
 *    - Click "Deploy", authorize access, and copy the Web App URL (/exec).
 * 
 * 5. Paste the copied URL into `appsScriptUrl` in `assets/js/config.js`.
 * 
 * 6. Initial Admin Login:
 *    - Email:    admin@rsamdio.org
 *    - Password: Loop2026!AdminPass
 *    (You can change this password or add more admins directly in the 'Admins' sheet tab!)
 * ============================================================================
 */

// Configuration
var SUBMISSIONS_SHEET = 'Submissions';
var ADMINS_SHEET = 'Admins';
var TIMEZONE_IST = 'Asia/Kolkata';
var SESSION_TTL_SECONDS = 7200; // 2 hours
var MAX_FAILED_ATTEMPTS = 5;
var LOCKOUT_TTL_SECONDS = 900;  // 15 minutes

// Submissions Table Headers
var SUBMISSION_HEADERS = [
  'Submission ID',
  'Submitted At (IST)',
  'Rotaractor Name',
  'Rotaract Club',
  'District Number',
  'Business Name',
  'Business Category',
  'Category (Other)',
  'Business Description',
  'Primary Place of Operation',
  'WhatsApp Number',
  'Website / Social Link',
  'Status',
  'Admin Notes',
  'Updated At (IST)'
];

// Admins Table Headers
var ADMIN_HEADERS = [
  'Email',
  'Password',
  'Full Name',
  'Role',
  'Status',
  'Last Login (IST)',
  'Created At (IST)'
];

// ============================================================================
// Time & Formatting Helpers
// ============================================================================

function formatToIST(date) {
  if (!date) return '';
  try {
    var d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return Utilities.formatDate(d, TIMEZONE_IST, "yyyy-MM-dd HH:mm:ss 'IST'");
  } catch (e) {
    return String(date);
  }
}

function toISTISOString(date) {
  if (!date) return '';
  try {
    var d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return Utilities.formatDate(d, TIMEZONE_IST, "yyyy-MM-dd'T'HH:mm:ss+05:30");
  } catch (e) {
    return '';
  }
}

function sanitizeCell(value) {
  if (value === null || value === undefined) return '';
  var str = String(value).trim();
  if (/^[=+@\-]/.test(str)) {
    return "'" + str; // Escape spreadsheet formulas
  }
  return str;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// Spreadsheet Sheet Initializers
// ============================================================================

function getOrCreateSubmissionsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SUBMISSIONS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SUBMISSIONS_SHEET);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SUBMISSION_HEADERS);
    var headerRange = sheet.getRange(1, 1, 1, SUBMISSION_HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1e3a8a');
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);

    for (var i = 1; i <= SUBMISSION_HEADERS.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }
  return sheet;
}

function getOrCreateAdminsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ADMINS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ADMINS_SHEET);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ADMIN_HEADERS);
    var headerRange = sheet.getRange(1, 1, 1, ADMIN_HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#0f172a');
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);

    // Auto-create initial default administrator row
    var now = new Date();
    sheet.appendRow([
      'admin@rsamdio.org',
      'Loop2026!AdminPass',
      'Council Administrator',
      'Super Admin',
      'ACTIVE',
      'Never',
      formatToIST(now)
    ]);

    for (var i = 1; i <= ADMIN_HEADERS.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }
  return sheet;
}

// ============================================================================
// Authentication & Session Management
// ============================================================================

/**
 * Validates a session token from Google CacheService
 */
function validateSession(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string') return null;
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get(sessionToken.trim());
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (e) {
    return null;
  }
}

/**
 * Handle Admin Login against the Admins sheet tab
 */
function handleLogin(email, password) {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required.' };
  }

  email = String(email).toLowerCase().trim();
  password = String(password).trim();

  var cache = CacheService.getScriptCache();
  var failKey = 'fail_count_' + email;
  var lockKey = 'lockout_' + email;

  // Check lockout
  if (cache.get(lockKey)) {
    return {
      success: false,
      error: 'Account temporarily locked due to too many failed attempts. Please try again in 15 minutes.'
    };
  }

  var adminsSheet = getOrCreateAdminsSheet();
  var data = adminsSheet.getDataRange().getValues();
  var matchedRow = -1;
  var adminRecord = null;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowEmail = String(row[0] || '').toLowerCase().trim();
    if (rowEmail === email) {
      matchedRow = i + 1; // 1-indexed for sheet updates
      adminRecord = {
        email: rowEmail,
        password: String(row[1] || '').trim(),
        name: String(row[2] || 'Admin'),
        role: String(row[3] || 'Administrator'),
        status: String(row[4] || 'ACTIVE').toUpperCase().trim()
      };
      break;
    }
  }

  if (!adminRecord) {
    recordFailedAttempt(cache, email, failKey, lockKey);
    return { success: false, error: 'Invalid email or password.' };
  }

  if (adminRecord.status !== 'ACTIVE') {
    return {
      success: false,
      error: 'This administrator account is marked inactive. Please contact the council executive.'
    };
  }

  if (adminRecord.password !== password) {
    recordFailedAttempt(cache, email, failKey, lockKey);
    return { success: false, error: 'Invalid email or password.' };
  }

  // Clear failed attempts upon success
  cache.remove(failKey);
  cache.remove(lockKey);

  // Generate ephemeral 2-hour session token
  var sessionToken = 'SES-' + Utilities.getUuid();
  var sessionData = {
    email: adminRecord.email,
    name: adminRecord.name,
    role: adminRecord.role,
    loginTime: formatToIST(new Date())
  };

  cache.put(sessionToken, JSON.stringify(sessionData), SESSION_TTL_SECONDS);

  // Update Last Login in Admins sheet
  try {
    adminsSheet.getRange(matchedRow, 6).setValue(formatToIST(new Date()));
  } catch (e) {
    Logger.log('Could not update last login: ' + e.toString());
  }

  return {
    success: true,
    sessionToken: sessionToken,
    expiresIn: SESSION_TTL_SECONDS,
    user: {
      email: adminRecord.email,
      name: adminRecord.name,
      role: adminRecord.role
    }
  };
}

function recordFailedAttempt(cache, email, failKey, lockKey) {
  var count = parseInt(cache.get(failKey) || '0', 10) + 1;
  if (count >= MAX_FAILED_ATTEMPTS) {
    cache.put(lockKey, 'locked', LOCKOUT_TTL_SECONDS);
    cache.remove(failKey);
  } else {
    cache.put(failKey, String(count), LOCKOUT_TTL_SECONDS);
  }
}

// ============================================================================
// Data Access
// ============================================================================

function readAllApplications() {
  var sheet = getOrCreateSubmissionsSheet();
  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) return [];

  var applications = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] && !row[5]) continue; // Skip empty rows

    applications.push({
      id: String(row[0] || ''),
      createdAt: row[1] ? formatToIST(row[1]) : '',
      rotaractor_name: String(row[2] || ''),
      rotaract_club: String(row[3] || ''),
      district_number: String(row[4] || ''),
      business_name: String(row[5] || ''),
      business_category: String(row[6] || ''),
      business_category_other: String(row[7] || ''),
      business_description: String(row[8] || ''),
      place_of_operation: String(row[9] || ''),
      whatsapp_number: String(row[10] || ''),
      website_or_social: String(row[11] || ''),
      status: String(row[12] || 'Pending'),
      admin_notes: String(row[13] || ''),
      updatedAt: row[14] ? formatToIST(row[14]) : ''
    });
  }

  applications.reverse(); // Newest first
  return applications;
}

// ============================================================================
// Request Handlers
// ============================================================================

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'ping';

    if (action === 'ping') {
      return jsonResponse({
        success: true,
        message: 'Rotaract Loop Google Sheets REST API is online.',
        timestamp_ist: formatToIST(new Date()),
        timezone: TIMEZONE_IST
      });
    }

    return jsonResponse({ success: false, error: 'GET action not supported: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: 'Server error: ' + err.toString() });
  }
}

function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseError) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var action = payload.action || 'submit';

    // -------------------------------------------------------------
    // 1. PUBLIC SUBMISSION (Write-Only)
    // -------------------------------------------------------------
    if (action === 'submit') {
      // Honeypot bot protection
      if (payload.website_trap && payload.website_trap.length > 0) {
        return jsonResponse({
          success: true,
          message: 'Submission received.',
          id: 'LOOP-FILTERED'
        });
      }

      // Mandatory validation
      if (!payload.rotaractor_name || !payload.business_name || !payload.business_category) {
        return jsonResponse({
          success: false,
          error: 'Required fields missing: Name, Business Name, and Category are mandatory.'
        });
      }

      var sheet = getOrCreateSubmissionsSheet();
      var now = new Date();
      var istTimestamp = formatToIST(now);
      var istISOString = toISTISOString(now);
      var yearString = Utilities.formatDate(now, TIMEZONE_IST, 'yyyy');
      var submissionId = 'LOOP-' + yearString + '-' + Math.floor(100000 + Math.random() * 900000);

      var newRow = [
        submissionId,
        istTimestamp,
        sanitizeCell(payload.rotaractor_name),
        sanitizeCell(payload.rotaract_club),
        sanitizeCell(payload.district_number),
        sanitizeCell(payload.business_name),
        sanitizeCell(payload.business_category),
        sanitizeCell(payload.business_category_other),
        sanitizeCell(payload.business_description),
        sanitizeCell(payload.place_of_operation),
        sanitizeCell(payload.whatsapp_number),
        sanitizeCell(payload.website_or_social),
        'Pending',
        '',
        istTimestamp
      ];

      sheet.appendRow(newRow);

      return jsonResponse({
        success: true,
        id: submissionId,
        message: 'Your registration for Rotaract Loop has been received successfully.',
        timestamp: istISOString,
        timestamp_ist: istTimestamp,
        timezone: TIMEZONE_IST
      });
    }

    // -------------------------------------------------------------
    // 2. ADMIN LOGIN (Authenticates against Admins Sheet)
    // -------------------------------------------------------------
    if (action === 'login') {
      var loginResult = handleLogin(payload.email, payload.password);
      return jsonResponse(loginResult);
    }

    // -------------------------------------------------------------
    // 3. VERIFY SESSION TOKEN
    // -------------------------------------------------------------
    if (action === 'verifySession') {
      var session = validateSession(payload.sessionToken);
      if (session) {
        return jsonResponse({ success: true, valid: true, user: session });
      }
      return jsonResponse({ success: true, valid: false, error: 'Session expired or invalid.' });
    }

    // -------------------------------------------------------------
    // 4. ADMIN LOGOUT
    // -------------------------------------------------------------
    if (action === 'logout') {
      if (payload.sessionToken) {
        CacheService.getScriptCache().remove(payload.sessionToken.trim());
      }
      return jsonResponse({ success: true, message: 'Logged out.' });
    }

    // -------------------------------------------------------------
    // 5. GET REGISTRATIONS (Protected via sessionToken)
    // -------------------------------------------------------------
    if (action === 'getApplications') {
      var session = validateSession(payload.sessionToken);
      if (!session) {
        return jsonResponse({
          success: false,
          error: 'Unauthorized: Session expired or invalid. Please log in again.'
        });
      }

      var applications = readAllApplications();
      return jsonResponse({
        success: true,
        data: applications,
        count: applications.length,
        timezone: TIMEZONE_IST
      });
    }

    // -------------------------------------------------------------
    // 6. UPDATE STATUS (Protected via sessionToken)
    // -------------------------------------------------------------
    if (action === 'updateStatus') {
      var session = validateSession(payload.sessionToken);
      if (!session) {
        return jsonResponse({
          success: false,
          error: 'Unauthorized: Session expired or invalid. Please log in again.'
        });
      }

      var applicationId = payload.id;
      var newStatus = payload.status;
      var adminNotes = payload.adminNotes;

      if (!applicationId || !newStatus) {
        return jsonResponse({ success: false, error: 'Missing registration ID or status.' });
      }

      var sheet = getOrCreateSubmissionsSheet();
      var data = sheet.getDataRange().getValues();
      var foundRow = -1;

      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === String(applicationId).trim()) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow === -1) {
        return jsonResponse({ success: false, error: 'Registration ID not found: ' + applicationId });
      }

      sheet.getRange(foundRow, 13).setValue(sanitizeCell(newStatus));
      if (adminNotes !== undefined) {
        sheet.getRange(foundRow, 14).setValue(sanitizeCell(adminNotes));
      }
      sheet.getRange(foundRow, 15).setValue(formatToIST(new Date()));

      return jsonResponse({
        success: true,
        message: 'Status updated to ' + newStatus,
        id: applicationId,
        status: newStatus,
        updated_at_ist: formatToIST(new Date())
      });
    }

    return jsonResponse({ success: false, error: 'Unknown action: ' + action });

  } catch (err) {
    return jsonResponse({ success: false, error: 'Server error: ' + err.toString() });
  }
}
