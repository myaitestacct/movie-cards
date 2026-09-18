// ============================================
// ADVANCED FILTERS: Panel, Controls, Logic
// ============================================

// --- Panel Toggle ---
const btnAdvancedFilters = document.getElementById('btn-advanced-filters');
const advFiltersPanel = document.getElementById('advanced-filters-panel');
const advFiltersClose = document.getElementById('adv-filters-close');
const advFiltersApply = document.getElementById('adv-filters-apply');
const advFiltersClear = document.getElementById('adv-filters-clear');
const advFiltersCount = document.getElementById('adv-filters-count');

function toggleAdvancedFiltersPanel() {
    const willOpen = !advFiltersPanel.classList.contains('open');

    // Both side panels are anchored to the same edge, so only one may be open
    // (closeQuickJumpPanel lives in quick-jump.js, which loads after this file).
    if (willOpen && typeof closeQuickJumpPanel === 'function') closeQuickJumpPanel();

    advFiltersPanel.classList.toggle('open');
}

btnAdvancedFilters.addEventListener('click', toggleAdvancedFiltersPanel);
advFiltersClose.addEventListener('click', () => advFiltersPanel.classList.remove('open'));

// Close panel when clicking outside (optional)
document.addEventListener('click', (e) => {
    if (advFiltersPanel.classList.contains('open') &&
        !advFiltersPanel.contains(e.target) &&
        !btnAdvancedFilters.contains(e.target)) {
        advFiltersPanel.classList.remove('open');
    }
});

// --- Collect Filter Values ---
function collectAdvancedFilters() {
    const filters = {
        yearFrom: document.getElementById('filter-year-from').value,
        yearTo: document.getElementById('filter-year-to').value,
        ratingFrom: document.getElementById('filter-rating-from').value,
        ratingTo: document.getElementById('filter-rating-to').value,
        resolutions: Array.from(document.querySelectorAll('.filter-resolution:checked')).map(cb => cb.value),
        audioFormats: Array.from(document.querySelectorAll('.filter-audio:checked')).map(cb => cb.value),
        country: document.getElementById('filter-country').value.trim(),
        director: document.getElementById('filter-director').value.trim(),
        actors: document.getElementById('filter-actors').value.trim(),
        sizeFrom: document.getElementById('filter-size-from').value,
        sizeTo: document.getElementById('filter-size-to').value,
        certifications: Array.from(document.querySelectorAll('.filter-cert:checked')).map(cb => cb.value)
    };
    return filters;
}

// --- Apply Filters to State ---
function applyAdvancedFilters() {
    advancedFilters = collectAdvancedFilters();
    updateFilterCount();
    fetchMovies(searchInput.value, 0, false);
    advFiltersPanel.classList.remove('open');
}

advFiltersApply.addEventListener('click', applyAdvancedFilters);

// --- Clear All Filters ---
function clearAdvancedFilters() {
    document.getElementById('filter-year-from').value = '';
    document.getElementById('filter-year-to').value = '';
    document.getElementById('filter-rating-from').value = '';
    document.getElementById('filter-rating-to').value = '';
    document.getElementById('filter-country').value = '';
    document.getElementById('filter-director').value = '';
    document.getElementById('filter-actors').value = '';
    document.getElementById('filter-size-from').value = '';
    document.getElementById('filter-size-to').value = '';
    
    document.querySelectorAll('.filter-resolution, .filter-audio, .filter-cert').forEach(cb => {
        cb.checked = false;
    });
    
    advancedFilters = {
        yearFrom: '',
        yearTo: '',
        ratingFrom: '',
        ratingTo: '',
        resolutions: [],
        audioFormats: [],
        country: '',
        director: '',
        actors: '',
        sizeFrom: '',
        sizeTo: '',
        certifications: []
    };
    
    updateFilterCount();
    fetchMovies(searchInput.value, 0, false);
}

advFiltersClear.addEventListener('click', clearAdvancedFilters);

// --- Update Filter Count Badge ---
function updateFilterCount() {
    let count = 0;
    
    if (advancedFilters.yearFrom) count++;
    if (advancedFilters.yearTo) count++;
    if (advancedFilters.ratingFrom) count++;
    if (advancedFilters.ratingTo) count++;
    if (advancedFilters.resolutions.length > 0) count++;
    if (advancedFilters.audioFormats.length > 0) count++;
    if (advancedFilters.country) count++;
    if (advancedFilters.director) count++;
    if (advancedFilters.actors) count++;
    if (advancedFilters.sizeFrom) count++;
    if (advancedFilters.sizeTo) count++;
    if (advancedFilters.certifications.length > 0) count++;
    
    // hasAdvancedFilters() is the single source of truth for "is anything active"
    if (hasAdvancedFilters()) {
        advFiltersCount.textContent = count;
        advFiltersCount.style.display = '';
        btnAdvancedFilters.classList.add('has-filters');
    } else {
        advFiltersCount.style.display = 'none';
        btnAdvancedFilters.classList.remove('has-filters');
    }
}

// --- Build Filter Query String ---
function buildAdvancedFilterParams() {
    const params = new URLSearchParams();
    
    if (advancedFilters.yearFrom) params.set('year_from', advancedFilters.yearFrom);
    if (advancedFilters.yearTo) params.set('year_to', advancedFilters.yearTo);
    if (advancedFilters.ratingFrom) params.set('rating_from', advancedFilters.ratingFrom);
    if (advancedFilters.ratingTo) params.set('rating_to', advancedFilters.ratingTo);
    if (advancedFilters.resolutions.length > 0) {
        params.set('resolutions', advancedFilters.resolutions.join(','));
    }
    if (advancedFilters.audioFormats.length > 0) {
        params.set('audio', advancedFilters.audioFormats.join(','));
    }
    if (advancedFilters.country) {
        params.set('country', advancedFilters.country);
    }
    if (advancedFilters.director) {
        params.set('director', advancedFilters.director);
    }
    if (advancedFilters.actors) {
        params.set('actors', advancedFilters.actors);
    }
    if (advancedFilters.sizeFrom) {
        params.set('size_from', advancedFilters.sizeFrom);
    }
    if (advancedFilters.sizeTo) {
        params.set('size_to', advancedFilters.sizeTo);
    }
    if (advancedFilters.certifications.length > 0) {
        params.set('certifications', advancedFilters.certifications.join(','));
    }
    
    return params.toString();
}

// --- Check if any advanced filters are active ---
function hasAdvancedFilters() {
    return !!(
        advancedFilters.yearFrom ||
        advancedFilters.yearTo ||
        advancedFilters.ratingFrom ||
        advancedFilters.ratingTo ||
        advancedFilters.resolutions.length > 0 ||
        advancedFilters.audioFormats.length > 0 ||
        advancedFilters.country ||
        advancedFilters.director ||
        advancedFilters.actors ||
        advancedFilters.sizeFrom ||
        advancedFilters.sizeTo ||
        advancedFilters.certifications.length > 0
    );
}