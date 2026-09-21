// ============================================
// FILTERS: Genre Chips, Breadcrumb, URL State
// ============================================

// --- URL State: Save current state to URL hash ---
function updateURL() {
    const params = new URLSearchParams();
    if (searchInput.value) params.set('q', searchInput.value);
    if (currentSort !== 'num_asc') params.set('sort', currentSort);
    if (currentCategory === '__favorites__') params.set('favs', '1');
    else if (currentCategory) params.set('genre', currentCategory);
    if (currentDecade) params.set('decade', currentDecade);
    if (showParipakva) params.set('archive', '1');

    // Persist the top of the visible window so page jumps are shareable
    const page = Math.floor(lastFetchOffset / currentLimit) + 1;
    if (page > 1) params.set('page', String(page));

    const hash = params.toString();
    const newURL = hash ? `${window.location.pathname}#${hash}` : window.location.pathname;
    history.replaceState(null, '', newURL);
}

// --- URL State: Restore state from URL hash ---
function loadFromURL() {
    pendingPageOffset = 0;

    const hash = window.location.hash.slice(1);
    if (!hash) return false;

    const params = new URLSearchParams(hash);
    const q = params.get('q') || '';
    const sort = params.get('sort') || 'num_asc';
    const genre = params.get('genre') || '';
    const archive = params.get('archive') || '0';
    const favs = params.get('favs') || '0';
    const decade = params.get('decade') || '';
    const page = Math.max(1, parseInt(params.get('page'), 10) || 1);

    searchInput.value = q;
    currentSort = sort;
    currentCategory = favs === '1' ? '__favorites__' : genre;
    currentDecade = decade;
    showParipakva = archive === '1';
    pendingPageOffset = (page - 1) * currentLimit;

    sortSelect.value = currentSort;
    return true;
}

// --- Fetch and render genre filter chips ---
async function fetchCategories() {
    try {
        const includeArchive = showParipakva ? 1 : 0;
        const response = await fetch(`api.php?action=categories&archive=${includeArchive}`);
        if (!response.ok) return;
        const result = await response.json();
        const categories = result.categories || [];
        renderGenreChips(categories);
    } catch (err) {
        console.warn('Failed to load categories:', err);
    }
}

// --- Render genre chips ---
function renderGenreChips(categories) {
    clearContainer(genreFilters);

    // "All" chip
    const allChip = createElement('button', 'genre-chip' + (currentCategory === '' ? ' active' : ''), 'All');
    allChip.setAttribute('tabindex', '0');       // ★ NEW
    allChip.addEventListener('click', () => {
        currentCategory = '';
        updateActiveChip();
        fetchMovies(searchInput.value, 0, false);
    });
    genreFilters.appendChild(allChip);

    // "♥ Favorites" chip
    const favCount = getFavorites().length;
    const favChip = createElement('button', 'genre-chip fav-chip' + (currentCategory === '__favorites__' ? ' active' : ''), `♥ Favorites${favCount > 0 ? ' (' + favCount + ')' : ''}`);
    favChip.setAttribute('tabindex', '0');       // ★ NEW
    favChip.addEventListener('click', () => {
        if (currentCategory === '__favorites__') {
            currentCategory = '';
        } else {
            currentCategory = '__favorites__';
        }
        updateActiveChip();
        fetchMovies(searchInput.value, 0, false);
    });
    genreFilters.appendChild(favChip);

    if (categories) {
        categories.forEach(cat => {
            const chip = createElement('button', 'genre-chip' + (currentCategory === cat ? ' active' : ''), cat);
            chip.setAttribute('tabindex', '0');  // ★ NEW
            chip.addEventListener('click', () => {
                if (currentCategory === cat) {
                    currentCategory = '';
                } else {
                    currentCategory = cat;
                }
                updateActiveChip();
                fetchMovies(searchInput.value, 0, false);
            });
            genreFilters.appendChild(chip);
        });
    }
}

// --- Update breadcrumb navigation ---
function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;

    if (currentCategory === '' && currentDecade === '' && !searchInput.value) {
        breadcrumb.innerHTML = '';
        breadcrumb.style.display = 'none';
        return;
    }

    breadcrumb.style.display = '';
    let html = '<span class="breadcrumb-item breadcrumb-root" data-action="all">All</span>';

    if (currentCategory === '__favorites__') {
        html += '<span class="breadcrumb-sep">›</span>';
        html += '<span class="breadcrumb-item breadcrumb-current">♥ Favorites</span>';
    } else if (currentCategory) {
        html += '<span class="breadcrumb-sep">›</span>';
        html += `<span class="breadcrumb-item breadcrumb-current">${escapeHtml(currentCategory)}</span>`;
    }

    if (currentDecade) {
        html += '<span class="breadcrumb-sep">›</span>';
        html += `<span class="breadcrumb-item breadcrumb-current">${escapeHtml(currentDecade)}s</span>`;
    }

    if (searchInput.value) {
        html += '<span class="breadcrumb-sep">›</span>';
        html += `<span class="breadcrumb-item breadcrumb-current">"${escapeHtml(searchInput.value)}"</span>`;
    }

    breadcrumb.innerHTML = html;

    // "All" click resets everything
    const rootLink = breadcrumb.querySelector('.breadcrumb-root');
    if (rootLink) {
        rootLink.addEventListener('click', () => {
            currentCategory = '';
            currentDecade = '';
            searchInput.value = '';
            updateActiveChip();
            updateActiveDecadeChip();
            updateBreadcrumb();
            fetchMovies('', 0, false);
        });
    }
}

// --- Update active chip styling ---
function updateActiveChip() {
    genreFilters.querySelectorAll('.genre-chip').forEach(chip => {
        const isAll = chip.textContent === 'All';
        const isFav = chip.classList.contains('fav-chip');
        let isActive = false;
        if (currentCategory === '' && isAll) isActive = true;
        else if (currentCategory === '__favorites__' && isFav) isActive = true;
        else if (chip.textContent === currentCategory) isActive = true;
        chip.classList.toggle('active', isActive);
    });
}