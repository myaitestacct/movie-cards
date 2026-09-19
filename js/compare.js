// ============================================
// COMPARE: Side-by-Side Movie Comparison Tool
// ============================================

const MAX_COMPARE_ITEMS = 4;

// Load saved compare list from localStorage if available
function loadSavedCompare() {
    try {
        const saved = JSON.parse(localStorage.getItem(COMPARE_KEY));
        if (Array.isArray(saved)) compareList = saved;
    } catch (e) {
        compareList = [];
    }
    updateCompareBarUI();
}

function saveCompareList() {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(compareList));
}

// --- Toggle Movie in Compare List ---
function toggleCompareMovie(movie) {
    if (!movie || !movie.num) return false;

    const idx = compareList.findIndex(m => m.num === movie.num);
    if (idx >= 0) {
        compareList.splice(idx, 1);
        showToast(`Removed "${movie.title}" from comparison`, 'info');
    } else {
        if (compareList.length >= MAX_COMPARE_ITEMS) {
            showToast(`You can compare up to ${MAX_COMPARE_ITEMS} movies at a time`, 'warning');
            return false;
        }
        compareList.push(movie);
        showToast(`Added "${movie.title}" to comparison (${compareList.length}/${MAX_COMPARE_ITEMS})`, 'success');
    }

    saveCompareList();
    updateCompareBarUI();
    updateCompareButtonsOnCards();
    return compareList.some(m => m.num === movie.num);
}

function isMovieInCompare(num) {
    return compareList.some(m => m.num === num);
}

function clearCompareList() {
    compareList = [];
    saveCompareList();
    updateCompareBarUI();
    updateCompareButtonsOnCards();
    showToast('Comparison list cleared', 'info');
}

// --- Update Floating Compare Tray in DOM ---
function updateCompareBarUI() {
    let tray = document.getElementById('compare-tray');

    if (compareList.length === 0) {
        if (tray) tray.classList.remove('visible');
        return;
    }

    if (!tray) {
        tray = createElement('div', 'compare-tray', '', { id: 'compare-tray' });
        document.body.appendChild(tray);
    }

    let itemsHtml = '';
    compareList.forEach((m) => {
        const posterSrc = m.poster || '';
        itemsHtml += `
            <div class="compare-tray-item" data-num="${escapeAttr(m.num)}">
                <img class="tray-item-poster" src="${escapeAttr(posterSrc)}" alt="${escapeAttr(m.title)}" />
                <span class="tray-item-title">${escapeHtml(m.title)}</span>
                <button class="tray-item-remove" data-num="${escapeAttr(m.num)}" title="Remove">&times;</button>
            </div>
        `;
    });

    tray.innerHTML = `
        <div class="compare-tray-inner">
            <div class="compare-tray-label">
                <strong>Compare (${compareList.length}/${MAX_COMPARE_ITEMS})</strong>
            </div>
            <div class="compare-tray-items">
                ${itemsHtml}
            </div>
            <div class="compare-tray-actions">
                <button class="compare-btn-clear" id="tray-clear-btn">Clear</button>
                <button class="compare-btn-launch" id="tray-launch-btn">Compare Now &rarr;</button>
            </div>
        </div>
    `;

    tray.classList.add('visible');

    // Broken posters fall back to an inline placeholder (no inline handler needed)
    tray.querySelectorAll('.tray-item-poster').forEach(img => {
        img.addEventListener('error', () => {
            img.src = 'data:image/svg+xml,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="44"><rect width="30" height="44" fill="#222"/></svg>');
        }, { once: true });
    });

    // Wire events
    tray.querySelector('#tray-clear-btn').addEventListener('click', clearCompareList);
    tray.querySelector('#tray-launch-btn').addEventListener('click', openCompareModal);

    tray.querySelectorAll('.tray-item-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const num = parseInt(btn.dataset.num);
            const m = compareList.find(item => item.num === num);
            if (m) toggleCompareMovie(m);
        });
    });
}

