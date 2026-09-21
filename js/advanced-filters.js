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
    // The "Any" radio carries -1; the API treats an empty value as "no constraint"
    const presenceRadio = document.querySelector('input[name="filter-sub-presence"]:checked');
    const subPresence = presenceRadio ? presenceRadio.value : '';

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
        certifications: Array.from(document.querySelectorAll('.filter-cert:checked')).map(cb => cb.value),
        subtitles: Array.from(document.querySelectorAll('.filter-sub-lang:checked')).map(cb => cb.value),
        subPresence: subPresence === '-1' ? '' : subPresence
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

// --- Empty filter set (single definition, used by clear and by URL restore) ---
function emptyAdvancedFilters() {
    return {
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
        certifications: [],
        subtitles: [],
        subPresence: ''
    };
}

// --- Push the advancedFilters state into the panel controls ---
// The controls are one of two places a filter can be set (the other is a chip
// inside the movie details modal), so anything that changes the state has to
// write it back here - otherwise "Apply Filters" re-reads stale checkboxes and
// silently drops the filter.
function syncAdvancedFilterControls() {
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value === null || value === undefined ? '' : value;
    };
    setValue('filter-year-from', advancedFilters.yearFrom);
    setValue('filter-year-to', advancedFilters.yearTo);
    setValue('filter-rating-from', advancedFilters.ratingFrom);
    setValue('filter-rating-to', advancedFilters.ratingTo);
    setValue('filter-country', advancedFilters.country);
    setValue('filter-director', advancedFilters.director);
    setValue('filter-actors', advancedFilters.actors);
    setValue('filter-size-from', advancedFilters.sizeFrom);
    setValue('filter-size-to', advancedFilters.sizeTo);

    const setChecked = (selector, values) => {
        const wanted = (values || []).map(String);
        document.querySelectorAll(selector).forEach(cb => {
            cb.checked = wanted.includes(String(cb.value));
        });
    };
    setChecked('.filter-resolution', advancedFilters.resolutions);
    setChecked('.filter-audio', advancedFilters.audioFormats);
    setChecked('.filter-cert', advancedFilters.certifications);
    setChecked('.filter-sub-lang', advancedFilters.subtitles);

    // '' means "any" and is represented by the -1 radio
    const presence = advancedFilters.subPresence === '' || advancedFilters.subPresence === undefined
        ? '-1'
        : String(advancedFilters.subPresence);
    const radio = document.querySelector(`input[name="filter-sub-presence"][value="${presence}"]`);
    if (radio) radio.checked = true;
}

// --- Clear All Filters ---
function clearAdvancedFilters() {
    advancedFilters = emptyAdvancedFilters();
    syncAdvancedFilterControls();
    updateFilterCount();
    fetchMovies(searchInput.value, 0, false);
}

advFiltersClear.addEventListener('click', clearAdvancedFilters);

// --- Update Filter Count Badge ---
// Also the choke point for "the filter state changed": anything that calls this
// (Apply, Clear, a subtitle chip, URL restore, or future code that sets
// advancedFilters directly) gets the panel controls written back, so the state
// and the checkboxes can no longer drift apart.
function updateFilterCount() {
    syncAdvancedFilterControls();

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
    if (advancedFilters.subtitles.length > 0) count++;
    if (advancedFilters.subPresence !== '' && advancedFilters.subPresence !== undefined) count++;
    
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
    if (advancedFilters.subtitles && advancedFilters.subtitles.length > 0) {
        params.set('subtitles', advancedFilters.subtitles.join(','));
    }
    if (advancedFilters.subPresence !== '' && advancedFilters.subPresence !== undefined) {
        params.set('sub_presence', advancedFilters.subPresence);
    }

    return params.toString();
}

// --- Restore advanced filters from URL params (shared/bookmarked links) ---
// Mirror image of buildAdvancedFilterParams(): same keys, same meanings, so a
// link can only reproduce a filter that the UI can also show (and the panel is
// synced immediately, so the restored filters are visible and editable).
function readAdvancedFiltersFromParams(params) {
    const list = (key) => {
        const raw = params.get(key);
        return raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
    };
    const presence = params.get('sub_presence');

    advancedFilters = {
        yearFrom: params.get('year_from') || '',
        yearTo: params.get('year_to') || '',
        ratingFrom: params.get('rating_from') || '',
        ratingTo: params.get('rating_to') || '',
        resolutions: list('resolutions'),
        audioFormats: list('audio'),
        country: params.get('country') || '',
        director: params.get('director') || '',
        actors: params.get('actors') || '',
        sizeFrom: params.get('size_from') || '',
        sizeTo: params.get('size_to') || '',
        certifications: list('certifications'),
        subtitles: list('subtitles'),
        subPresence: (presence === '1' || presence === '0') ? presence : ''
    };

    syncAdvancedFilterControls();
    updateFilterCount();
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
        advancedFilters.certifications.length > 0 ||
        advancedFilters.subtitles.length > 0 ||
        advancedFilters.subPresence !== ''
    );
}