// Application State
let currentView = 'main';
let currentTab = 'signer-tab';
let shares = [
    {
        id: 'abc123def456',
        name: 'Sample Share 1',
        savedAt: '2023-12-15T10:30:00Z'
    },
    {
        id: 'def456ghi789',
        name: 'Sample Share 2',
        savedAt: '2023-12-10T14:20:00Z'
    }
];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Set initial view
    showView('main-view');
    
    // Initialize tooltips
    initializeTooltips();
    
    // Update help tooltip visibility based on shares
    updateHelpTooltipVisibility();
});

// View Management
function showView(viewId) {
    // Hide all views
    const views = document.querySelectorAll('.view');
    views.forEach(view => {
        view.style.display = 'none';
    });
    
    // Show selected view
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.style.display = 'block';
        currentView = viewId;
    }
    
    // Update subtitle based on view
    updateSubtitle();
}

function updateSubtitle() {
    const subtitle = document.getElementById('app-subtitle');
    if (currentView === 'main-view') {
        subtitle.textContent = 'Frostr keyset manager and remote signer.';
        subtitle.style.display = 'block';
    } else {
        subtitle.style.display = 'none';
    }
}

// Navigation Functions
function showMainView() {
    showView('main-view');
}

function showCreateView() {
    showView('create-view');
}

function showKeysetView() {
    showView('keyset-view');
}

function showSignerView() {
    showView('signer-view');
    // Reset to signer tab when opening signer view
    switchTab('signer-tab');
}

function backToShares() {
    showView('main-view');
}

function finishKeyset() {
    showView('main-view');
}

// Tab Management
function switchTab(tabId) {
    // Remove active class from all tab triggers
    const tabTriggers = document.querySelectorAll('.tab-trigger');
    tabTriggers.forEach(trigger => {
        trigger.classList.remove('active');
    });
    
    // Hide all tab content
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // Activate selected tab
    const activeTrigger = document.querySelector(`[data-tab="${tabId}"]`);
    const activeContent = document.getElementById(tabId);
    
    if (activeTrigger && activeContent) {
        activeTrigger.classList.add('active');
        activeContent.classList.add('active');
        currentTab = tabId;
    }
}

// Share Management
function loadShare(shareId) {
    const share = shares.find(s => s.id === shareId);
    if (share) {
        // In a real app, this would load the share and decrypt it
        console.log('Loading share:', share);
        
        // Simulate loading modal
        showModal('Load Share', `
            <div class="text-center py-4">
                <div class="animate-pulse text-gray-400 mb-4">Loading share...</div>
                <p class="text-sm text-gray-500">Enter your password to decrypt the share</p>
                <input type="password" placeholder="Password" class="w-full mt-4 p-2 bg-gray-800 border border-gray-600 rounded text-blue-200">
                <div class="flex gap-2 mt-4">
                    <button class="btn btn-primary flex-1" onclick="simulateLoadSuccess('${shareId}')">Load</button>
                    <button class="btn btn-ghost flex-1" onclick="closeModal()">Cancel</button>
                </div>
            </div>
        `);
    }
}

function simulateLoadSuccess(shareId) {
    closeModal();
    // Simulate successful load - go to signer view
    setTimeout(() => {
        showSignerView();
    }, 500);
}

function openLocation(shareId) {
    const share = shares.find(s => s.id === shareId);
    if (share) {
        // In a real app, this would open the file location
        console.log('Opening location for share:', share);
        alert(`Opening location for share: ${share.name}`);
    }
}

function deleteShare(shareId) {
    const share = shares.find(s => s.id === shareId);
    if (share) {
        showModal('Delete Share', `
            <div>
                <p class="mb-4">Are you sure you want to delete this share?</p>
                <p class="text-sm text-gray-400 mb-2">
                    Share name: <span class="text-blue-400">${share.name}</span>
                </p>
                <p class="text-sm text-gray-400 mb-4">
                    Share ID: <span class="text-blue-400 font-mono">${share.id}</span>
                </p>
                <div class="flex gap-2">
                    <button class="btn btn-primary flex-1" onclick="confirmDeleteShare('${shareId}')">Delete</button>
                    <button class="btn btn-ghost flex-1" onclick="closeModal()">Cancel</button>
                </div>
            </div>
        `);
    }
}

