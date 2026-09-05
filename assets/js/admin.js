/* ==========================================================================
   Rotaract Loop - Admin Directory Controller
   Community intelligence, custom styled dropdown filters, and data exports.
   ========================================================================== */

(function() {
  'use strict';

  // State
  let applications = [];
  let applicationsCache = null;
  let cacheTimestamp = null;
  const CACHE_DURATION = 30000; // 30 seconds
  let expandedRows = new Set();
  let currentSort = { column: 'date', order: 'desc' };
  let selectedCategoryFilter = '';
  let selectedDistrictFilter = '';
  let availableDistricts = [];

  const TOKEN_KEY = (window.CONFIG && window.CONFIG.storageKeys && window.CONFIG.storageKeys.adminToken)
    ? window.CONFIG.storageKeys.adminToken
    : 'rotaract_loop_admin_token';

  const USER_KEY = (window.CONFIG && window.CONFIG.storageKeys && window.CONFIG.storageKeys.adminUser)
    ? window.CONFIG.storageKeys.adminUser
    : 'rotaract_loop_admin_user';

  const CATEGORIES = (window.CONFIG && window.CONFIG.categories) ? window.CONFIG.categories : [];

  // DOM Elements
  const loginScreen = document.getElementById('loginScreen');
  const adminDashboard = document.getElementById('adminDashboard');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminEmailInput = document.getElementById('adminEmailInput');
  const adminPasskeyInput = document.getElementById('adminPasskeyInput');
  const togglePasskeyBtn = document.getElementById('togglePasskeyBtn');
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  const loginBtnText = document.getElementById('loginBtnText');
  const loginBtnSpinner = document.getElementById('loginBtnSpinner');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const exportExcelBtn = document.getElementById('exportExcelBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  
  // Custom Filter Dropdowns
  const categoryDropdownWrap = document.getElementById('categoryDropdownWrap');
  const categoryDropdownBtn = document.getElementById('categoryDropdownBtn');
  const categoryDropdownLabel = document.getElementById('categoryDropdownLabel');
  const categoryDropdownMenu = document.getElementById('categoryDropdownMenu');
  const categorySearchInput = document.getElementById('categorySearchInput');
  const categoryOptionsList = document.getElementById('categoryOptionsList');
  const categoryFilter = document.getElementById('categoryFilter');

  const districtDropdownWrap = document.getElementById('districtDropdownWrap');
  const districtDropdownBtn = document.getElementById('districtDropdownBtn');
  const districtDropdownLabel = document.getElementById('districtDropdownLabel');
  const districtDropdownMenu = document.getElementById('districtDropdownMenu');
  const districtOptionsList = document.getElementById('districtOptionsList');
  const districtFilter = document.getElementById('districtFilter');

  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  const resultsCount = document.getElementById('resultsCount');
  const applicationsTableBody = document.getElementById('applicationsTableBody');
  const mobileCardsContainer = document.getElementById('mobileCardsContainer');
  const categoryPillsContainer = document.getElementById('categoryPillsContainer');
  const backendIndicator = document.getElementById('backendIndicator');

  // Directory Stats Elements
  const statTotal = document.getElementById('statTotal');
  const statCategories = document.getElementById('statCategories');
  const statDistricts = document.getElementById('statDistricts');
  const statClubs = document.getElementById('statClubs');

  // --------------------------------------------------------------------------
  // Custom Styled Filter Dropdown Logic
  // --------------------------------------------------------------------------

  function closeAllDropdowns() {
    if (categoryDropdownWrap) categoryDropdownWrap.classList.remove('is-open');
    if (districtDropdownWrap) districtDropdownWrap.classList.remove('is-open');
    if (categoryDropdownBtn) categoryDropdownBtn.setAttribute('aria-expanded', 'false');
    if (districtDropdownBtn) districtDropdownBtn.setAttribute('aria-expanded', 'false');
  }

  function renderCategoryDropdownOptions(searchTerm = '') {
    if (!categoryOptionsList) return;
    categoryOptionsList.innerHTML = '';

    const clean = searchTerm.toLowerCase().trim();
    const allOptions = ['All Categories (25)', ...CATEGORIES];
    let matchCount = 0;

    allOptions.forEach(cat => {
      const isAll = cat === 'All Categories (25)';
      const actualVal = isAll ? '' : cat;
      const matches = !clean || cat.toLowerCase().includes(clean);

      if (matches) {
        matchCount++;
        const isSelected = selectedCategoryFilter === actualVal;
        const li = document.createElement('li');
        li.className = `custom-filter-option ${isSelected ? 'is-selected' : ''}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        li.innerHTML = `
          <span>${escapeHtml(cat)}</span>
          ${isSelected ? '<span class="custom-filter-option__check">✓</span>' : ''}
        `;
        li.addEventListener('click', () => {
          selectCategory(actualVal, isAll ? 'All Categories (25)' : cat);
        });
        categoryOptionsList.appendChild(li);
      }
    });

    if (matchCount === 0) {
      const empty = document.createElement('li');
      empty.className = 'custom-filter-empty';
      empty.textContent = 'No matching categories found';
      categoryOptionsList.appendChild(empty);
    }
  }

  function selectCategory(val, label) {
    selectedCategoryFilter = val;
    if (categoryFilter) categoryFilter.value = val;
    if (categoryDropdownLabel) {
      categoryDropdownLabel.textContent = label;
    }
    closeAllDropdowns();
    renderCategoryDropdownOptions();
    renderApplications();
    updateStats();
  }

  function populateDistrictDropdown(data) {
    const districtSet = new Set();
    data.forEach(item => {
      const dist = String(item.district_number || '').trim();
      if (dist) districtSet.add(dist);
    });

    availableDistricts = Array.from(districtSet).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

    renderDistrictDropdownOptions();
  }

  function renderDistrictDropdownOptions() {
    if (!districtOptionsList) return;
    districtOptionsList.innerHTML = '';

    const allOption = document.createElement('li');
    const isAllSelected = !selectedDistrictFilter;
    allOption.className = `custom-filter-option ${isAllSelected ? 'is-selected' : ''}`;
    allOption.setAttribute('role', 'option');
    allOption.setAttribute('aria-selected', isAllSelected ? 'true' : 'false');
    allOption.innerHTML = `
      <span>All Districts</span>
      ${isAllSelected ? '<span class="custom-filter-option__check">✓</span>' : ''}
    `;
    allOption.addEventListener('click', () => {
      selectDistrict('', 'All Districts');
    });
    districtOptionsList.appendChild(allOption);

    availableDistricts.forEach(dist => {
      const isSelected = selectedDistrictFilter === dist;
      const li = document.createElement('li');
      li.className = `custom-filter-option ${isSelected ? 'is-selected' : ''}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      li.innerHTML = `
        <span>District ${escapeHtml(dist)}</span>
        ${isSelected ? '<span class="custom-filter-option__check">✓</span>' : ''}
      `;
      li.addEventListener('click', () => {
        selectDistrict(dist, `District ${dist}`);
      });
      districtOptionsList.appendChild(li);
    });
  }

  function selectDistrict(val, label) {
    selectedDistrictFilter = val;
    if (districtFilter) districtFilter.value = val;
    if (districtDropdownLabel) {
      districtDropdownLabel.textContent = label;
    }
    closeAllDropdowns();
    renderDistrictDropdownOptions();
    renderApplications();
    updateStats();
  }

  // Dropdown Open/Close Listeners
  if (categoryDropdownBtn && categoryDropdownWrap) {
    categoryDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = categoryDropdownWrap.classList.contains('is-open');
      closeAllDropdowns();
      if (!isOpen) {
        categoryDropdownWrap.classList.add('is-open');
        categoryDropdownBtn.setAttribute('aria-expanded', 'true');
        if (categorySearchInput) {
          categorySearchInput.value = '';
          renderCategoryDropdownOptions('');
          setTimeout(() => categorySearchInput.focus(), 60);
        }
      }
    });
  }

  if (districtDropdownBtn && districtDropdownWrap) {
    districtDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = districtDropdownWrap.classList.contains('is-open');
      closeAllDropdowns();
      if (!isOpen) {
        districtDropdownWrap.classList.add('is-open');
        districtDropdownBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  if (categorySearchInput) {
    categorySearchInput.addEventListener('input', (e) => {
      renderCategoryDropdownOptions(e.target.value);
    });
    categorySearchInput.addEventListener('click', (e) => e.stopPropagation());
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-filter-dropdown')) {
      closeAllDropdowns();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllDropdowns();
  });

  // --------------------------------------------------------------------------
  // Standardized Indian Standard Time (IST) Helpers
  // --------------------------------------------------------------------------

  function parseDateForSort(val) {
    if (!val) return 0;
    if (typeof val === 'string') {
      const cleaned = val.replace(' IST', '').replace(' ', 'T') + '+05:30';
      const parsed = Date.parse(cleaned);
      if (!isNaN(parsed)) return parsed;
    }
    const d = new Date(val).getTime();
    return isNaN(d) ? 0 : d;
  }

  function formatIST(dateVal, includeTime = false) {
    if (!dateVal) return 'N/A';
    const str = String(dateVal).trim();
    if (!str) return 'N/A';

    try {
      if (str.endsWith('IST')) {
        if (!includeTime) {
          const parts = str.split(' ');
          if (parts.length >= 2) {
            const [y, m, d] = parts[0].split('-');
            if (y && m && d) {
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const mName = months[parseInt(m, 10) - 1] || m;
              return `${d} ${mName} ${y}`;
            }
          }
        }
        return str;
      }

      const date = new Date(str);
      if (isNaN(date.getTime())) return str;

      const options = {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      };
      if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.hour12 = true;
      }
      return new Intl.DateTimeFormat('en-IN', options).format(date) + (includeTime ? ' IST' : '');
    } catch (e) {
      return str;
    }
  }

  function formatISTFull(dateVal) {
    return formatIST(dateVal, true);
  }

  // --------------------------------------------------------------------------
  // Authentication & Session
  // --------------------------------------------------------------------------

  function getStoredToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function setStoredToken(token) {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  }

  function getStoredUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function setStoredUser(user) {
    if (user) {
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(USER_KEY);
    }
  }

  async function checkAuth() {
    const token = getStoredToken();
    if (!token) {
      showLogin();
      return;
    }

    try {
      const verifyRes = await window.RotaractLoopAPI.verifySession(token);
      if (verifyRes.valid) {
        if (verifyRes.user) setStoredUser(verifyRes.user);
        showDashboard();
        loadApplications();
      } else {
        setStoredToken('');
        setStoredUser(null);
        showLogin();
      }
    } catch (e) {
      showDashboard();
      loadApplications();
    }
  }

  // Toggle show/hide password
  if (togglePasskeyBtn && adminPasskeyInput) {
    togglePasskeyBtn.addEventListener('click', () => {
      const isPassword = adminPasskeyInput.type === 'password';
      adminPasskeyInput.type = isPassword ? 'text' : 'password';
      togglePasskeyBtn.textContent = isPassword ? 'Hide' : 'Show';
    });
  }

  // Handle Login Form Submit
  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = adminEmailInput ? adminEmailInput.value.trim() : '';
      const password = adminPasskeyInput ? adminPasskeyInput.value.trim() : '';

      if (!email || !password) {
        showError('Please enter both your admin email and password.');
        return;
      }

      setLoading(true);
      loginError.classList.add('hidden');

      try {
        const loginRes = await window.RotaractLoopAPI.login(email, password);
        if (loginRes && loginRes.success && loginRes.sessionToken) {
          setStoredToken(loginRes.sessionToken);
          if (loginRes.user) setStoredUser(loginRes.user);
          showDashboard();
          loadApplications(true);
        } else {
          showError(loginRes.error || 'Invalid credentials. Please verify your email and password.');
        }
      } catch (err) {
        console.error('Login error:', err);
        showError('Network error connecting to verification server.');
      } finally {
        setLoading(false);
      }
    });
  }

  function setLoading(isLoading) {
    if (!adminLoginBtn) return;
    adminLoginBtn.disabled = isLoading;
    if (loginBtnText) loginBtnText.textContent = isLoading ? 'Signing In...' : 'Sign In to Admin';
    if (loginBtnSpinner) loginBtnSpinner.classList.toggle('hidden', !isLoading);
  }

  function showError(msg) {
    if (!loginError) return;
    loginError.textContent = msg;
    loginError.classList.remove('hidden');
  }

  // Handle Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const token = getStoredToken();
      if (token) {
        await window.RotaractLoopAPI.logout(token);
      }
      setStoredToken('');
      setStoredUser(null);
      applications = [];
      applicationsCache = null;
      if (adminPasskeyInput) adminPasskeyInput.value = '';
      if (adminEmailInput) adminEmailInput.value = '';
      showLogin();
    });
  }

  function showLogin() {
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (adminDashboard) adminDashboard.classList.add('hidden');
  }

  function showDashboard() {
    if (loginScreen) loginScreen.classList.add('hidden');
    if (adminDashboard) adminDashboard.classList.remove('hidden');

    if (backendIndicator) {
      const user = getStoredUser();
      if (user && user.name) {
        backendIndicator.textContent = `Google Sheets • ${user.name} (${user.role || 'Admin'})`;
      } else {
        backendIndicator.textContent = 'Connected to Google Sheets REST API';
      }
    }
  }

  // --------------------------------------------------------------------------
  // Data Loading & Caching
  // --------------------------------------------------------------------------

  async function loadApplications(forceRefresh = false) {
    const token = getStoredToken();
    if (!token) {
      showLogin();
      return;
    }

    const now = Date.now();
    if (!forceRefresh && applicationsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      applications = [...applicationsCache];
      populateDistrictDropdown(applications);
      renderCategoryDropdownOptions();
      renderApplications();
      updateStats();
      return;
    }

    renderLoadingState();

    try {
      const response = await window.RotaractLoopAPI.getApplications(token);
      if (response.success && Array.isArray(response.data)) {
        applications = response.data;
        applicationsCache = [...applications];
        cacheTimestamp = now;

        populateDistrictDropdown(applications);
        renderCategoryDropdownOptions();
        renderApplications();
        updateStats();
      } else {
        if (response.error && response.error.includes('Unauthorized')) {
          setStoredToken('');
          showLogin();
          showError('Session expired or unauthorized. Please sign in again.');
          return;
        }
        showTableError(response.error || 'Error loading directory members.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      showTableError('Could not load community members. Please check your connection.');
    }
  }

  function renderLoadingState() {
    if (applicationsTableBody) {
      applicationsTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="table-loading">
            <div class="loading-state">
              <div class="spinner-large"></div>
              <span>Fetching directory from Google Sheets...</span>
            </div>
          </td>
        </tr>
      `;
    }
    if (mobileCardsContainer) {
      mobileCardsContainer.innerHTML = `
        <div class="loading-state" style="padding: 40px 0;">
          <div class="spinner-large"></div>
          <span>Loading directory...</span>
        </div>
      `;
    }
  }

  function showTableError(msg) {
    if (applicationsTableBody) {
      applicationsTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--color-danger); padding: 32px;">${escapeHtml(msg)}</td></tr>`;
    }
    if (mobileCardsContainer) {
      mobileCardsContainer.innerHTML = `<div style="text-align: center; color: var(--color-danger); padding: 32px;">${escapeHtml(msg)}</div>`;
    }
  }

  // --------------------------------------------------------------------------
  // Filtering & Sorting
  // --------------------------------------------------------------------------

  function getFilteredApplications() {
    let filtered = [...applications];

    // Category filter
    if (selectedCategoryFilter) {
      filtered = filtered.filter(a => (a.business_category || '') === selectedCategoryFilter);
    }

    // District filter
    if (selectedDistrictFilter) {
      filtered = filtered.filter(a => String(a.district_number || '').trim() === selectedDistrictFilter);
    }

    // Keyword search
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
    if (query) {
      filtered = filtered.filter(a => {
        return (
          (a.business_name && a.business_name.toLowerCase().includes(query)) ||
          (a.rotaractor_name && a.rotaractor_name.toLowerCase().includes(query)) ||
          (a.rotaract_club && a.rotaract_club.toLowerCase().includes(query)) ||
          (a.district_number && String(a.district_number).toLowerCase().includes(query)) ||
          (a.whatsapp_number && a.whatsapp_number.toLowerCase().includes(query)) ||
          (a.place_of_operation && a.place_of_operation.toLowerCase().includes(query)) ||
          (a.business_category && a.business_category.toLowerCase().includes(query)) ||
          (a.business_description && a.business_description.toLowerCase().includes(query))
        );
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let valA, valB;
      if (currentSort.column === 'business_name') {
        valA = (a.business_name || '').toLowerCase();
        valB = (b.business_name || '').toLowerCase();
      } else if (currentSort.column === 'rotaractor' || currentSort.column === 'founder') {
        valA = (a.rotaractor_name || '').toLowerCase();
        valB = (b.rotaractor_name || '').toLowerCase();
      } else if (currentSort.column === 'category') {
        valA = (a.business_category || '').toLowerCase();
        valB = (b.business_category || '').toLowerCase();
      } else if (currentSort.column === 'district') {
        valA = String(a.district_number || '');
        valB = String(b.district_number || '');
      } else {
        // Date (Standardized IST comparison)
        valA = parseDateForSort(a.createdAt || a.timestamp);
        valB = parseDateForSort(b.createdAt || b.timestamp);
      }

      if (valA < valB) return currentSort.order === 'asc' ? -1 : 1;
      if (valA > valB) return currentSort.order === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function formatWhatsAppUrl(num) {
    if (!num) return '#';
    const cleaned = String(num).replace(/[^0-9]/g, '');
    return `https://wa.me/${cleaned}`;
  }

  function formatWebUrl(url) {
    if (!url) return '#';
    let clean = String(url).trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    return clean;
  }

  function renderApplications() {
    const filtered = getFilteredApplications();

    if (resultsCount) {
      resultsCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'entrepreneur' : 'entrepreneurs'}`;
    }

    if (filtered.length === 0) {
      const emptyHtml = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 48px; color: var(--color-text-muted);">
            No entrepreneurs match the selected filters.
          </td>
        </tr>
      `;
      if (applicationsTableBody) applicationsTableBody.innerHTML = emptyHtml;
      if (mobileCardsContainer) mobileCardsContainer.innerHTML = '<div style="text-align: center; padding: 32px; color: var(--color-text-muted);">No entrepreneurs found.</div>';
      return;
    }

    // Desktop Table
    if (applicationsTableBody) {
      applicationsTableBody.innerHTML = filtered.map(app => {
        const isExpanded = expandedRows.has(app.id);
        const registeredDate = formatIST(app.createdAt);
        const categoryLabel = app.business_category === 'Other' && app.business_category_other
          ? `Other (${app.business_category_other})`
          : (app.business_category || 'N/A');

        const detailRow = isExpanded ? `
          <tr class="detail-row">
            <td colspan="8">
              <div class="detail-container">
                <!-- Business Overview -->
                <div class="detail-section">
                  <h3>Business Overview</h3>
                  <div class="detail-grid">
                    <div class="detail-item">
                      <label>Category</label>
                      <div>${escapeHtml(categoryLabel)}</div>
                    </div>
                    <div class="detail-item">
                      <label>Place of Operation</label>
                      <div>${escapeHtml(app.place_of_operation || 'N/A')}</div>
                    </div>
                    <div class="detail-item detail-item--full">
                      <label>Description &amp; Offerings</label>
                      <div class="detail-description">${escapeHtml(app.business_description || 'No description provided')}</div>
                    </div>
                  </div>
                </div>

                <!-- Rotaractor Member Details -->
                <div class="detail-section">
                  <h3>Rotaractor Member Details</h3>
                  <div class="detail-grid">
                    <div class="detail-item">
                      <label>Rotaractor Name</label>
                      <div>${escapeHtml(app.rotaractor_name || 'N/A')}</div>
                    </div>
                    <div class="detail-item">
                      <label>Rotaract Club</label>
                      <div>${escapeHtml(app.rotaract_club || 'N/A')}</div>
                    </div>
                    <div class="detail-item">
                      <label>District Number</label>
                      <div>${escapeHtml(app.district_number ? `District ${app.district_number}` : 'N/A')}</div>
                    </div>
                    <div class="detail-item">
                      <label>Reference ID</label>
                      <div style="font-family: monospace; font-size: 13px; font-weight: 700; color: var(--color-primary);">${escapeHtml(app.id || 'N/A')}</div>
                    </div>
                  </div>
                </div>

                <!-- Quick Actions & Networking -->
                <div class="detail-section">
                  <h3>Direct Contact &amp; Networking</h3>
                  <div class="detail-quick-actions">
                    ${app.whatsapp_number ? `
                      <a href="${escapeHtml(formatWhatsAppUrl(app.whatsapp_number))}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp">
                        <span>💬 Message on WhatsApp</span>
                      </a>
                    ` : ''}
                    ${app.website_or_social ? `
                      <a href="${escapeHtml(formatWebUrl(app.website_or_social))}" target="_blank" rel="noopener noreferrer" class="btn-link-action">
                        <span>🔗 Open Website / Profile</span>
                      </a>
                    ` : ''}
                  </div>
                  <div style="margin-top: 14px; font-size: 12px; color: var(--color-text-muted);">
                    Registered in Community: ${formatISTFull(app.createdAt)}
                  </div>
                </div>
              </div>
            </td>
          </tr>
        ` : '';

        return `
          <tr class="application-row ${isExpanded ? 'expanded' : ''}" onclick="window.toggleRow('${app.id}')">
            <td><strong>${escapeHtml(app.business_name || 'N/A')}</strong></td>
            <td>${escapeHtml(app.rotaractor_name || 'N/A')}</td>
            <td>${escapeHtml(categoryLabel)}</td>
            <td>${escapeHtml(app.district_number ? `Dist. ${app.district_number}` : '')} ${app.rotaract_club ? `• ${escapeHtml(app.rotaract_club)}` : ''}</td>
            <td>${escapeHtml(app.place_of_operation || 'N/A')}</td>
            <td>
              ${app.whatsapp_number ? `
                <a href="${escapeHtml(formatWhatsAppUrl(app.whatsapp_number))}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" style="color: #059669; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                  <span>💬 ${escapeHtml(app.whatsapp_number)}</span>
                </a>
              ` : 'N/A'}
            </td>
            <td>${registeredDate}</td>
            <td style="text-align: center;">
              <button type="button" class="btn-icon" style="width: 32px; height: 32px;" onclick="event.stopPropagation(); window.toggleRow('${app.id}');" title="${isExpanded ? 'Collapse' : 'View Details'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="${isExpanded ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}"/>
                </svg>
              </button>
            </td>
          </tr>
          ${detailRow}
        `;
      }).join('');
    }

    // Mobile Cards
    if (mobileCardsContainer) {
      mobileCardsContainer.innerHTML = filtered.map(app => {
        const isExpanded = expandedRows.has(app.id);
        const registeredDate = formatIST(app.createdAt);
        const categoryLabel = app.business_category === 'Other' && app.business_category_other
          ? `Other (${app.business_category_other})`
          : (app.business_category || 'N/A');

        return `
          <div class="mobile-card" onclick="window.toggleRow('${app.id}')">
            <div class="mobile-card__header">
              <div>
                <div class="mobile-card__title">${escapeHtml(app.business_name || 'N/A')}</div>
                <div style="font-size: 12px; color: var(--color-text-muted);">${escapeHtml(categoryLabel)}</div>
              </div>
              <div style="font-size: 12px; font-weight: 700; color: var(--color-primary);">
                ${escapeHtml(app.district_number ? `Dist. ${app.district_number}` : '')}
              </div>
            </div>

            <div class="mobile-card__info">
              <div>
                <div class="mobile-card__info-label">Rotaractor</div>
                <div class="mobile-card__info-value">${escapeHtml(app.rotaractor_name || 'N/A')}</div>
              </div>
              <div>
                <div class="mobile-card__info-label">Club</div>
                <div class="mobile-card__info-value">${escapeHtml(app.rotaract_club || 'N/A')}</div>
              </div>
              <div>
                <div class="mobile-card__info-label">Location</div>
                <div class="mobile-card__info-value">${escapeHtml(app.place_of_operation || 'N/A')}</div>
              </div>
              <div>
                <div class="mobile-card__info-label">WhatsApp</div>
                <div class="mobile-card__info-value">
                  ${app.whatsapp_number ? `<a href="${escapeHtml(formatWhatsAppUrl(app.whatsapp_number))}" target="_blank" onclick="event.stopPropagation();" style="color: #059669; font-weight: 600;">${escapeHtml(app.whatsapp_number)}</a>` : 'N/A'}
                </div>
              </div>
            </div>

            ${isExpanded ? `
              <div style="padding-top: 14px; border-top: 1px solid var(--color-border); margin-top: 12px;">
                <div style="font-size: 12px; font-weight: 700; color: var(--color-text-muted); margin-bottom: 4px;">About Business:</div>
                <p style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; margin: 0 0 14px;">${escapeHtml(app.business_description || 'No description provided')}</p>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  ${app.whatsapp_number ? `
                    <a href="${escapeHtml(formatWhatsAppUrl(app.whatsapp_number))}" target="_blank" onclick="event.stopPropagation();" class="btn-whatsapp" style="padding: 7px 12px; font-size: 12px;">
                      <span>💬 WhatsApp</span>
                    </a>
                  ` : ''}
                  ${app.website_or_social ? `
                    <a href="${escapeHtml(formatWebUrl(app.website_or_social))}" target="_blank" onclick="event.stopPropagation();" class="btn-link-action" style="padding: 7px 12px; font-size: 12px;">
                      <span>🔗 Website / Link</span>
                    </a>
                  ` : ''}
                </div>
                <div style="margin-top: 10px; font-size: 11px; color: var(--color-text-muted);">
                  Registered: ${registeredDate}
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }
  }

  // Row Expand/Collapse
  window.toggleRow = function(id) {
    if (expandedRows.has(id)) {
      expandedRows.delete(id);
    } else {
      expandedRows.add(id);
    }
    renderApplications();
  };

  // --------------------------------------------------------------------------
  // Directory Intelligence Stats & Category Breakdown
  // --------------------------------------------------------------------------

  function updateStats() {
    const total = applications.length;
    const categoryCounts = {};
    const districtSet = new Set();
    const clubSet = new Set();

    applications.forEach(a => {
      const cat = a.business_category || 'Other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      const dist = String(a.district_number || '').trim();
      if (dist) districtSet.add(dist);

      const club = String(a.rotaract_club || '').trim().toLowerCase();
      if (club) clubSet.add(club);
    });

    if (statTotal) statTotal.textContent = total;
    if (statCategories) statCategories.textContent = Object.keys(categoryCounts).length;
    if (statDistricts) statDistricts.textContent = districtSet.size;
    if (statClubs) statClubs.textContent = clubSet.size;

    renderCategoryPills(categoryCounts);
  }

  function renderCategoryPills(counts) {
    if (!categoryPillsContainer) return;

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    let html = `
      <div 
        class="category-pill ${!selectedCategoryFilter ? 'category-pill--active' : ''}" 
        onclick="window.selectCategoryPill('')"
      >
        <span class="category-pill__name">All Categories</span>
        <span class="category-pill__count">${applications.length}</span>
      </div>
    `;

    sorted.forEach(([cat, count]) => {
      const isActive = selectedCategoryFilter === cat;
      html += `
        <div 
          class="category-pill ${isActive ? 'category-pill--active' : ''}" 
          onclick="window.selectCategoryPill('${escapeHtml(cat)}')"
        >
          <span class="category-pill__name">${escapeHtml(cat)}</span>
          <span class="category-pill__count">${count}</span>
        </div>
      `;
    });

    categoryPillsContainer.innerHTML = html;
  }

  window.selectCategoryPill = function(cat) {
    selectedCategoryFilter = (selectedCategoryFilter === cat) ? '' : cat;
    if (categoryFilter) {
      categoryFilter.value = selectedCategoryFilter;
    }
    if (categoryDropdownLabel) {
      categoryDropdownLabel.textContent = selectedCategoryFilter ? selectedCategoryFilter : 'All Categories (25)';
    }
    renderCategoryDropdownOptions();
    renderApplications();
    updateStats();
  };

  // --------------------------------------------------------------------------
  // Data Exports: Excel Workbook & CSV
  // --------------------------------------------------------------------------

  function getExportRows() {
    const filtered = getFilteredApplications();
    return filtered.map(a => [
      a.id || '',
      formatISTFull(a.createdAt),
      a.rotaractor_name || '',
      a.rotaract_club || '',
      a.district_number ? `District ${a.district_number}` : '',
      a.business_name || '',
      a.business_category || '',
      a.business_category_other || '',
      a.business_description || '',
      a.place_of_operation || '',
      a.whatsapp_number || '',
      a.website_or_social || ''
    ]);
  }

  const EXPORT_HEADERS = [
    'Submission ID',
    'Registered At (IST)',
    'Rotaractor Name',
    'Rotaract Club',
    'District',
    'Business Name',
    'Business Category',
    'Category (Other)',
    'Business Description',
    'Primary Place of Operation',
    'WhatsApp Number',
    'Website or Social Link'
  ];

  // 1. Export to Excel (.xls XML SpreadsheetML format)
  function exportToExcel() {
    const rows = getExportRows();
    if (rows.length === 0) {
      alert('No community members available to export.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Rotaract Loop Community Directory</Title>
  <Author>Rotaract Loop Admin</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#1E293B"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F172A"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1E3A8A" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataCell">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="IdCell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Consolas" ss:Size="10" ss:Color="#1E3A8A" ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Entrepreneurs Directory">
  <Table>
   <Column ss:Width="130"/>
   <Column ss:Width="140"/>
   <Column ss:Width="140"/>
   <Column ss:Width="160"/>
   <Column ss:Width="100"/>
   <Column ss:Width="170"/>
   <Column ss:Width="160"/>
   <Column ss:Width="130"/>
   <Column ss:Width="280"/>
   <Column ss:Width="150"/>
   <Column ss:Width="130"/>
   <Column ss:Width="200"/>
   <Row ss:Height="26">
`;

    EXPORT_HEADERS.forEach(h => {
      xml += `    <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>\n`;
    });
    xml += `   </Row>\n`;

    rows.forEach(r => {
      xml += `   <Row ss:Height="22">\n`;
      r.forEach((val, idx) => {
        const style = (idx === 0) ? 'IdCell' : 'DataCell';
        xml += `    <Cell ss:StyleID="${style}"><Data ss:Type="String">${escapeXml(String(val))}</Data></Cell>\n`;
      });
      xml += `   </Row>\n`;
    });

    xml += `  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    downloadBlob(blob, `rotaract-loop-directory-${todayStr}.xls`);
  }

  // 2. Export to CSV (RFC-4180 with UTF-8 BOM)
  function exportToCSV() {
    const rows = getExportRows();
    if (rows.length === 0) {
      alert('No community members available to export.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const BOM = '\uFEFF';

    const csvBody = [EXPORT_HEADERS, ...rows].map(row =>
      row.map(cell => {
        const val = String(cell || '').replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ');
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',')
    ).join('\r\n');

    const blob = new Blob([BOM + csvBody], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `rotaract-loop-directory-${todayStr}.csv`);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // --------------------------------------------------------------------------
  // Event Listeners
  // --------------------------------------------------------------------------

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderApplications();
      if (clearSearchBtn) {
        clearSearchBtn.classList.toggle('hidden', !searchInput.value.trim());
      }
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      renderApplications();
    });
  }

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      selectedCategoryFilter = '';
      selectedDistrictFilter = '';
      if (categoryFilter) categoryFilter.value = '';
      if (districtFilter) districtFilter.value = '';
      if (categoryDropdownLabel) categoryDropdownLabel.textContent = 'All Categories (25)';
      if (districtDropdownLabel) districtDropdownLabel.textContent = 'All Districts';
      if (searchInput) searchInput.value = '';
      if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
      closeAllDropdowns();
      renderCategoryDropdownOptions();
      renderDistrictDropdownOptions();
      renderApplications();
      updateStats();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.classList.add('spinning');
      loadApplications(true);
      setTimeout(() => refreshBtn.classList.remove('spinning'), 800);
    });
  }

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', exportToExcel);
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportToCSV);
  }

  // Sorting
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sortCol = btn.dataset.sort;
      if (currentSort.column === sortCol) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.column = sortCol;
        currentSort.order = 'asc';
      }
      renderApplications();
    });
  });

  // Init
  renderCategoryDropdownOptions();
  checkAuth();

})();
