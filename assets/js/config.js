/**
 * Rotaract Loop - Central Configuration
 * Shared configuration for application form and admin portal.
 */
const CONFIG = {
  appName: 'Rotaract Loop',
  tagline: 'Where Rotaract Entrepreneurs Connect & Grow',

  // Google Apps Script REST API Web App URL (Sole Database Backend)
  // Deploy your script from google-apps-script/Code.gs and paste the /exec URL below:
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbwbQEHNEYbfQSg45jewrfTKXnnenB_s46dcHmqGKk4rx8XIX6UsB08zZEix9347oQ6U/exec',

  // Request timeout in milliseconds for network calls
  requestTimeoutMs: 18000,

  // Local storage / session storage keys
  storageKeys: {
    formDraft: 'rotaract_loop_answers',
    adminToken: 'rotaract_loop_admin_token',
    adminUser: 'rotaract_loop_admin_user'
  },

  // 25 Business Categories
  categories: [
    'Agriculture & Farming',
    'Automobiles & Transportation',
    'Beauty, Wellness & Personal Care',
    'Construction & Real Estate',
    'Education & Training',
    'Engineering & Manufacturing',
    'Entertainment & Media',
    'Events & Wedding Services',
    'Finance, Insurance & Investments',
    'Food & Beverages',
    'Healthcare & Medical',
    'Hospitality & Tourism',
    'Information Technology & Software',
    'Legal & Professional Services',
    'Logistics & Courier Services',
    'Marketing, Advertising & Branding',
    'Retail & E-Commerce',
    'Textiles, Fashion & Apparel',
    'Trading & Distribution',
    'Travel & Tourism',
    'Import & Export',
    'Consulting & Business Services',
    'Home & Lifestyle',
    'Printing & Publishing',
    'Other'
  ],

  // Application lifecycle statuses
  statuses: [
    { id: 'Pending', label: 'Pending', class: 'pending' },
    { id: 'Under Review', label: 'Under Review', class: 'review' },
    { id: 'Verified', label: 'Verified', class: 'verified' },
    { id: 'Approved', label: 'Approved', class: 'approved' },
    { id: 'Rejected', label: 'Rejected', class: 'rejected' }
  ]
};

// Expose globally for both browser scripts and modules
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
