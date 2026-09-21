// ============================================
// QUICK JUMP: Jump by number, first letter,
// decade — or straight to a page of the list
// ============================================
//
// Letter & decade jumps are served from the cached full-collection index
// (js/index-cache.js), so they return the ENTIRE matching list instead of a
// 50-row server page. Results appear as clickable rows; clicking one jumps
// the grid to that movie's page (or opens its details when filters prevent
// page math). The Page tab jumps directly to page N of the sequential list.

const btnQuickJump = document.getElementById('btn-quick-jump');
const quickJumpPanel = document.getElementById('quick-jump-panel');
const quickJumpClose = document.getElementById('quick-jump-close');
const jumpToNumberInput = document.getElementById('jump-to-number');
const jumpNumberBtn = document.getElementById('jump-number-btn');
const jumpNumberStatus = document.getElementById('jump-number-status');
const jumpLetterStatus = document.getElementById('jump-letter-status');
const jumpDecadeStatus = document.getElementById('jump-decade-status');
const jumpLetterResults = document.getElementById('jump-letter-results');
const jumpDecadeResults = document.getElementById('jump-decade-results');
const jumpToPageInput = document.getElementById('jump-to-page');
const jumpPageBtn = document.getElementById('jump-page-btn');
const jumpPagePrev = document.getElementById('jump-page-prev');
const jumpPageNext = document.getElementById('jump-page-next');
const jumpPageStatus = document.getElementById('jump-page-status');
const totalMoviesCount = document.getElementById('total-movies-count');
const currentPosition = document.getElementById('current-position');

// --- Panel open/close ---
// Both side panels are anchored to the same edge, so only one may be open.
function isQuickJumpOpen() {
    return quickJumpPanel.classList.contains('open');
}

function openQuickJumpPanel() {
    const advPanel = document.getElementById('advanced-filters-panel');
    if (advPanel) advPanel.classList.remove('open');

    quickJumpPanel.classList.add('open');
    updateCollectionInfo();

    // Warm the index in the background so the first letter/decade/page
    // action is instant.
    ensureMovieIndex().catch(() => {});
    refreshPageTabStatus();
}

function closeQuickJumpPanel() {
    quickJumpPanel.classList.remove('open');
}

function toggleQuickJumpPanel() {
    if (isQuickJumpOpen()) closeQuickJumpPanel();
    else openQuickJumpPanel();
}

btnQuickJump.addEventListener('click', toggleQuickJumpPanel);
quickJumpClose.addEventListener('click', closeQuickJumpPanel);

// Close panel when clicking outside
document.addEventListener('click', (e) => {
    if (isQuickJumpOpen() &&
        !quickJumpPanel.contains(e.target) &&
        !btnQuickJump.contains(e.target)) {
        closeQuickJumpPanel();
    }
});

// Escape closes the panel
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isQuickJumpOpen()) {
        closeQuickJumpPanel();
    }
});

// --- Tabs (Number / Letter / Decade / Page) ---
const qjTabButtons = Array.from(document.querySelectorAll('.qj-tab-btn'));
const qjTabPanels = Array.from(document.querySelectorAll('.qj-tab-panel'));

qjTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        qjTabButtons.forEach(b => b.classList.toggle('active', b === btn));
        qjTabPanels.forEach(p => p.classList.toggle('active', p.dataset.tabPanel === btn.dataset.tab));

        if (btn.dataset.tab === 'page') {
            // Make sure page math can run on the full index, then show state.
            ensureMovieIndex()
                .then(() => { updatePagePreview(); })
                .catch(() => { refreshPageTabStatus(); });
        }
    });
});

// --- Helpers ---
function setJumpStatus(el, message, kind = '') {
    el.textContent = message;
    el.className = 'jump-status' + (kind ? ' ' + kind : '');
}

function setJumpButtonsDisabled(selector, disabled) {
    document.querySelectorAll(selector).forEach(btn => { btn.disabled = disabled; });
}

// Quick jump replaces the normal paged listing with a fixed result set, so
// infinite scroll / Load More must not append unrelated pages to it.
function renderJumpResults(movies, positionLabel) {
    hasMoreResults = false;
    currentOffset = 0;
    lastFetchOffset = 0;
    currentMovies = movies;   // slideshow/analytics follow the jump result set
    renderGrid(movies);
    currentPosition.textContent = positionLabel;
    contentArea.scrollTop = 0;
}

