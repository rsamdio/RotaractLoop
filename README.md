# Rotaract Loop: Where Rotaract Entrepreneurs Connect & Grow

A modern, high-performance web portal for registering and onboarding Rotaractor entrepreneurs, founders, and professionals into **Rotaract Loop**, the business networking circle. Powered by a **100% Google Sheets REST API** backend (with native spreadsheet-managed admin authentication) and designed with a welcoming, enterprise-grade **light mode**.

---

## 🌟 Key Features

### For Rotaract Entrepreneurs & Business Owners
- **9-Step Streamlined Registration**:
  1. Rotaractor Name
  2. Rotaract Club
  3. District Number
  4. Business Name
  5. Business Category (Dropdown of 25 industry categories with dynamic "Other" specification)
  6. Business Description & Customers Served
  7. Primary Place of Operation
  8. Contact Number (with international code format)
  9. Business Website / Social Media Link
- **Review & Confirm Step**: Full summary with quick edit jump buttons before final submission.
- **Auto-Save**: Form answers are saved locally in `localStorage` in real-time.
- **Mobile Responsive**: Smooth touch-scroller navigation and responsive card layouts.
- **Welcoming Light Mode**: Rotaract Royal Navy (`#1e3a8a`), Rotary Gold (`#d97706`), and clean slate typography.

### For Administrators
- **Secure Passkey Authentication**: Admin portal is protected with token verification against Google Apps Script Script Properties (`ADMIN_SECRET_KEY`).
- **Real-Time Pipeline Stats**: Track community members by status (`Pending`, `Under Review`, `Verified`, `Approved / Added`, `Declined`).
- **25 Category Distribution Filter**: Interactive category pills showing real-time member counts per category.
- **One-Click Contact Action**: Direct WhatsApp chat launcher (`wa.me`) for welcoming and onboarding members into the community.
- **One-Click Web Launcher**: Open business websites and social media profiles with one click.
- **Instant Status Management**: Update status with optimistic UI updates that sync to Google Sheets.
- **CSV Data Export**: Export all filtered or total community members with full details into clean CSV files.

---

## 🏗️ Architecture: Google Apps Script REST API

