// ============================================
// DECADES: Movies by Decade Explorer
// ============================================

// --- Fetch Decades from API ---
async function fetchDecades() {
    const decadeFiltersEl = document.getElementById('decade-filters');
    if (!decadeFiltersEl) return;

    try {
        const includeArchive = showParipakva ? 1 : 0;
        const response = await fetch(`api.php?action=decades&archive=${includeArchive}`);
        if (!response.ok) return;
        const data = await response.json();
        if (data.success && data.decades) {
            cachedDecades = data.decades;
            renderDecadeChips(data.decades);
        }
    } catch (err) {
        console.warn('Failed to fetch decades:', err);
    }
}

// --- Render Decade Filter Chips ---
function renderDecadeChips(decades) {
    const decadeFiltersEl = document.getElementById('decade-filters');
    if (!decadeFiltersEl) return;

    clearContainer(decadeFiltersEl);

    // "All Decades" Chip
    const allChip = createElement('button', 'decade-chip' + (currentDecade === '' ? ' active' : ''), 'All Eras');
    allChip.setAttribute('tabindex', '0');
    allChip.setAttribute('title', 'Show all release decades');
    allChip.addEventListener('click', () => {
        currentDecade = '';
        updateActiveDecadeChip();
        updateBreadcrumb();
        fetchMovies(searchInput.value, 0, false);
    });
    decadeFiltersEl.appendChild(allChip);

    decades.forEach(item => {
        const d = item.decade;
        const countText = item.count ? ` (${item.count.toLocaleString()})` : '';
        const chip = createElement(
            'button',
            'decade-chip' + (String(currentDecade) === String(d) ? ' active' : ''),
            `${item.label || d + 's'}${countText}`
        );
        chip.setAttribute('tabindex', '0');
        chip.dataset.decade = d;
        chip.setAttribute('title', `${item.label}: ${item.count} movies, Avg ⭐ ${item.avgRating || 'N/A'}`);

        chip.addEventListener('click', () => {
            if (String(currentDecade) === String(d)) {
                currentDecade = '';
            } else {
                currentDecade = d;
            }
            updateActiveDecadeChip();
            updateBreadcrumb();
            fetchMovies(searchInput.value, 0, false);
        });

        decadeFiltersEl.appendChild(chip);
    });
}

// --- Update Active Decade Chip UI ---
function updateActiveDecadeChip() {
    const decadeFiltersEl = document.getElementById('decade-filters');
    if (!decadeFiltersEl) return;

    decadeFiltersEl.querySelectorAll('.decade-chip').forEach(chip => {
        const isAll = chip.textContent.startsWith('All Eras');
        let isActive = false;
        if (currentDecade === '' && isAll) {
            isActive = true;
        } else if (chip.dataset.decade && String(chip.dataset.decade) === String(currentDecade)) {
            isActive = true;
        }
        chip.classList.toggle('active', isActive);
    });
}

// --- Set Decade Filter Programmatically ---
function setDecadeFilter(decade) {
    currentDecade = decade ? String(decade) : '';
    updateActiveDecadeChip();
    updateBreadcrumb();
    fetchMovies(searchInput.value, 0, false);
}