// --- Collection info ---
async function updateCollectionInfo() {
    try {
        const response = await fetch(`api.php?action=stats&archive=${showParipakva ? 1 : 0}`);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const data = await response.json();
        const total = Number(data.totalMovies) || 0;
        totalMoviesCount.textContent = total.toLocaleString();

        // Keep the cached index honest: size mismatch → background refresh.
        validateMovieIndexCount(total);

        if (!currentPosition.textContent) {
            currentPosition.textContent = `Movie #1 of ${total.toLocaleString()}`;
        }
    } catch (error) {
        console.error('Error fetching collection info:', error);
        totalMoviesCount.textContent = '—';
    }
}

// ============================================
// Jump to Movie Number
// ============================================
async function jumpToNumber() {
    const num = parseInt(jumpToNumberInput.value, 10);

    if (!num || num < 1) {
        setJumpStatus(jumpNumberStatus, 'Please enter a movie number above 0.', 'error');
        return;
    }

    setJumpStatus(jumpNumberStatus, 'Searching...');
    jumpNumberBtn.disabled = true;

    try {
        const response = await fetch(
            `api.php?action=get_movie_by_num&num=${encodeURIComponent(num)}&archive=${showParipakva ? 1 : 0}`
        );
        const data = await response.json();

        if (data.success && data.movie) {
            renderJumpResults([data.movie], `Movie #${num}`);
            setJumpStatus(jumpNumberStatus, `✓ Found: ${data.movie.title}`, 'success');

            setTimeout(closeQuickJumpPanel, 1000);
        } else {
            setJumpStatus(jumpNumberStatus, data.message || 'Movie not found', 'error');
        }
    } catch (error) {
        console.error('Error jumping to movie:', error);
        setJumpStatus(jumpNumberStatus, 'Error fetching movie', 'error');
    } finally {
        jumpNumberBtn.disabled = false;
    }
}

jumpNumberBtn.addEventListener('click', jumpToNumber);

jumpToNumberInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        jumpToNumber();
    }
});

// Live preview from the cached index while typing a movie number
jumpToNumberInput.addEventListener('input', () => {
    const num = parseInt(jumpToNumberInput.value, 10);
    if (!num || num < 1) {
        setJumpStatus(jumpNumberStatus, 'Enter a movie # and press Go.');
        return;
    }
    if (movieIndexSource === indexSourceName() && movieIndex.length > 0) {
        const entry = indexMovieByNum(num);
        if (entry) {
            const year = parseInt(entry.year, 10);
            setJumpStatus(jumpNumberStatus,
                `#${num} — ${entry.title}${year ? ' (' + year + ')' : ''}`, 'success');
        } else {
            setJumpStatus(jumpNumberStatus, `#${num} is not in the ${indexSourceName()} index.`, 'error');
        }
    }
});

// ============================================
// Index result list (shared by Letter/Decade)
// ============================================

/**
 * Render the FULL (uncapped) list of index matches inside the panel.
 * Clicking a row jumps the grid to that movie (or opens the modal when the
 * current filters make page math impossible).
 */
function renderIndexResults(container, matches) {
    container.innerHTML = '';

    matches.forEach(entry => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'qj-result-row';
        row.title = isSequentialIndexState()
            ? 'Jump the grid to this movie\'s page'
            : 'Open movie details';

        const num = document.createElement('span');
        num.className = 'qj-result-num';
        num.textContent = '#' + entry.num;

        const title = document.createElement('span');
        title.className = 'qj-result-title';
        title.textContent = entry.title || '(untitled)';

        row.appendChild(num);
        row.appendChild(title);

        const year = parseInt(entry.year, 10);
        if (year) {
            const y = document.createElement('span');
            y.className = 'qj-result-year';
            y.textContent = year;
            row.appendChild(y);
        }

        row.addEventListener('click', () => jumpToIndexedMovie(entry));
        container.appendChild(row);
    });
}

