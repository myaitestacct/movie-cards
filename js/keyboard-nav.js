// ============================================
// KEYBOARD NAVIGATION: Arrow Keys, Focus
// ============================================

// --- State ---
var focusedCardIndex = -1;

// --- Get all currently visible cards ---
function getVisibleCards() {
    if (currentView === 'grid') {
        return Array.from(contentArea.querySelectorAll('.movie-card'));
    } else {
        return Array.from(contentArea.querySelectorAll('.movie-table tbody tr'));
    }
}

// --- Get grid columns count ---
function getGridColumns() {
    const grid = contentArea.querySelector('.movie-grid');
    if (!grid) return 1;
    const style = window.getComputedStyle(grid);
    const cols = style.gridTemplateColumns.split(' ').filter(c => c.trim() !== '').length;
    return cols || 1;
}

// --- Focus a specific card ---
function focusCard(index) {
    const cards = getVisibleCards();
    if (index < 0 || index >= cards.length) return;

    // Remove focus from previous
    cards.forEach(c => c.classList.remove('card-focused'));

    focusedCardIndex = index;
    const card = cards[index];
    card.classList.add('card-focused');
    card.focus();

    // Scroll into view if needed
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// --- Navigate cards with arrow keys ---
function navigateCards(direction) {
    const cards = getVisibleCards();
    if (cards.length === 0) return;

    if (focusedCardIndex === -1) {
        // No card focused yet, focus the first one
        focusCard(0);
        return;
    }

    let newIndex = focusedCardIndex;

    if (currentView === 'grid') {
        const cols = getGridColumns();
        switch (direction) {
            case 'ArrowRight':
                newIndex = Math.min(focusedCardIndex + 1, cards.length - 1);
                break;
            case 'ArrowLeft':
                newIndex = Math.max(focusedCardIndex - 1, 0);
                break;
            case 'ArrowDown':
                newIndex = Math.min(focusedCardIndex + cols, cards.length - 1);
                break;
            case 'ArrowUp':
                newIndex = Math.max(focusedCardIndex - cols, 0);
                break;
        }
    } else {
        // Table view - only up/down
        switch (direction) {
            case 'ArrowDown':
                newIndex = Math.min(focusedCardIndex + 1, cards.length - 1);
                break;
            case 'ArrowUp':
                newIndex = Math.max(focusedCardIndex - 1, 0);
                break;
        }
    }

    if (newIndex !== focusedCardIndex) {
        focusCard(newIndex);
    }
}

// --- Open focused card ---
function openFocusedCard() {
    const cards = getVisibleCards();
    if (focusedCardIndex >= 0 && focusedCardIndex < cards.length) {
        cards[focusedCardIndex].click();
    }
}

// --- Reset focus when content changes ---
function resetCardFocus() {
    focusedCardIndex = -1;
    const cards = getVisibleCards();
    cards.forEach(c => c.classList.remove('card-focused'));
}

// --- Navigate genre chips with arrow keys ---
function navigateGenreChips(direction) {
    const chips = Array.from(genreFilters.querySelectorAll('.genre-chip'));
    if (chips.length === 0) return;

    const activeIndex = chips.findIndex(c => document.activeElement === c);
    let newIndex;

    if (direction === 'ArrowRight') {
        newIndex = activeIndex === -1 ? 0 : Math.min(activeIndex + 1, chips.length - 1);
    } else {
        newIndex = activeIndex === -1 ? chips.length - 1 : Math.max(activeIndex - 1, 0);
    }

    chips[newIndex].focus();
}

// --- Close advanced filters panel with Escape ---
function handleAdvancedFiltersEscape() {
    const advPanel = document.getElementById('advanced-filters-panel');
    if (advPanel && advPanel.classList.contains('open')) {
        advPanel.classList.remove('open');
        return true;
    }
    return false;
}

// --- Extended Keyboard Handler ---
document.addEventListener('keydown', e => {
    const isSearchFocused = document.activeElement === searchInput;
    const isModalOpen = modal.open;
    const advPanel = document.getElementById('advanced-filters-panel');
    const isAdvPanelOpen = advPanel && advPanel.classList.contains('open');

    // --- Arrow key navigation for cards ---
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) &&
        !isSearchFocused && !isModalOpen && !isAdvPanelOpen &&
        document.activeElement !== sortSelect &&
        !document.activeElement.closest('.genre-filters')) {

        e.preventDefault();
        navigateCards(e.key);
        return;
    }

    // --- Enter/Space to open focused card ---
    if ((e.key === 'Enter' || e.key === ' ') &&
        !isSearchFocused && !isModalOpen && !isAdvPanelOpen &&
        document.activeElement !== sortSelect &&
        !document.activeElement.closest('.genre-filters')) {

        // Case 1: Card focused via arrow keys (focusedCardIndex is tracked)
        if (focusedCardIndex >= 0) {
            e.preventDefault();
            openFocusedCard();
            return;
        }

        // Case 2: Card/row focused via Tab (active element is a card or table row)
        var activeCard = document.activeElement.closest('.movie-card, .movie-table tbody tr');
        if (activeCard) {
            e.preventDefault();
            activeCard.click();
            return;
        }
    }

    // --- Arrow keys in genre chips ---
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        document.activeElement.closest('.genre-filters')) {
        e.preventDefault();
        navigateGenreChips(e.key);
        return;
    }

    // --- Escape to close advanced filters ---
    if (e.key === 'Escape' && isAdvPanelOpen) {
        e.preventDefault();
        handleAdvancedFiltersEscape();
        return;
    }

    // --- Escape to clear card focus ---
    if (e.key === 'Escape' && focusedCardIndex >= 0 && !isModalOpen && !isAdvPanelOpen) {
        resetCardFocus();
        return;
    }

    // --- Tab into content area focuses first card ---
    if (e.key === 'Tab' && !isSearchFocused && !isModalOpen && !isAdvPanelOpen &&
        document.activeElement !== sortSelect &&
        !document.activeElement.closest('.genre-filters')) {

        // If no card focused and tabbing into content area
        const cards = getVisibleCards();
        if (cards.length > 0 && focusedCardIndex === -1) {
            // Let normal tab flow happen, but set up first card focus
            // We don't prevent default here, just track
        }
    }

    // --- G key: Focus first genre chip ---
    if (e.key === 'g' && !isSearchFocused && !isModalOpen && !isAdvPanelOpen &&
        document.activeElement !== sortSelect) {
        e.preventDefault();
        const firstChip = genreFilters.querySelector('.genre-chip');
        if (firstChip) firstChip.focus();
        return;
    }

    // --- F key: Toggle favorites view ---
    if (e.key === 'f' && !isSearchFocused && !isModalOpen && !isAdvPanelOpen &&
        document.activeElement !== sortSelect) {
        e.preventDefault();
        if (currentCategory === '__favorites__') {
            currentCategory = '';
        } else {
            currentCategory = '__favorites__';
        }
        updateActiveChip();
        fetchMovies(searchInput.value, 0, false);
        return;
    }

    // --- A key: Toggle advanced filters panel ---
    if (e.key === 'a' && !isSearchFocused && !isModalOpen &&
        document.activeElement !== sortSelect) {
        e.preventDefault();
        toggleAdvancedFiltersPanel();
        return;
    }
});

// --- Reset card focus when new content loads ---
// resetCardFocus() is called by renderGrid()/renderTable() in render.js on every
// fresh render. (Wrapping those functions from here never worked: this file is
// loaded before render.js, so they did not exist yet when the wrappers were built.)

// --- Click on card updates focus index ---
document.addEventListener('click', e => {
    const card = e.target.closest('.movie-card, .movie-table tbody tr');
    if (card) {
        const cards = getVisibleCards();
        const idx = cards.indexOf(card);
        if (idx >= 0) focusedCardIndex = idx;
    }
});

// --- Focus event: keep focusedCardIndex in sync when tabbing to a card ---
document.addEventListener('focus', e => {
    const card = e.target.closest('.movie-card, .movie-table tbody tr');
    if (card) {
        const cards = getVisibleCards();
        const idx = cards.indexOf(card);
        if (idx >= 0) {
            // Remove old focus styling
            cards.forEach(c => c.classList.remove('card-focused'));
            focusedCardIndex = idx;
            card.classList.add('card-focused');
        }
    }
}, true); // Use capture phase to catch focus on all elements