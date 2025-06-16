console.log('Igloo Environment Manager is running')

// Environment Variable Manager with Event Log - Igloo Desktop Style
class EnvManager {
  constructor() {
    this.envData = {};
    this.logs = [];
    this.sensitiveKeys = ['GROUP_CRED', 'SHARE_CRED', 'PASSWORD', 'SECRET', 'KEY', 'TOKEN'];
    this.currentEditingKey = null;
    this.eventLogExpanded = false;
    
    // Essential environment variables for Igloo
    this.essentialVars = [
      { 
        key: 'GROUP_CRED', 
        label: 'Group Credential',
        placeholder: 'Enter your group credential (bfgroup...)',
        description: 'This is your group data that contains the public information about your keyset, including the threshold and group public key. It starts with "bfgroup" and is shared among all signers.',
        sensitive: true
      },
      { 
        key: 'SHARE_CRED', 
        label: 'Share Credential', 
        placeholder: 'Enter your secret share (bfshare...)',
        description: 'This is an individual secret share of the private key. Your keyset is split into shares and this is one of them. It starts with "bfshare" and should be kept private and secure.',
        sensitive: true
      }
    ];
    
    this.initializeElements();
    this.bindEvents();
    this.loadEnvironmentVariables();
    this.addLog('info', 'Environment manager initialized');
  }

  initializeElements() {
    // Status elements
    this.statusDot = document.getElementById('statusDot');
    this.statusText = document.getElementById('statusText');
    
    // Main content elements
    this.envList = document.getElementById('envList');
    this.noVars = document.getElementById('noVars');
    this.envSection = document.getElementById('envSection');
    
    // Modal elements
    this.envModal = document.getElementById('envModal');
    this.deleteModal = document.getElementById('deleteModal');
    this.modalTitle = document.getElementById('modalTitle');
    this.envForm = document.getElementById('envForm');
    this.envKey = document.getElementById('envKey');
    this.envValue = document.getElementById('envValue');
    
    // Button elements
    this.addVarBtn = document.getElementById('addVarBtn');
    this.basicTemplateBtn = document.getElementById('basicTemplateBtn');
    this.fullTemplateBtn = document.getElementById('fullTemplateBtn');
    
    // Modal control buttons
    this.closeModal = document.getElementById('closeModal');
    this.cancelBtn = document.getElementById('cancelBtn');
    this.closeDeleteModal = document.getElementById('closeDeleteModal');
    this.cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    this.confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    this.deleteVarName = document.getElementById('deleteVarName');
    
    // Event log elements
    this.eventLogHeader = document.getElementById('eventLogHeader');
    this.eventLogContent = document.getElementById('eventLogContent');
    this.eventLogChevron = document.getElementById('eventLogChevron');
    this.eventLogCount = document.getElementById('eventLogCount');
    this.eventLogEntries = document.getElementById('eventLogEntries');
    this.clearLogsBtn = document.getElementById('clearLogsBtn');
    this.eventLogStatus = document.getElementById('eventLogStatus');
  }

