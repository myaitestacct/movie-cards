// ============================================
// API: Fetch Movies & Stats
// ============================================

// --- Build the listing URL for the current search/filter/sort state ---
// Shared by fetchMovies() and every feature that pages through the collection
// (slideshow, analytics) so they always agree on what "the current result set" is.
function buildMoviesUrl(query = '', offset = 0) {
    const includeArchive = showParipakva ? 1 : 0;

    // Favorites is a pseudo-category handled by the API's `favs` parameter
    let categoryParam = currentCategory;
    let favsParam = '';
    if (currentCategory === '__favorites__') {
        categoryParam = '';
        favsParam = getFavorites().join(',');
    }

    const advFilterParams = buildAdvancedFilterParams();

    return `api.php?q=${encodeURIComponent(query)}&limit=${currentLimit}&offset=${offset}`
        + `&archive=${includeArchive}&sort=${encodeURIComponent(currentSort)}`
        + `&category=${encodeURIComponent(categoryParam)}&favs=${encodeURIComponent(favsParam)}`
        + `&decade=${encodeURIComponent(currentDecade)}`
        + (advFilterParams ? '&' + advFilterParams : '');
}

// --- Fetch Movies from API ---
async function fetchMovies(query = '', offset = 0, append = false) {
    if (isLoading) return;
    isLoading = true;

    try {
        if (!append) {
            clearContainer(contentArea);
            currentOffset = 0;
            hasMoreResults = true;
            showLoadingSpinner();
        }

        const response = await fetch(buildMoviesUrl(query, offset));

        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const result = await response.json();
        const movies = result.movies || [];
        hasMoreResults = result.hasMore === true;

        // Keep the client-side model of the result set in sync (slideshow,
        // analytics and quick jump all read it)
        currentMovies = append ? currentMovies.concat(movies) : movies;

        hideLoadingSpinner();

        // Display total results
        const totalEl = document.getElementById('search-results-count');
        const shownCount = append ? currentOffset + movies.length : movies.length;

        if (query && currentCategory === '__favorites__') {
            totalEl.textContent = `Showing ${shownCount} of ${result.totalMatches || 0} favorite(s) matching "${query}"`;
        } else if (query && currentCategory) {
            totalEl.textContent = `Showing ${shownCount} of ${result.totalMatches || 0} result(s) for "${query}" in ${currentCategory}`;
        } else if (query) {
            totalEl.textContent = `Showing ${shownCount} of ${result.totalMatches || 0} result(s) for "${query}"`;
        } else if (currentCategory === '__favorites__') {
            totalEl.textContent = `Showing ${shownCount} of ${result.totalMatches || 0} favorite(s)`;
        } else if (currentCategory) {
            totalEl.textContent = `Showing ${shownCount} of ${result.totalMatches || 0} in ${currentCategory}`;
        } else {
            totalEl.textContent = `Showing ${shownCount} of ${result.totalMatches || 0} movies`;
        }

        // Remove loading indicator
        const loadingEl = contentArea.querySelector('.loading');
        if (loadingEl) loadingEl.remove();

        if (!append && movies.length === 0) {
            showNoResults(query);
            isLoading = false;
            updateBreadcrumb();
            return;
        }

        if (currentView === 'grid') renderGrid(movies, append);
        else renderTable(movies, append);

        if (hasMoreResults) addLoadMoreButton();
        else {
            const btn = contentArea.querySelector('.load-more-btn');
            if (btn) btn.remove();
        }

        currentQuery = query;
        currentOffset = result.nextOffset || offset + movies.length;

        updateBreadcrumb();
        updateURL();
    } catch (err) {
        console.error('Fetch error:', err);
        hideLoadingSpinner();
        if (!append) {
            clearContainer(contentArea);
            const errEl = createElement('div', 'error', 'Error: ' + err.message);
            Object.assign(errEl.style, { gridColumn: '1 / -1', padding: '2rem', color: 'var(--accent)', textAlign: 'center' });
            contentArea.appendChild(errEl);
        }
    } finally {
        isLoading = false;
    }
}