/** Click on one row of the letter/decade result list. */
async function jumpToIndexedMovie(entry) {
    // Preferred: jump the sequential grid to the page containing this movie.
    if (isSequentialIndexState()) {
        const pos = indexPositionOfNum(entry.num);
        if (pos !== -1) {
            const page = Math.floor(pos / currentLimit) + 1;
            closeQuickJumpPanel();
            try {
                await fetchMovies(searchInput.value, (page - 1) * currentLimit, false);
                highlightCardByNum(entry.num);
            } catch (err) {
                console.error('Page jump failed:', err);
            }
            return;
        }
    }

    // Filtered/unsorted state: page math is impossible — open details instead.
    try {
        const response = await fetch(
            `api.php?action=get_movie_by_num&num=${encodeURIComponent(entry.num)}&archive=${showParipakva ? 1 : 0}`
        );
        const data = await response.json();
        if (data.success && data.movie) {
            closeQuickJumpPanel();
            openModal(data.movie);
        } else {
            showToast(`Could not load movie #${entry.num}`, 'error');
        }
    } catch (error) {
        console.error('Error loading movie:', error);
        showToast('Error loading movie', 'error');
    }
}

/** Spotlight a freshly rendered card/row so the user finds it immediately. */
function highlightCardByNum(num) {
    requestAnimationFrame(() => {
        const card = contentArea.querySelector(`.movie-card[data-num="${num}"], tr[data-num="${num}"]`);
        if (!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('card-highlight');
        setTimeout(() => card.classList.remove('card-highlight'), 3200);
    });
}

// ============================================
// Jump to Letter (cached index first)
// ============================================
document.querySelectorAll('.jump-letter-btn').forEach(btn => {
    btn.addEventListener('click', () => jumpToLetter(btn.dataset.letter));
});

async function jumpToLetter(letter) {
    setJumpStatus(jumpLetterStatus, 'Searching...');
    setJumpButtonsDisabled('.jump-letter-btn', true);

    try {
        await ensureMovieIndex();
        const matches = indexMoviesStartingWith(letter);
        renderIndexResults(jumpLetterResults, matches);

        if (matches.length > 0) {
            setJumpStatus(jumpLetterStatus,
                `✓ ${matches.length.toLocaleString()} movie(s) starting with "${letter}" — click one to jump`,
                'success');
        } else {
            setJumpStatus(jumpLetterStatus, `No movies found starting with "${letter}"`, 'error');
        }
    } catch (error) {
        // Index unavailable — fall back to the capped server endpoint.
        await jumpToLetterViaServer(letter);
    } finally {
        setJumpButtonsDisabled('.jump-letter-btn', false);
    }
}

async function jumpToLetterViaServer(letter) {
    try {
        const response = await fetch(
            `api.php?action=get_movies_by_letter&letter=${encodeURIComponent(letter)}&limit=100&archive=${showParipakva ? 1 : 0}`
        );
        const data = await response.json();

        if (data.success && data.movies && data.movies.length > 0) {
            renderJumpResults(data.movies, `Titles starting with "${letter}"`);
            setJumpStatus(jumpLetterStatus,
                `✓ Showing first ${data.count} movie(s) starting with "${letter}" (full index unavailable)`,
                'success');
            setTimeout(closeQuickJumpPanel, 1000);
        } else if (data.success) {
            setJumpStatus(jumpLetterStatus, `No movies found starting with "${letter}"`, 'error');
        } else {
            setJumpStatus(jumpLetterStatus, data.error || 'Error fetching movies', 'error');
        }
    } catch (error) {
        console.error('Error jumping to letter:', error);
        setJumpStatus(jumpLetterStatus, 'Error fetching movies', 'error');
    }
}

// ============================================
// Jump to Decade (cached index first)
// ============================================
document.querySelectorAll('.jump-decade-btn').forEach(btn => {
    btn.addEventListener('click', () => jumpToDecade(btn.dataset.decade));
});

async function jumpToDecade(decade) {
    setJumpStatus(jumpDecadeStatus, 'Searching...');
    setJumpButtonsDisabled('.jump-decade-btn', true);

    try {
        await ensureMovieIndex();
        const matches = indexMoviesInDecade(decade);
        renderIndexResults(jumpDecadeResults, matches);

        if (matches.length > 0) {
            setJumpStatus(jumpDecadeStatus,
                `✓ ${matches.length.toLocaleString()} movie(s) from the ${decade}s — click one to jump`,
                'success');
        } else {
            setJumpStatus(jumpDecadeStatus, `No movies found from the ${decade}s`, 'error');
        }
    } catch (error) {
        await jumpToDecadeViaServer(decade);
    } finally {
        setJumpButtonsDisabled('.jump-decade-btn', false);
    }
}

async function jumpToDecadeViaServer(decade) {
    const yearFrom = parseInt(decade, 10);
    const yearTo = yearFrom + 9;

    try {
        const response = await fetch(
            `api.php?action=get_movies_by_decade&from=${yearFrom}&to=${yearTo}&limit=100&archive=${showParipakva ? 1 : 0}`
        );
        const data = await response.json();

        if (data.success && data.movies && data.movies.length > 0) {
            renderJumpResults(data.movies, `Movies from the ${decade}s`);
            setJumpStatus(jumpDecadeStatus,
                `✓ Showing first ${data.count} movie(s) from the ${decade}s (full index unavailable)`,
                'success');
            setTimeout(closeQuickJumpPanel, 1000);
        } else if (data.success) {
            setJumpStatus(jumpDecadeStatus, `No movies found from the ${decade}s`, 'error');
        } else {
            setJumpStatus(jumpDecadeStatus, data.error || 'Error fetching movies', 'error');
        }
    } catch (error) {
        console.error('Error jumping to decade:', error);
        setJumpStatus(jumpDecadeStatus, 'Error fetching movies', 'error');
    }
}

// ============================================
// Jump to Page (sequential list navigation)
// ============================================

function currentPageNumber() {
    return Math.floor(lastFetchOffset / currentLimit) + 1;
}

/** Status line for the Page tab: current window + total pages. */
function refreshPageTabStatus() {
    if (!jumpPageStatus) return;

    const totalPages = sequentialTotalPages(currentLimit);
    const total = isSequentialIndexState() ? movieIndex.length : lastTotalMatches;

    if (totalPages > 0) {
        setJumpStatus(jumpPageStatus,
            `${currentLimit} movies per page · currently page ${currentPageNumber().toLocaleString()} of ${totalPages.toLocaleString()}` +
            (total ? ` (${total.toLocaleString()} movies)` : ''));
    } else {
        setJumpStatus(jumpPageStatus, `${currentLimit} movies per page · enter a page number and press Go.`);
    }
}

/** Live preview: which movie starts the typed page number? */
function updatePagePreview() {
    const page = parseInt(jumpToPageInput.value, 10);

    if (isNaN(page) || page < 1) {
        refreshPageTabStatus();
        return;
    }

    const totalPages = sequentialTotalPages(currentLimit);

    if (totalPages > 0 && page > totalPages) {
        setJumpStatus(jumpPageStatus,
            `Only ${totalPages.toLocaleString()} page(s) — Go jumps to the last one.`, 'error');
        return;
    }

    const entry = indexPageStartEntry(page, currentLimit);
    if (entry) {
        const year = parseInt(entry.year, 10);
        setJumpStatus(jumpPageStatus,
            `Page ${page.toLocaleString()} starts with #${entry.num} — ${entry.title}${year ? ' (' + year + ')' : ''}`,
            'success');
    } else if (totalPages > 0) {
        setJumpStatus(jumpPageStatus,
            `Page ${page.toLocaleString()} of ${totalPages.toLocaleString()} — press Go to load it.`);
    } else {
        setJumpStatus(jumpPageStatus, 'Press Go to load that page.');
    }
}

/** Jump the main grid to page N of the current result set. */
async function jumpToPage(requestedPage) {
    let page = parseInt(requestedPage, 10);
    if (isNaN(page) || page < 1) {
        setJumpStatus(jumpPageStatus, 'Please enter a page number above 0.', 'error');
        return false;
    }

    const totalPages = sequentialTotalPages(currentLimit);
    if (totalPages > 0 && page > totalPages) {
        page = totalPages;   // clamp to the last real page
    }

    const offset = (page - 1) * currentLimit;
    setJumpStatus(jumpPageStatus, `Loading page ${page.toLocaleString()}...`);
    closeQuickJumpPanel();

    try {
        await fetchMovies(searchInput.value, offset, false);
        const started = indexPageStartEntry(page, currentLimit);
        if (started) highlightCardByNum(started.num);
        return true;
    } catch (err) {
        console.error('Page jump failed:', err);
        setJumpStatus(jumpPageStatus, 'Page jump failed.', 'error');
        return false;
    }
}

jumpPageBtn.addEventListener('click', () => jumpToPage(jumpToPageInput.value));

jumpToPageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        jumpToPage(jumpToPageInput.value);
    }
});

jumpToPageInput.addEventListener('input', updatePagePreview);

jumpPagePrev.addEventListener('click', () => {
    jumpToPage(Math.max(1, currentPageNumber() - 1));
});

jumpPageNext.addEventListener('click', () => {
    jumpToPage(currentPageNumber() + 1);
});
