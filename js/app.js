// ============================================
// APP: Event Listeners & Initialization
// ============================================

// --- Search Input (debounced) ---
searchInput.addEventListener('input', e => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchMovies(e.target.value, 0, false), 400);
});

// --- Sort Select ---
sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    fetchMovies(searchInput.value, 0, false);
});

// --- Page Size Select ---
if (limitSelect) {
    limitSelect.addEventListener('change', () => {
        const newLimit = parseInt(limitSelect.value, 10);
        if (!PAGE_SIZE_OPTIONS.includes(newLimit)) return;
        currentLimit = newLimit;
        try { localStorage.setItem(LIMIT_KEY, String(currentLimit)); } catch (e) { /* storage unavailable */ }
        // New page size → restart the window at page 1
        fetchMovies(searchInput.value, 0, false);
    });
}

// --- Modal Close ---
closeModal.addEventListener('click', smoothClose);
modal.addEventListener('click', e => { if (e.target === modal) smoothClose(); });

// --- Global Keyboard Shortcuts ---
document.addEventListener('keydown', e => {
    // Escape: close modal
    if (e.key === 'Escape' && modal.open) {
        smoothClose();
        return;
    }

    // Escape: clear search if focused
    if (e.key === 'Escape' && document.activeElement === searchInput && searchInput.value) {
        searchInput.value = '';
        fetchMovies('', 0, false);
        searchInput.blur();
        return;
    }

    // Ctrl+Shift+K: Toggle paripakva archive
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
        showParipakva = !showParipakva;
        currentCategory = '';
        currentDecade = '';
        fetchCategories();
        fetchDecades();
        fetchMovies(searchInput.value, 0, false);
        console.log(`Paripakva ${showParipakva ? 'enabled' : 'disabled'}`);
        return;
    }

    // ?: Show keyboard shortcuts overlay
    if (e.key === '?' && !modal.open && document.activeElement !== searchInput) {
        showShortcutsOverlay();
        return;
    }

    // / or Ctrl+K: Focus search input
    if ((e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k')) && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
        return;
    }

    // 1: Switch to grid view
    if (e.key === '1' && document.activeElement !== searchInput) {
        if (currentView !== 'grid') {
            currentView = 'grid';
            updateViewToggleButton();
            fetchMovies(searchInput.value, 0, false);
        }
        return;
    }

    // 2: Switch to list view
    if (e.key === '2' && document.activeElement !== searchInput) {
        if (currentView !== 'list') {
            currentView = 'list';
            updateViewToggleButton();
            fetchMovies(searchInput.value, 0, false);
        }
        return;
    }
});

// ============================================
// INITIALIZATION
// ============================================

// Restore saved page size BEFORE loadFromURL(), which uses it for page math
if (limitSelect) {
    const savedLimit = parseInt(localStorage.getItem(LIMIT_KEY), 10);
    if (PAGE_SIZE_OPTIONS.includes(savedLimit)) {
        currentLimit = savedLimit;
        limitSelect.value = String(savedLimit);
    }
}

// Restore state from URL hash (bookmarkable/shareable links)
loadFromURL();

// Load data
fetchCategories();
fetchDecades();
loadSavedCompare();
fetchStats();
fetchMovies(searchInput.value, pendingPageOffset, false);

// Handle browser back/forward buttons
window.addEventListener('hashchange', () => {
    loadFromURL();
    fetchMovies(searchInput.value, pendingPageOffset, false);
});