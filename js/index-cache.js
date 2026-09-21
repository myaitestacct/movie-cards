// ============================================
// INDEX CACHE: full collection list, fetched
// once and cached (memory + localStorage)
// ============================================
//
// The server endpoint `api.php?action=index` returns the whole collection as
// compact {num, title, year} rows ordered by NUM ASC. With that list in hand:
//   - letter/decade jumps filter client-side (no 50/100-row cap, instant)
//   - the Page tab knows which movie starts any page of the sequential list
//   - the footer can show "Movie #X of Y" positions without extra requests
//
// Freshness: the cache is revalidated against the total movie count reported
// by the stats endpoint (validateMovieIndexCount) and by age (12h TTL).

function indexSourceName() {
    return showParipakva ? 'paripakva' : 'movies';
}

function indexCacheKey() {
    return INDEX_CACHE_PREFIX + indexSourceName();
}

// --- localStorage persistence (best effort: private mode / quota may fail) ---
function readIndexCache(source) {
    try {
        const raw = localStorage.getItem(INDEX_CACHE_PREFIX + source);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.movies) || parsed.movies.length === 0) return null;
        return parsed; // { savedAt, count, movies }
    } catch (e) {
        return null;
    }
}

function writeIndexCache(source, movies) {
    try {
        localStorage.setItem(INDEX_CACHE_PREFIX + source, JSON.stringify({
            savedAt: Date.now(),
            count: movies.length,
            movies: movies
        }));
    } catch (e) {
        // Quota exceeded or storage disabled — the in-memory copy still works.
        console.warn('Index cache could not be persisted:', e);
    }
}

// --- Fetch the full index from the server ---
async function fetchMovieIndexFromServer() {
    const response = await fetch(`api.php?action=index&archive=${showParipakva ? 1 : 0}`);
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const data = await response.json();
    if (!data.success || !Array.isArray(data.movies)) {
        throw new Error(data.error || 'Index unavailable');
    }
    return data.movies;
}

// One in-flight fetch per source at a time (dedupes concurrent callers).
var _indexFetchPromise = null;

/**
 * Resolve the movie index for the current source.
 * Memory → localStorage → server, in that order.
 */
async function ensureMovieIndex(forceRefresh = false) {
    const source = indexSourceName();

    if (!forceRefresh && movieIndexSource === source && movieIndex.length > 0) {
        return movieIndex;
    }

    if (_indexFetchPromise) return _indexFetchPromise;

    const loadPromise = (async () => {
        if (!forceRefresh) {
            const cached = readIndexCache(source);
            if (cached) {
                movieIndex = cached.movies;
                movieIndexSource = source;
                // Stale by age → silent background refresh, but serve cached now.
                if (Date.now() - (cached.savedAt || 0) > INDEX_CACHE_TTL_MS) {
                    refreshMovieIndexInBackground();
                }
                return movieIndex;
            }
        }

        const fresh = await fetchMovieIndexFromServer();
        movieIndex = fresh;
        movieIndexSource = source;
        writeIndexCache(source, fresh);
        return movieIndex;
    })();

    _indexFetchPromise = loadPromise;
    // Clear the slot only for THIS load. (The cache path can complete
    // synchronously, before the assignment above, so a finally inside the
    // async body would run too early and leave the promise pinned forever.)
    loadPromise.finally(() => {
        if (_indexFetchPromise === loadPromise) _indexFetchPromise = null;
    });

    return loadPromise;
}

function refreshMovieIndexInBackground() {
    if (_indexRefreshInFlight) return;
    _indexRefreshInFlight = true;

    // Fetch directly (not via ensureMovieIndex) so an in-flight cache read
    // can never swallow the refresh.
    const source = indexSourceName();
    fetchMovieIndexFromServer()
        .then(fresh => {
            // Ignore the result if the user switched archive meanwhile.
            if (indexSourceName() !== source) return;
            movieIndex = fresh;
            movieIndexSource = source;
            writeIndexCache(source, fresh);
        })
        .catch(err => console.warn('Index refresh failed:', err))
        .finally(() => { _indexRefreshInFlight = false; });
}

var _indexRefreshInFlight = false;