// --- Show No Results ---
function showNoResults(query) {
    const noResultsDiv = createElement('div', 'no-results');
    const noResultsMessage = query
        ? `No movies found for "${query}". Try a different search or genre.`
        : 'No movies available. Start typing to search...';

    noResultsDiv.innerHTML = `
        <div class="no-results-illustration">
            <svg width="180" height="160" viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="50" y="30" width="80" height="100" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
                <circle cx="65" cy="45" r="5" fill="rgba(229,9,20,0.4)"/>
                <circle cx="90" cy="45" r="5" fill="rgba(229,9,20,0.3)"/>
                <circle cx="115" cy="45" r="5" fill="rgba(229,9,20,0.4)"/>
                <circle cx="65" cy="115" r="5" fill="rgba(229,9,20,0.3)"/>
                <circle cx="90" cy="115" r="5" fill="rgba(229,9,20,0.4)"/>
                <circle cx="115" cy="115" r="5" fill="rgba(229,9,20,0.3)"/>
                <circle cx="90" cy="75" r="22" stroke="rgba(255,255,255,0.25)" stroke-width="3" fill="none"/>
                <line x1="106" y1="91" x2="120" y2="105" stroke="rgba(255,255,255,0.25)" stroke-width="3" stroke-linecap="round"/>
                <text x="82" y="83" font-size="24" font-weight="bold" fill="rgba(229,9,20,0.6)">?</text>
                <circle cx="25" cy="50" r="2" fill="rgba(255,255,255,0.2)"/>
                <circle cx="155" cy="40" r="1.5" fill="rgba(255,255,255,0.15)"/>
                <circle cx="30" cy="110" r="1" fill="rgba(255,255,255,0.1)"/>
                <circle cx="150" cy="120" r="2" fill="rgba(255,255,255,0.15)"/>
            </svg>
        </div>
        <h2 class="no-results-title">No results found</h2>
        <p class="no-results-message">${noResultsMessage}</p>
        <div class="no-results-tips">
            <span class="tip-label">Tips:</span>
            <ul>
                <li>Check for typos in your search</li>
                <li>Try broader keywords</li>
                <li>Try a different genre filter</li>
                <li>Check a different sort order</li>
            </ul>
        </div>
        <button class="no-results-reset-btn">Clear Search &amp; Filters</button>
    `;

    Object.assign(noResultsDiv.style, { gridColumn: '1 / -1' });
    contentArea.appendChild(noResultsDiv);

    const resetBtn = noResultsDiv.querySelector('.no-results-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            currentQuery = '';
            currentCategory = '';
            searchInput.value = '';
            renderGenreChips();
            sortSelect.value = 'num_asc';
            currentSort = 'num_asc';
            currentOffset = 0;
            fetchMovies('', 0, false);
        });
    }
}

// --- Fetch and render stats dashboard ---
async function fetchStats() {
    const statsBar = document.getElementById('stats-bar');
    if (!statsBar) return;
    try {
        const includeArchive = showParipakva ? 1 : 0;
        const response = await fetch(`api.php?action=stats&archive=${includeArchive}`);
        if (!response.ok) return;
        const result = await response.json();
        const favCount = getFavorites().length;
        statsBar.innerHTML = `
            <div class="stat-item">
                <span class="stat-value">${result.totalMovies.toLocaleString()}</span>
                <span class="stat-label">Total Movies</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
                <span class="stat-value">${favCount}</span>
                <span class="stat-label">Favorites</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
                <span class="stat-value">⭐ ${result.avgRating}</span>
                <span class="stat-label">Avg Rating</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
                <span class="stat-value">⏱ ${escapeHtml(result.totalRuntime)}</span>
                <span class="stat-label">Total Runtime</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
                <span class="stat-value">${escapeHtml(result.topGenre)}</span>
                <span class="stat-label">Top Genre (${result.topGenreCount})</span>
            </div>
        `;
    } catch (err) {
        console.warn('Failed to load stats:', err);
    }
}