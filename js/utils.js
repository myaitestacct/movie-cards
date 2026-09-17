// ============================================
// UTILS: DOM Helpers & Common Functions
// ============================================

// --- Create DOM Element ---
function createElement(tag, className = '', textContent = '', attributes = {}) {
    const el = document.createElement(tag);
    if (className) className.split(' ').forEach(cls => el.classList.add(cls));
    if (textContent) el.textContent = textContent;
    Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
}

// --- Clear container ---
function clearContainer(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
}

// --- Escape HTML to prevent XSS ---
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- Highlight search term in text ---
function highlightSearchTerm(text, searchTerm) {
    if (!text || !searchTerm) return escapeHtml(text);
    
    // Escape the text first
    const escapedText = escapeHtml(text);
    
    // Escape special regex characters in search term
    const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Create regex with case-insensitive flag
    const regex = new RegExp(`(${escapedSearch})`, 'gi');
    
    // Replace matches with highlighted version
    return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
}

// --- Show loading spinner ---
function showLoadingSpinner() {
    const existing = contentArea.querySelector('.loading-spinner');
    if (existing) existing.remove();
    const spinner = createElement('div', 'loading-spinner');
    spinner.innerHTML = `
        <div class="spinner"></div>
        <div class="spinner-text">Loading movies...</div>
    `;
    contentArea.appendChild(spinner);
}

// --- Hide loading spinner ---
function hideLoadingSpinner() {
    const spinner = contentArea.querySelector('.loading-spinner');
    if (spinner) spinner.remove();
}

// --- Toast Notifications ---
function showToast(message, type = 'info', duration = 3000) {
    var container = document.getElementById('toast-container');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;

    // Icon based on type
    var icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    toast.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) + '</span><span class="toast-message">' + escapeHtml(message) + '</span>';

    container.appendChild(toast);

    // Trigger entrance animation
    requestAnimationFrame(function() {
        toast.classList.add('toast-visible');
    });

    // Auto-dismiss
    setTimeout(function() {
        toast.classList.remove('toast-visible');
        toast.classList.add('toast-hiding');
        setTimeout(function() {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, duration);
}