/**
 * Called whenever a stats response arrives: if the collection size no longer
 * matches the cache, refresh silently in the background.
 */
function validateMovieIndexCount(totalMovies) {
    const total = Number(totalMovies) || 0;
    if (total <= 0) return;
    if (movieIndexSource === indexSourceName() && movieIndex.length > 0 && movieIndex.length !== total) {
        refreshMovieIndexInBackground();
    }
}

// ============================================
// Client-side filtering on the cached index
// ============================================

/** Movies whose (formatted) title starts with a letter. '#'/'[0-9]' = any digit. */
function indexMoviesStartingWith(letter) {
    const digitsOnly = (letter === '#' || letter === '[0-9]');
    const wanted = letter.toUpperCase();

    return movieIndex.filter(m => {
        const title = (m.title || '').trimStart();
        if (digitsOnly) return /^[0-9]/.test(title);
        return title.charAt(0).toUpperCase() === wanted;
    });
}

/** Movies released within a decade (both ends inclusive). */
function indexMoviesInDecade(decadeStart) {
    const from = parseInt(decadeStart, 10);
    if (isNaN(from)) return [];
    const to = from + 9;

    return movieIndex.filter(m => {
        const year = parseInt(m.year, 10);
        return !isNaN(year) && year >= from && year <= to;
    });
}

function indexMovieByNum(num) {
    const wanted = Number(num);
    return movieIndex.find(m => m.num === wanted) || null;
}

// ============================================
// Sequential position & page math
// ============================================

/**
 * True when the main listing is exactly the index order — i.e. no search,
 * no genre/decade/favorites, no advanced filters, and sorted by NUM.
 * Only then can the cached index predict what is on page N.
 */
function isSequentialIndexState() {
    if (searchInput.value.trim() !== '') return false;
    if (currentCategory !== '') return false;      // includes '__favorites__'
    if (currentDecade !== '') return false;
    if (currentSort !== 'num_asc' && currentSort !== 'num_desc') return false;
    if (typeof hasAdvancedFilters === 'function' && hasAdvancedFilters()) return false;
    return movieIndexSource === indexSourceName() && movieIndex.length > 0;
}

/** 0-based position of a NUM in the CURRENT sort order, or -1. */
function indexPositionOfNum(num) {
    if (movieIndexSource !== indexSourceName()) return -1;
    const rawIdx = movieIndex.findIndex(m => m.num === Number(num));
    if (rawIdx === -1) return -1;
    return currentSort === 'num_desc' ? movieIndex.length - 1 - rawIdx : rawIdx;
}

/** Total pages for the current result set. Index-aware when sequential. */
function sequentialTotalPages(limit) {
    const total = isSequentialIndexState() ? movieIndex.length : lastTotalMatches;
    if (!total || total <= 0) return 0;
    return Math.max(1, Math.ceil(total / limit));
}

/** Index entry that starts page N (1-based) under the current sort, or null. */
function indexPageStartEntry(page, limit) {
    if (!isSequentialIndexState()) return null;
    const pos = (page - 1) * limit;
    if (pos < 0 || pos >= movieIndex.length) return null;
    return currentSort === 'num_desc'
        ? movieIndex[movieIndex.length - 1 - pos]
        : movieIndex[pos];
}

// ============================================
// Position labels (footer + Page tab)
// ============================================

/** Format "Movies #1,901–#1,950 of 4,096 (Page 39 of 82)" for the panel footer. */
function updatePositionLabel() {
    const positionEl = document.getElementById('current-position');
    if (!positionEl) return;

    const total = lastTotalMatches || (isSequentialIndexState() ? movieIndex.length : 0);
    if (!total) return;

    const start = lastFetchOffset + 1;
    const end = Math.min(lastFetchOffset + currentLimit, total);
    const totalPages = Math.max(1, Math.ceil(total / currentLimit));
    const page = Math.floor(lastFetchOffset / currentLimit) + 1;

    positionEl.textContent =
        `Movies #${start.toLocaleString()}–#${end.toLocaleString()} of ${total.toLocaleString()}` +
        ` (Page ${page.toLocaleString()} of ${totalPages.toLocaleString()})`;
}