```
┌─────────────────────────────────────────────────────────────┐
│                    Rotaract Loop Frontend                   │
│   (index.html & admin.html on Netlify / GitHub Pages / CDN) │
└──────────────┬───────────────────────────────▲──────────────┘
               │                               │
        POST (Submit / Update)          GET (Fetch / Verify)
               │                               │
┌──────────────▼───────────────────────────────┴──────────────┐
│             Google Apps Script Web App REST API             │
│                 (google-apps-script/Code.gs)                │
│                                                             │
│  - Public Action: 'submit' (Appends new row, anti-spam)     │
│  - Protected Action: 'getApplications' (Requires Token)     │
│  - Protected Action: 'updateStatus' (Requires Token)        │
│  - Protected Action: 'verifyAdmin' (Requires Token)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
               Auto-creates & reads headers
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Google Sheet Database                    │
│              (Submissions Sheet with 15 Columns)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Google Apps Script Setup & Deployment (5 Minutes)

### Step 1: Create a Google Sheet
1. Open Google Sheets at [sheets.new](https://sheets.new).
2. Name your spreadsheet: **Rotaract Loop Registrations 2026-27**.

### Step 2: Open Apps Script
1. In the top menu of your Google Sheet, click **Extensions** > **Apps Script**.
2. Name the project: **Rotaract Loop API**.

### Step 3: Paste Code.gs
1. Delete any default code inside `Code.gs`.
2. Open [`google-apps-script/Code.gs`](google-apps-script/Code.gs) from this repository, copy the entire content, and paste it into the editor.

### Step 4: Configure the Admin Secret Passkey
1. In the left navigation menu of the Apps Script editor, click the **Project Settings** (gear icon ⚙️).
2. Scroll down to **Script Properties** and click **Add script property**.
   - **Property**: `ADMIN_SECRET_KEY`
   - **Value**: Enter your private admin passkey (e.g., `LoopAdmin2026!Key` or any strong passphrase).
3. Click **Save script properties**.

### Step 5: Deploy as a Web App
1. Click the blue **Deploy** button (top right) > **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in the deployment details:
   - **Description**: `Rotaract Loop Production API v1`
   - **Execute as**: `Me (<your-email>@gmail.com)`
   - **Who has access**: `Anyone` *(Required so public applicants can submit forms without a Google login)*
4. Click **Deploy**.
5. When prompted, click **Authorize access**, choose your Google account, click *Advanced* > *Go to Rotaract Loop API (unsafe)*, and click *Allow*.
6. **Copy the Web App URL** (it ends with `/exec`).

### Step 6: Connect Frontend
1. Open [`assets/js/config.js`](assets/js/config.js) in your codebase.
2. Paste your Web App URL into `CONFIG.appsScriptUrl`:
   ```javascript
   appsScriptUrl: 'https://script.google.com/macros/s/AKfycbxYOUR_ID/exec',
   ```
3. Save the file. Your portal is now fully live and connected to your Google Sheet!

---

## 🔒 Security Model

1. **Read Protection**:
   - The `doGet` endpoint strictly enforces `adminToken` validation against `ADMIN_SECRET_KEY`.
   - Public visitors cannot read, dump, or scrape existing business listings from the API.
2. **Formula Injection Sanitization**:
   - All cell values starting with `=, +, -, @` are escaped to protect against CSV/Spreadsheet formula injection attacks.
3. **Anti-Spam Trap**:
   - Hidden honeypot fields silently discard automated bot spam submissions.
4. **CORS & Redirects**:
   - Uses `text/plain` payloads with `redirect: 'follow'` to ensure zero CORS preflight issues across custom domains and CDNs.

---

## 📂 Project Structure

```
Rotaract Loop/
├── index.html                  # Public community registration flow
├── admin.html                  # Secure admin dashboard
├── netlify.toml                # Unified security headers, CSP & rewrites
├── assets/
│   ├── css/
│   │   ├── main.css            # Light mode design system & form styles
│   │   └── admin.css           # Light mode admin dashboard styles
│   ├── js/
│   │   ├── config.js           # Central configuration & categories
│   │   ├── api.js              # Dedicated Google Sheets REST API client
│   │   ├── app.js              # Multi-step community onboarding controller
│   │   └── admin.js            # Admin dashboard logic & CSV exporter
│   └── images/
│       ├── rsamdio.webp        # Official RSAMDIO branding logo
│       ├── ogimage.webp        # OpenGraph & Twitter preview card (1200x630)
│       ├── favicon.webp        # Primary high-res site favicon
│       └── favicon.ico         # Legacy fallback icon
└── google-apps-script/
    └── Code.gs                 # Serverless REST API for Google Sheets (Submissions & Admins)
```

---

## 📋 The 25 Business Categories

1. Agriculture & Farming
2. Automobiles & Transportation
3. Beauty, Wellness & Personal Care
4. Construction & Real Estate
5. Education & Training
6. Engineering & Manufacturing
7. Entertainment & Media
8. Events & Wedding Services
9. Finance, Insurance & Investments
10. Food & Beverages
11. Healthcare & Medical
12. Hospitality & Tourism
13. Information Technology & Software
14. Legal & Professional Services
15. Logistics & Courier Services
16. Marketing, Advertising & Branding
17. Retail & E-Commerce
18. Textiles, Fashion & Apparel
19. Trading & Distribution
20. Travel & Tourism
21. Import & Export
22. Consulting & Business Services
23. Home & Lifestyle
24. Printing & Publishing
25. Other *(triggers an inline custom text specification)*

---

## 💻 Local Testing & Verification

You can run this project with any local HTTP server:

```bash
# Using Python
python3 -m http.server 8080

# Or using Node.js npx
npx serve .
```

Open:
- Form: `http://localhost:8080/index.html`
- Admin: `http://localhost:8080/admin.html`