// --- Update Compare Buttons on Movie Cards ---
function updateCompareButtonsOnCards() {
    document.querySelectorAll('.compare-card-btn').forEach(btn => {
        const num = parseInt(btn.dataset.num);
        const inComp = isMovieInCompare(num);
        btn.classList.toggle('active', inComp);
        btn.title = inComp ? 'Remove from comparison' : 'Add to comparison';
    });
}

// --- Open Comparison Modal Dialog ---
function openCompareModal() {
    if (compareList.length < 2) {
        showToast('Please select at least 2 movies to compare', 'warning');
        return;
    }

    let dialog = document.getElementById('compare-modal');
    if (!dialog) {
        dialog = createElement('dialog', 'glass-panel compare-dialog', '', { id: 'compare-modal' });
        document.body.appendChild(dialog);
    }

    renderCompareMatrix(dialog);
    dialog.showModal();
}

// --- Render Comparison Matrix ---
function renderCompareMatrix(dialog) {
    clearContainer(dialog);

    // Calculate highest rating to highlight winner
    const ratings = compareList.map(m => parseFloat(m.rating) || 0);
    const maxRating = Math.max(...ratings);

    let columnsHtml = '';

    compareList.forEach((m) => {
        const ratingVal = parseFloat(m.rating) || 0;
        const isWinner = ratingVal > 0 && ratingVal === maxRating;
        const posterSrc = m.poster || '';
        const isFav = isFavorite(m.num);

        // Subtitles list
        let subsHtml = '<span class="matrix-val-empty">None</span>';
        if (m.subtitles) {
            const subs = parseSubtitles(m.subtitles);
            if (subs.length > 0) {
                subsHtml = subs.map(s => `<span class="sub-chip-mini">${s.flag} ${escapeHtml(s.language)}</span>`).join(' ');
            }
        }

        columnsHtml += `
            <div class="compare-col" data-num="${escapeAttr(m.num)}">
                <!-- Header with Poster & Title -->
                <div class="compare-col-header">
                    <button class="compare-remove-col" data-num="${escapeAttr(m.num)}" title="Remove from comparison">&times;</button>
                    <div class="compare-poster-wrap">
                        <img src="${escapeAttr(posterSrc)}" alt="${escapeAttr(m.title)}" class="compare-poster" />
                        ${isWinner ? '<div class="compare-winner-badge">⭐ TOP RATED</div>' : ''}
                    </div>
                    <h3 class="compare-title">${escapeHtml(m.title)}</h3>
                    <span class="compare-year-badge">${escapeHtml(m.year || 'N/A')}</span>
                </div>

                <!-- Comparison Specs Matrix Rows -->
                <div class="compare-matrix-rows">
                    <!-- Rating Row -->
                    <div class="matrix-cell ${isWinner ? 'winner-cell' : ''}">
                        <span class="matrix-label">Rating</span>
                        <div class="matrix-rating-bar">
                            <span class="matrix-rating-val">⭐ ${ratingVal.toFixed(1)} / 10</span>
                            <div class="matrix-bar-track">
                                <div class="matrix-bar-fill" style="width: ${Math.min(ratingVal * 10, 100)}%;"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Genre Row -->
                    <div class="matrix-cell">
                        <span class="matrix-label">Genre</span>
                        <span class="matrix-val">${escapeHtml(m.genre || 'Unknown')}</span>
                    </div>

                    <!-- Runtime Row -->
                    <div class="matrix-cell">
                        <span class="matrix-label">Runtime</span>
                        <span class="matrix-val">${escapeHtml(m.length || 'N/A')}</span>
                    </div>

                    <!-- Certification -->
                    <div class="matrix-cell">
                        <span class="matrix-label">Certification</span>
                        <span class="matrix-val">${escapeHtml(m.certification || 'Unrated')}</span>
                    </div>

                    <!-- Director -->
                    <div class="matrix-cell">
                        <span class="matrix-label">Director</span>
                        <span class="matrix-val">${escapeHtml(m.director || 'Unknown')}</span>
                    </div>

                    <!-- Cast -->
                    <div class="matrix-cell">
                        <span class="matrix-label">Cast</span>
                        <span class="matrix-val matrix-cast">${escapeHtml(m.actors || 'Unknown')}</span>
                    </div>

                    <!-- Resolution & Audio -->
                    <div class="matrix-cell">
                        <span class="matrix-label">Video &amp; Audio</span>
                        <div class="matrix-tags">
                            <span class="matrix-tag">📺 ${escapeHtml(m.resolution || 'N/A')}</span>
                            <span class="matrix-tag">🔊 ${escapeHtml(m.audio || 'N/A')}</span>
                        </div>
                    </div>

                    <!-- File Size -->
                    <div class="matrix-cell">
                        <span class="matrix-label">File Size</span>
                        <span class="matrix-val">${escapeHtml(m.size || 'N/A')}</span>
                    </div>

                    <!-- Country -->
                    <div class="matrix-cell">
                        <span class="matrix-label">Country</span>
                        <span class="matrix-val">${escapeHtml(m.country || 'N/A')}</span>
                    </div>

                    <!-- Subtitles -->
                    <div class="matrix-cell">
                        <span class="matrix-label">Subtitles</span>
                        <div class="matrix-subtitles">${subsHtml}</div>
                    </div>

                    <!-- Synopsis -->
                    <div class="matrix-cell matrix-desc-cell">
                        <span class="matrix-label">Synopsis</span>
                        <p class="matrix-desc">${escapeHtml(m.description || 'No overview available.')}</p>
                    </div>
                </div>

                <!-- Action Footer -->
                <div class="compare-col-footer">
                    <button class="compare-fav-btn ${isFav ? 'active' : ''}" data-num="${escapeAttr(m.num)}">♥ Favorite</button>
                    <button class="compare-details-btn" data-num="${escapeAttr(m.num)}">Full Details &rarr;</button>
                </div>
            </div>
        `;
    });

    dialog.innerHTML = `
        <div class="compare-modal-content">
            <div class="compare-modal-header">
                <div class="compare-modal-title">
                    <h2>⚖ Movie Comparison Matrix</h2>
                    <p class="compare-modal-sub">Side-by-side technical and cinematic specification analysis</p>
                </div>
                <button class="close-btn" id="close-compare-modal">&times;</button>
            </div>

            <div class="compare-grid-scroll">
                <div class="compare-grid columns-${compareList.length}">
                    ${columnsHtml}
                </div>
            </div>
        </div>
    `;

    // Wire events inside modal
    dialog.querySelector('#close-compare-modal').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
    });

    // Remove column buttons
    dialog.querySelectorAll('.compare-remove-col').forEach(btn => {
        btn.addEventListener('click', () => {
            const num = parseInt(btn.dataset.num);
            const m = compareList.find(item => item.num === num);
            if (m) toggleCompareMovie(m);
            if (compareList.length >= 2) {
                renderCompareMatrix(dialog);
            } else {
                dialog.close();
            }
        });
    });

    // Favorite buttons
    dialog.querySelectorAll('.compare-fav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const num = parseInt(btn.dataset.num);
            const isFav = toggleFavorite(num);
            btn.classList.toggle('active', isFav);
            fetchStats();
            updateFavoritesChipCount();
        });
    });

    // Details buttons
    dialog.querySelectorAll('.compare-details-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const num = parseInt(btn.dataset.num);
            const m = compareList.find(item => item.num === num);
            if (m) {
                dialog.close();
                openModal(m);
            }
        });
    });

    // Poster fallbacks
    dialog.querySelectorAll('.compare-poster').forEach(img => {
        img.addEventListener('error', () => {
            img.src = 'data:image/svg+xml,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#1a1a1a"/><text x="100" y="155" text-anchor="middle" fill="#555" font-family="sans-serif" font-size="14">No Poster</text></svg>');
        }, { once: true });
    });
}
