/* Roles Page - Load and display roles from JSON */
(function() {
  const rolesGrid = document.getElementById('rolesGrid');

  // Load roles from JSON
  async function loadRoles() {
    try {
      const response = await fetch('roles.json');
      if (!response.ok) {
        throw new Error('Failed to load roles');
      }
      const data = await response.json();
      displayRoles(data.roles);
    } catch (error) {
      console.error('Error loading roles:', error);
      rolesGrid.innerHTML = `
        <div class="error-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>Failed to load roles. Please try again later.</p>
        </div>
      `;
    }
  }

  // Display roles
  function displayRoles(roles) {
    if (!roles || roles.length === 0) {
      rolesGrid.innerHTML = `
        <div class="empty-state">
          <p>No roles available at this time.</p>
        </div>
      `;
      return;
    }

    rolesGrid.innerHTML = roles.map(role => createRoleCard(role)).join('');
  }

  // Create role card HTML
  function createRoleCard(role) {
    const descriptionList = role.description
      .map(item => `<li>${escapeHtml(item)}</li>`)
      .join('');

    return `
      <article class="role-card" id="role-${role.id}">
        <div class="role-card__header">
          <h2 class="role-card__title">${escapeHtml(role.title)}</h2>
        </div>
        <div class="role-card__body">
          <ul class="role-card__list">
            ${descriptionList}
          </ul>
        </div>
        <div class="role-card__footer">
          <a href="/" class="btn btn--outline btn--small">
            Nominate Now
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; margin-left: 6px;">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
        </div>
      </article>
    `;
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize
  loadRoles();
})();