function confirmDeleteShare(shareId) {
    // Remove share from array
    shares = shares.filter(s => s.id !== shareId);
    
    // Update the UI
    updateShareList();
    closeModal();
    
    // Update help tooltip visibility
    updateHelpTooltipVisibility();
}

function updateShareList() {
    const shareListContainer = document.getElementById('share-list');
    const emptyState = shareListContainer.querySelector('.empty-state');
    
    if (shares.length === 0) {
        // Show empty state
        shareListContainer.innerHTML = `
            <div class="empty-state">
                <p class="empty-message">No shares available</p>
                <p class="empty-submessage">Get started by creating your first keyset</p>
                <button class="btn btn-primary" onclick="showCreateView()">
                    <i data-lucide="plus" class="btn-icon"></i>
                    Create New Keyset
                </button>
            </div>
        `;
    } else {
        // Rebuild share list
        let shareListHTML = '';
        shares.forEach(share => {
            const date = new Date(share.savedAt).toLocaleDateString();
            shareListHTML += `
                <div class="share-item">
                    <div class="share-info">
                        <h3 class="share-name">${share.name}</h3>
                        <p class="share-id">ID: <span class="id-text">${share.id}</span></p>
                        <p class="share-date">Saved: ${date}</p>
                    </div>
                    <div class="share-actions">
                        <div class="tooltip-container">
                            <button class="icon-button" onclick="openLocation('${share.id}')">
                                <i data-lucide="folder-open"></i>
                            </button>
                            <div class="tooltip tooltip-small">Open</div>
                        </div>
                        <div class="tooltip-container">
                            <button class="icon-button icon-button-destructive" onclick="deleteShare('${share.id}')">
                                <i data-lucide="trash-2"></i>
                            </button>
                            <div class="tooltip tooltip-small">Delete</div>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="loadShare('${share.id}')">Load</button>
                    </div>
                </div>
            `;
        });
        shareListContainer.innerHTML = shareListHTML;
    }
    
    // Reinitialize icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function updateHelpTooltipVisibility() {
    const helpTooltip = document.querySelector('.help-tooltip');
    if (helpTooltip) {
        helpTooltip.style.display = shares.length > 0 ? 'inline-block' : 'none';
    }
}

// Modal Management
function showModal(title, content) {
    const modal = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    modal.style.display = 'flex';
    
    // Reinitialize icons in modal content
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function closeModal() {
    const modal = document.getElementById('modal-overlay');
    modal.style.display = 'none';
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('modal-overlay');
    if (event.target === modal) {
        closeModal();
    }
});

// Tooltip Management
function initializeTooltips() {
    // Tooltips are handled by CSS :hover states
    // This function can be expanded for more complex tooltip behavior
}

// Keyboard Navigation
document.addEventListener('keydown', function(event) {
    // Close modal on Escape key
    if (event.key === 'Escape') {
        closeModal();
    }
    
    // Tab navigation in signer view
    if (currentView === 'signer-view') {
        if (event.key === '1' && event.ctrlKey) {
            event.preventDefault();
            switchTab('signer-tab');
        } else if (event.key === '2' && event.ctrlKey) {
            event.preventDefault();
            switchTab('recover-tab');
        }
    }
});

// Simulate API calls for demonstration
function simulateCreateKeyset() {
    // This would be implemented when the create form is built out
    console.log('Creating new keyset...');
    
    // Simulate successful creation
    setTimeout(() => {
        showKeysetView();
    }, 1000);
}

// Add some sample interactions for demonstration
function addSampleShare() {
    const newShare = {
        id: `sample${Date.now()}`,
        name: `Sample Share ${shares.length + 1}`,
        savedAt: new Date().toISOString()
    };
    
    shares.push(newShare);
    updateShareList();
    updateHelpTooltipVisibility();
}

// Helper function to format dates
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Helper function to truncate text
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Export functions for global access (if needed)
window.iglooApp = {
    showMainView,
    showCreateView,
    showKeysetView,
    showSignerView,
    backToShares,
    finishKeyset,
    switchTab,
    loadShare,
    openLocation,
    deleteShare,
    showModal,
    closeModal,
    addSampleShare
}; 