  bindEvents() {
    // Main buttons
    this.addVarBtn.addEventListener('click', () => this.showAddModal());
    this.basicTemplateBtn.addEventListener('click', () => this.applyBasicTemplate());
    this.fullTemplateBtn.addEventListener('click', () => this.applyFullTemplate());
    
    // Modal events
    this.closeModal.addEventListener('click', () => this.hideModal());
    this.cancelBtn.addEventListener('click', () => this.hideModal());
    this.closeDeleteModal.addEventListener('click', () => this.hideDeleteModal());
    this.cancelDeleteBtn.addEventListener('click', () => this.hideDeleteModal());
    this.confirmDeleteBtn.addEventListener('click', () => this.confirmDelete());
    
    // Form submission
    this.envForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    
    // Click outside modal to close
    this.envModal.addEventListener('click', (e) => {
      if (e.target === this.envModal) this.hideModal();
    });
    this.deleteModal.addEventListener('click', (e) => {
      if (e.target === this.deleteModal) this.hideDeleteModal();
    });
    
    // Input validation
    this.envKey.addEventListener('input', () => this.validateKeyInput());
    
    // Event log events
    this.eventLogHeader.addEventListener('click', () => this.toggleEventLog());
    this.clearLogsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearLogs();
    });
    
    // Back to shares button (placeholder)
    const backBtn = document.getElementById('backToShares');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.addLog('info', 'Navigating back to shares (placeholder)');
        // This would navigate back to the main app
      });
    }
  }

  validateKeyInput() {
    const key = this.envKey.value.toUpperCase();
    this.envKey.value = key.replace(/[^A-Z0-9_]/g, '');
  }

  updateStatus(type, message) {
    this.statusDot.className = `w-3 h-3 rounded-full status-dot ${type}`;
    this.statusText.textContent = message;
    
    // Update event log status
    if (this.eventLogStatus) {
      this.eventLogStatus.className = `w-2 h-2 rounded-full ${
        type === 'connected' ? 'bg-green-500' : 
        type === 'loading' ? 'bg-yellow-500' : 
        'bg-red-500'
      }`;
    }
  }

  addLog(type, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const id = Math.random().toString(36).substr(2, 9);
    
    const logEntry = {
      id,
      timestamp,
      type,
      message,
      data
    };
    
    this.logs.push(logEntry);
    
    // Keep only last 100 logs for performance
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }
    
    this.updateEventLogDisplay();
  }

  updateEventLogDisplay() {
    if (!this.eventLogCount || !this.eventLogEntries) return;
    
    // Update count
    this.eventLogCount.textContent = `${this.logs.length} event${this.logs.length !== 1 ? 's' : ''}`;
    
    // Update entries if expanded
    if (this.eventLogExpanded) {
      this.renderEventLogEntries();
    }
  }

  renderEventLogEntries() {
    if (!this.eventLogEntries) return;
    
    if (this.logs.length === 0) {
      this.eventLogEntries.innerHTML = '<div class="text-center text-gray-500 text-sm py-8">No logs available</div>';
      return;
    }
    
    const entriesHtml = this.logs.slice(-50).reverse().map(log => this.createLogEntryHtml(log)).join('');
    this.eventLogEntries.innerHTML = entriesHtml;
    
    // Add click handlers for expandable log entries
    this.eventLogEntries.querySelectorAll('.log-entry-expandable').forEach((entry, index) => {
      const detailsDiv = entry.querySelector('.log-details');
      entry.addEventListener('click', () => {
        const isExpanded = detailsDiv.style.maxHeight && detailsDiv.style.maxHeight !== '0px';
        
        if (isExpanded) {
          detailsDiv.style.maxHeight = '0px';
          detailsDiv.style.opacity = '0';
          entry.querySelector('.log-chevron').style.transform = 'rotate(0deg)';
        } else {
          detailsDiv.style.maxHeight = '500px';
          detailsDiv.style.opacity = '1';
          entry.querySelector('.log-chevron').style.transform = 'rotate(90deg)';
        }
      });
    });
    
    // Scroll to top of log entries
    this.eventLogEntries.scrollTop = 0;
  }

  createLogEntryHtml(log) {
    const hasData = log.data && Object.keys(log.data).length > 0;
    const badgeClass = this.getLogBadgeClass(log.type);
    
    return `
      <div class="mb-2 last:mb-0 bg-gray-800/40 p-2 rounded hover:bg-gray-800/50 transition-colors ${hasData ? 'log-entry-expandable cursor-pointer' : ''}">
        <div class="flex items-center gap-2">
          ${hasData ? `
            <div class="text-blue-400 transition-transform duration-200 w-4 h-4 flex-shrink-0 log-chevron" style="transform: rotate(0deg);">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </div>
          ` : `
            <div class="w-4 h-4 flex-shrink-0 text-gray-600/30">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
          `}
          <span class="text-gray-500 text-xs font-light font-sharetech">${log.timestamp}</span>
          <span class="badge ${badgeClass}">${log.type.toUpperCase()}</span>
          <span class="text-gray-300 font-sharetech">${this.escapeHtml(log.message)}</span>
        </div>
        ${hasData ? `
          <div class="log-details transition-all duration-200 ease-in-out overflow-hidden" style="max-height: 0px; opacity: 0;">
            <pre class="mt-2 text-xs bg-gray-900/50 p-2 rounded overflow-x-auto text-gray-400 shadow-inner font-sharetech">${this.escapeHtml(JSON.stringify(log.data, null, 2))}</pre>
          </div>
        ` : ''}
      </div>
    `;
  }

  getLogBadgeClass(type) {
    switch(type) {
      case 'error': return 'error';
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  }

  toggleEventLog() {
    this.eventLogExpanded = !this.eventLogExpanded;
    
    if (this.eventLogExpanded) {
      this.eventLogContent.style.maxHeight = '300px';
      this.eventLogContent.style.opacity = '1';
      this.eventLogChevron.style.transform = 'rotate(180deg)';
      this.renderEventLogEntries();
      this.addLog('info', 'Event log expanded');
    } else {
      this.eventLogContent.style.maxHeight = '0';
      this.eventLogContent.style.opacity = '0';
      this.eventLogChevron.style.transform = 'rotate(0deg)';
      this.addLog('info', 'Event log collapsed');
    }
  }

  clearLogs() {
    this.logs = [];
    this.updateEventLogDisplay();
    this.addLog('info', 'Event logs cleared');
  }

  async loadEnvironmentVariables() {
    this.updateStatus('loading', 'Loading environment variables...');
    this.addLog('info', 'Loading environment variables from server');
    
    try {
      const response = await fetch('/api/env');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      this.envData = await response.json();
      this.renderEnvironmentVariables();
      
      const count = Object.keys(this.envData).length;
      this.updateStatus('connected', `Loaded ${count} environment variable${count !== 1 ? 's' : ''}`);
      this.addLog('success', `Successfully loaded ${count} environment variables`);
    } catch (error) {
      console.error('Failed to load environment variables:', error);
      this.updateStatus('error', 'Failed to load environment variables');
      this.addLog('error', 'Failed to load environment variables', { error: error.message });
      this.renderEnvironmentVariables(); // Show empty state
    }
  }

  renderEnvironmentVariables() {
    if (!this.envList) return;
    
    const keys = Object.keys(this.envData);
    
    if (keys.length === 0) {
      this.envList.style.display = 'none';
      this.noVars.style.display = 'block';
      return;
    }
    
    this.envList.style.display = 'block';
    this.noVars.style.display = 'none';
    
    // Create essential environment variables UI (similar to Signer component)
    const essentialHtml = this.essentialVars.map(varConfig => this.createEssentialVarHtml(varConfig)).join('');
    
    // Get other environment variables
    const otherKeys = keys.filter(key => !this.essentialVars.some(ev => ev.key === key));
    const otherVarsHtml = otherKeys.length > 0 ? `
      <div class="mt-6 space-y-3">
        <h4 class="text-blue-300 text-sm font-medium font-sharetech">Additional Variables</h4>
        ${otherKeys.map(key => this.createEnvItem(key)).join('')}
      </div>
    ` : '';
    
    this.envList.innerHTML = essentialHtml + otherVarsHtml;
    
    // Bind events to the new elements
    this.bindItemEvents();
  }

  createEssentialVarHtml(varConfig) {
    const value = this.envData[varConfig.key] || '';
    const hasValue = value.trim() !== '';
    const isValid = this.validateEssentialVar(varConfig.key, value);
    
    return `
      <div class="space-y-3 mb-6">
        <div class="flex items-center">
          <label class="text-blue-300 text-sm font-medium font-sharetech">${varConfig.label}:</label>
          <div class="ml-2 text-blue-400 cursor-pointer" title="${varConfig.description}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        </div>
        <div class="flex">
          <input
            type="${varConfig.sensitive ? 'password' : 'text'}"
            value="${this.escapeHtml(value)}"
            placeholder="${varConfig.placeholder}"
            class="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm w-full font-mono form-input essential-var-input ${isValid ? 'border-green-500/30' : hasValue ? 'border-red-500/30' : ''}"
            data-key="${varConfig.key}"
            ${!hasValue ? '' : 'readonly'}
          />
          <button
            class="ml-2 copy-btn"
            data-key="${varConfig.key}"
            title="Copy value"
            ${!hasValue ? 'disabled' : ''}
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
          </button>
        </div>
        ${hasValue && !isValid ? `
          <div class="text-red-400 text-xs font-sharetech">
            Invalid format. Expected ${varConfig.key === 'GROUP_CRED' ? 'bfgroup...' : 'bfshare...'}
          </div>
        ` : ''}
      </div>
    `;
  }

  validateEssentialVar(key, value) {
    if (!value.trim()) return false;
    
    if (key === 'GROUP_CRED') {
      return value.startsWith('bfgroup');
    } else if (key === 'SHARE_CRED') {
      return value.startsWith('bfshare');
    }
    
    return true;
  }

  createEnvItem(key) {
    const value = this.envData[key];
    const isSensitive = this.isSensitiveKey(key);
    const displayValue = isSensitive ? '••••••••••••••••' : (value || '(empty)');
    
    return `
      <div class="env-item ${isSensitive ? 'sensitive' : ''}" data-key="${key}">
        <div class="env-info">
          <div class="env-key">${key}</div>
          <div class="env-value ${isSensitive ? 'hidden' : ''}" data-key="${key}">
            ${this.escapeHtml(displayValue)}
          </div>
        </div>
        <div class="env-actions">
          <button class="copy-btn" data-key="${key}" title="Copy value">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
          </button>
          <button class="btn-secondary btn-small edit-btn" data-key="${key}">Edit</button>
          <button class="btn-danger btn-small delete-btn" data-key="${key}">Delete</button>
        </div>
      </div>
    `;
  }

  bindItemEvents() {
    // Essential variable inputs - similar to Signer component interaction
    document.querySelectorAll('.essential-var-input').forEach(input => {
      const key = input.dataset.key;
      
      // Double click to edit
      input.addEventListener('dblclick', () => {
        input.readOnly = false;
        input.focus();
        this.addLog('info', `Editing ${key} in place`);
      });
      
      // Save on blur or enter
      const saveValue = async () => {
        const newValue = input.value.trim();
        if (newValue !== (this.envData[key] || '')) {
          await this.saveEnvironmentVariable(key, newValue);
          this.renderEnvironmentVariables(); // Re-render to update validation
        }
        input.readOnly = true;
      };
      
      input.addEventListener('blur', saveValue);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveValue();
        } else if (e.key === 'Escape') {
          input.value = this.envData[key] || '';
          input.readOnly = true;
        }
      });
    });
    
    // Edit buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = e.target.dataset.key;
        this.showEditModal(key);
      });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = e.target.dataset.key;
        this.showDeleteModal(key);
      });
    });
    
    // Copy buttons - improved feedback like Signer component
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const key = e.target.closest('[data-key]').dataset.key;
        await this.handleCopy(this.envData[key] || '', key, btn);
      });
    });
    
    // Click to reveal sensitive values
    document.querySelectorAll('.env-value.hidden').forEach(el => {
      el.addEventListener('click', () => {
        const key = el.dataset.key;
        const value = this.envData[key] || '(empty)';
        el.textContent = this.escapeHtml(value);
        el.classList.remove('hidden');
        this.addLog('info', `Revealed sensitive value for ${key}`);
        setTimeout(() => {
          el.textContent = '••••••••••••••••';
          el.classList.add('hidden');
        }, 3000);
      });
    });
  }

  async saveEnvironmentVariable(key, value) {
    try {
      this.addLog('info', `Saving environment variable: ${key}`);
      
      const response = await fetch('/api/env', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [key]: value }),
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      if (result.success) {
        this.envData[key] = value;
        this.addLog('success', `Successfully saved ${key}`);
        
        // Update copy button state
        const copyBtn = document.querySelector(`[data-key="${key}"] .copy-btn`);
        if (copyBtn) {
          copyBtn.disabled = !value.trim();
        }
        
        // Update count in status
        const count = Object.keys(this.envData).length;
        this.updateStatus('connected', `${count} environment variable${count !== 1 ? 's' : ''} configured`);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Failed to save environment variable:', error);
      this.addLog('error', 'Failed to save environment variable', { key, error: error.message });
      alert('Failed to save environment variable: ' + error.message);
    }
  }

  async handleCopy(text, key, buttonEl) {
    try {
      await navigator.clipboard.writeText(text);
      
      // Visual feedback matching Signer component
      const originalClass = buttonEl.className;
      const originalHTML = buttonEl.innerHTML;
      
      buttonEl.classList.add('success');
      buttonEl.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
      `;
      
      this.addLog('success', `Copied ${key} to clipboard`);
      
      setTimeout(() => {
        buttonEl.className = originalClass;
        buttonEl.innerHTML = originalHTML;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      this.addLog('error', `Failed to copy ${key}`, { error: err.message });
    }
  }

  isSensitiveKey(key) {
    return this.sensitiveKeys.some(sensitive => 
      key.toUpperCase().includes(sensitive.toUpperCase())
    );
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showAddModal() {
    this.currentEditingKey = null;
    this.modalTitle.textContent = 'Add Environment Variable';
    this.envKey.value = '';
    this.envValue.value = '';
    this.envKey.disabled = false;
    this.showModal();
    this.addLog('info', 'Add variable modal opened');
  }

  showEditModal(key) {
    this.currentEditingKey = key;
    this.modalTitle.textContent = 'Edit Environment Variable';
    this.envKey.value = key;
    this.envValue.value = this.envData[key] || '';
    this.envKey.disabled = true;
    this.showModal();
    this.addLog('info', `Edit modal opened for ${key}`);
  }

  showModal() {
    this.envModal.classList.add('show');
    this.envKey.focus();
  }

  hideModal() {
    this.envModal.classList.remove('show');
  }

  showDeleteModal(key) {
    this.currentEditingKey = key;
    this.deleteVarName.textContent = key;
    this.deleteModal.classList.add('show');
    this.addLog('warning', `Delete confirmation for ${key}`);
  }

  hideDeleteModal() {
    this.deleteModal.classList.remove('show');
  }

  async handleFormSubmit(e) {
    e.preventDefault();
    
    const key = this.envKey.value.trim();
    const value = this.envValue.value.trim();
    
    if (!key) {
      alert('Please enter a variable name');
      this.addLog('error', 'Form submission failed: empty variable name');
      return;
    }
    
    // Validate key format
    if (!/^[A-Z0-9_]+$/.test(key)) {
      alert('Variable name must contain only uppercase letters, numbers, and underscores');
      this.addLog('error', 'Form submission failed: invalid variable name format', { key });
      return;
    }
    
    await this.saveEnvironmentVariable(key, value);
    this.renderEnvironmentVariables();
    this.hideModal();
  }

  async confirmDelete() {
    if (!this.currentEditingKey) return;
    
    try {
      this.addLog('info', `Deleting environment variable: ${this.currentEditingKey}`);
      
      const response = await fetch('/api/env/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keys: [this.currentEditingKey] }),
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      if (result.success) {
        delete this.envData[this.currentEditingKey];
        this.renderEnvironmentVariables();
        this.hideDeleteModal();
        
        const count = Object.keys(this.envData).length;
        this.updateStatus('connected', `${count} environment variable${count !== 1 ? 's' : ''} configured`);
        this.addLog('success', `Successfully deleted ${this.currentEditingKey}`);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Failed to delete environment variable:', error);
      this.addLog('error', 'Failed to delete environment variable', { key: this.currentEditingKey, error: error.message });
      alert('Failed to delete environment variable: ' + error.message);
    }
  }

  async applyBasicTemplate() {
    const template = {
      'GROUP_CRED': '',
      'SHARE_CRED': '',
      'HOST_PORT': '8002'
    };
    
    await this.applyTemplate(template, 'Basic template applied');
  }

  async applyFullTemplate() {
    const template = {
      'GROUP_CRED': '',
      'SHARE_CRED': '',
      'HOST_NAME': 'localhost',
      'HOST_PORT': '8002',
      'RELAYS': 'wss://relay.damus.io,wss://relay.snort.social,wss://relay.nostr.bg'
    };
    
    await this.applyTemplate(template, 'Full template applied');
  }

  async applyTemplate(template, successMessage) {
    const confirmMessage = `This will add/update ${Object.keys(template).length} environment variables. Continue?`;
    if (!confirm(confirmMessage)) {
      this.addLog('info', 'Template application cancelled by user');
      return;
    }
    
    try {
      this.addLog('info', `Applying template with ${Object.keys(template).length} variables`);
      
      const response = await fetch('/api/env', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(template),
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      if (result.success) {
        Object.assign(this.envData, template);
        this.renderEnvironmentVariables();
        
        const count = Object.keys(this.envData).length;
        this.updateStatus('connected', `${count} environment variable${count !== 1 ? 's' : ''} configured`);
        this.addLog('success', successMessage, { variables: Object.keys(template) });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Failed to apply template:', error);
      this.addLog('error', 'Failed to apply template', { error: error.message });
      alert('Failed to apply template: ' + error.message);
    }
  }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new EnvManager();
});
