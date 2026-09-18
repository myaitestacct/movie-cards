// ============================================
// RENDER: Grid, Table, Poster Glow, Badges
// ============================================

// --- Poster Glow ---
function getPosterGlow(img, glowEl) {
    if (!img.complete || img.naturalWidth === 0) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    canvas.width = 20;
    canvas.height = 20;

    ctx.drawImage(img, 0, 0, 20, 20);

    const pixels = ctx.getImageData(0, 0, 20, 20).data;
    let r = 0, g = 0, b = 0, count = 0;

    for (let i = 0; i < pixels.length; i += 4) {
        r += pixels[i];
        g += pixels[i + 1];
        b += pixels[i + 2];
        count++;
    }

    r = Math.floor(r / count);
    g = Math.floor(g / count);
    b = Math.floor(b / count);

    glowEl.style.background =
        `radial-gradient(circle, rgba(${r},${g},${b},0.65) 0%, transparent 70%)`;
}

// --- Render Grid ---
function renderGrid(movies, append = false) {
    // A fresh render invalidates the focused-card index tracked by
    // keyboard-nav.js (resetCardFocus is guarded so render.js stays standalone).
    if (!append && typeof resetCardFocus === 'function') resetCardFocus();

    let grid = contentArea.querySelector('.movie-grid');

    if (!grid || !append) {
        grid = createElement('div', 'movie-grid');
        if (!append) clearContainer(contentArea);
        contentArea.appendChild(grid);
    }

    movies.forEach(movie => {
        const card = createElement('div', 'movie-card');
        card.dataset.num = movie.num;
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `${movie.title} - ${movie.year}`);

        /* POSTER WRAPPER */
        const posterWrapper = createElement('div', 'poster-wrapper loading');

        const glow = createElement('div', 'poster-glow');
        posterWrapper.appendChild(glow);

        const img = createElement('img');
        img.src = movie.poster || 'placeholder.jpg';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = movie.formattedtitle || movie.title || 'Movie Poster';

        img.onerror = () => {
            img.onerror = null;
            img.src = 'data:image/svg+xml,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300">
                    <rect width="200" height="300" fill="#1a1a1a"/>
                    <g transform="translate(100,130)" fill="none" stroke="#444" stroke-width="2">
                        <rect x="-25" y="-35" width="50" height="70" rx="4"/>
                        <circle cx="0" cy="-10" r="12"/>
                        <path d="M-18 25 L-8 10 L0 18 L8 5 L18 25"/>
                    </g>
                    <text x="100" y="200" text-anchor="middle" fill="#555" font-family="sans-serif" font-size="12">No Poster</text>
                </svg>
            `);
            posterWrapper.classList.remove('loading');
            posterWrapper.classList.add('loaded');
        };

        img.onload = () => {
            posterWrapper.classList.remove('loading');
            posterWrapper.classList.add('loaded');
            try {
                getPosterGlow(img, glow);
            } catch (e) {
                console.warn('Glow skipped:', e);
            }
        };

        // Source badge
        if (movie.source === 'paripakva') {
            const sourceBadge = createElement('div', 'movie-badge badge-source', '18+');
            sourceBadge.style.backgroundColor = 'purple';
            sourceBadge.style.color = '#fff';
            posterWrapper.appendChild(sourceBadge);
        }

        posterWrapper.appendChild(img);

        /* BADGES */
        const createBadge = (text, cls) => {
            const badge = createElement('div', `movie-badge ${cls}`);
            badge.textContent = text;
            return badge;
        };

        if (movie.certification) {
            posterWrapper.appendChild(createBadge(`🎬 ${movie.certification}`, 'badge-cert'));
        }

        if (movie.length) {
            posterWrapper.appendChild(createBadge(`⏱ ${movie.length}`, 'badge-length'));
        }

        const ratingVal = parseFloat(movie.rating) || 0;

        if (ratingVal > 0) {
            const ratingBadge = createBadge(`⭐ ${ratingVal.toFixed(1)}`, 'badge-rating');
            if (movie.external_url) {
                ratingBadge.style.cursor = 'pointer';
                ratingBadge.title = 'Open external rating';
                ratingBadge.addEventListener('click', e => {
                    e.stopPropagation();
                    window.open(movie.external_url, '_blank');
                });
            }
            posterWrapper.appendChild(ratingBadge);
        }

        if (movie.year) {
            posterWrapper.appendChild(createBadge(`📅 ${movie.year}`, 'badge-year'));
        }

        // Hover Info
        const hoverInfo = createElement('div', 'hover-info');
        const descSize = 180;
        const descText = movie.description
            ? (movie.description.length > descSize ? movie.description.slice(0, descSize) + '…' : movie.description)
            : 'No description available.';
        hoverInfo.innerHTML = highlightSearchTerm(descText, searchInput.value);
        posterWrapper.appendChild(hoverInfo);

        /* INFO SECTION */
        const info = createElement('div', 'card-info');
        const titleText = `${movie.num} - ${movie.title}`;
        const title = createElement('div', 'card-title');
        title.innerHTML = highlightSearchTerm(titleText, searchInput.value);
        title.setAttribute('title', titleText);
        title.style.whiteSpace = 'normal';
        title.style.wordBreak = 'break-word';

        const meta = createElement('div', 'card-meta');
        if (movie.genre) {
            const genreSpan = createElement('span');
            genreSpan.innerHTML = highlightSearchTerm(movie.genre, searchInput.value);
            meta.appendChild(genreSpan);
        }

        info.append(title, meta);
        card.append(posterWrapper, info);

        // Favorite heart button
        const favBtn = createElement('button', 'fav-btn' + (isFavorite(movie.num) ? ' active' : ''), '♥');
        favBtn.title = isFavorite(movie.num) ? 'Remove from favorites' : 'Add to favorites';
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const nowFav = toggleFavorite(movie.num);
            favBtn.classList.toggle('active', nowFav);
            favBtn.title = nowFav ? 'Remove from favorites' : 'Add to favorites';
            showToast(
                nowFav ? '♥ Added to favorites' : 'Removed from favorites',
                nowFav ? 'success' : 'info'
            );
            fetchStats();
            updateFavoritesChipCount();
            if (currentCategory === '__favorites__') {
                fetchMovies(searchInput.value, 0, false);
            }
        });
        card.appendChild(favBtn);

        card.addEventListener('click', () => openModal(movie));
        grid.appendChild(card);
    });
}

// --- Render Table ---
function renderTable(movies, append = false) {
    // See renderGrid(): reset the focused-card index on a fresh render
    if (!append && typeof resetCardFocus === 'function') resetCardFocus();

    let table = contentArea.querySelector('.movie-table');
    let tbody = table ? table.querySelector('tbody') : null;

    if (!table || !append) {
        table = createElement('table', 'movie-table');
        const thead = createElement('thead');
        tbody = createElement('tbody');

        const headerRow = createElement('tr');
        ['', '#', 'Cover', 'Title', 'Certification', 'Year', 'Category', 'Rating'].forEach(h => {
            headerRow.appendChild(createElement('th', '', h));
        });
        thead.appendChild(headerRow);
        table.append(thead, tbody);
        if (!append) clearContainer(contentArea);
        contentArea.appendChild(table);
    }

    movies.forEach(movie => {
        const row = createElement('tr');
        row.dataset.num = movie.num;
        row.setAttribute('tabindex', '0');
        row.setAttribute('role', 'button');
        row.setAttribute('aria-label', `${movie.title} - ${movie.year}`);

        // Favorite heart cell
        const tdFav = createElement('td');
        const favBtn = createElement('button', 'fav-btn' + (isFavorite(movie.num) ? ' active' : ''), '♥');
        favBtn.title = isFavorite(movie.num) ? 'Remove from favorites' : 'Add to favorites';
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const nowFav = toggleFavorite(movie.num);
            favBtn.classList.toggle('active', nowFav);
            favBtn.title = nowFav ? 'Remove from favorites' : 'Add to favorites';
            showToast(
                nowFav ? '♥ Added to favorites' : 'Removed from favorites',
                nowFav ? 'success' : 'info'
            );
            fetchStats();
            updateFavoritesChipCount();
            if (currentCategory === '__favorites__') {
                fetchMovies(searchInput.value, 0, false);
            }
        });
        tdFav.appendChild(favBtn);

        const tdNum = createElement('td', 'num-cell', `#${movie.num}`);
        Object.assign(tdNum.style, { fontWeight: '600', color: 'var(--accent)', minWidth: '50px' });

        const tdImg = createElement('td');
        const img = createElement('img', 'table-poster', '', { src: movie.poster, loading: 'lazy' });
        img.onerror = () => {
            img.onerror = null;
            img.src = 'data:image/svg+xml,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="60" viewBox="0 0 40 60">
                    <rect width="40" height="60" fill="#1a1a1a"/>
                    <text x="20" y="35" text-anchor="middle" fill="#555" font-family="sans-serif" font-size="8">N/A</text>
                </svg>
            `);
        };
        tdImg.appendChild(img);

        const tdTitle = createElement('td');
        tdTitle.innerHTML = highlightSearchTerm(movie.title, searchInput.value);
        const tdCert = createElement('td');
        tdCert.innerHTML = highlightSearchTerm(movie.certification, searchInput.value);
        const tdYear = createElement('td');
        tdYear.innerHTML = highlightSearchTerm(movie.year, searchInput.value);
        const tdGenre = createElement('td');
        tdGenre.innerHTML = highlightSearchTerm(movie.genre, searchInput.value);

        const tdRating = createElement('td');
        const ratingVal = parseFloat(movie.rating) || 0;
        const ratingText = ratingVal > 0 ? `★ ${ratingVal}` : '-';

        if (movie.external_url && ratingVal > 0) {
            const link = createElement('a', '', ratingText, {
                href: movie.external_url,
                target: '_blank',
                rel: 'noopener noreferrer',
                title: 'Open external link'
            });
            Object.assign(link.style, { color: 'var(--accent)', textDecoration: 'none' });
            link.addEventListener('click', e => e.stopPropagation());
            tdRating.appendChild(link);
        } else {
            tdRating.textContent = ratingText;
            if (ratingVal === 0) tdRating.style.opacity = '0.5';
        }

        // Source badge for paripakva in table view
        if (movie.source === 'paripakva') {
            const sourceBadge = createElement('span', '', '18+');
            Object.assign(sourceBadge.style, {
                backgroundColor: 'purple',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: '600',
                marginLeft: '6px'
            });
            tdTitle.appendChild(sourceBadge);
        }

        row.append(tdFav, tdNum, tdImg, tdTitle, tdCert, tdYear, tdGenre, tdRating);
        row.dataset.poster = movie.poster;
        row.addEventListener('click', () => openModal(movie));

        // Poster preview on hover
        row.addEventListener('mouseenter', (e) => showTablePosterPreview(movie.poster, e));
        row.addEventListener('mousemove', (e) => moveTablePosterPreview(e));
        row.addEventListener('mouseleave', () => hideTablePosterPreview());

        tbody.appendChild(row);
    });
}

// --- Load More Button ---
function addLoadMoreButton() {
    const existing = contentArea.querySelector('.load-more-btn');
    if (existing) existing.remove();

    const btn = createElement('button', 'load-more-btn', 'Load More Movies');
    btn.style.gridColumn = '1 / -1';
    btn.addEventListener('click', () => {
        const scrollTarget = btn.offsetTop - 20;
        btn.disabled = true;
        btn.textContent = 'Loading...';
        fetchMovies(currentQuery, currentOffset, true).finally(() => {
            if (btn.parentNode) btn.remove();
            contentArea.scrollTo({ top: scrollTarget, behavior: 'smooth' });
        });
    });
    contentArea.appendChild(btn);
}

// --- Certification Badge ---
function createCertificationBadge(certText) {
    if (!certText) return null;
    const badge = createElement('div', 'cert-badge', 'Rated: ' + certText);
    return badge;
}

// --- Table Poster Preview ---
let tablePreviewEl = null;

function showTablePosterPreview(posterUrl, e) {
    if (!posterUrl) return;
    hideTablePosterPreview();
    tablePreviewEl = document.createElement('div');
    tablePreviewEl.className = 'table-poster-preview';
    const img = document.createElement('img');
    img.src = posterUrl;
    img.alt = 'Poster preview';
    tablePreviewEl.appendChild(img);
    document.body.appendChild(tablePreviewEl);
    moveTablePosterPreview(e);
}

function moveTablePosterPreview(e) {
    if (!tablePreviewEl) return;
    const previewWidth = 200;
    const previewHeight = 300;
    let x = e.clientX + 20;
    let y = e.clientY - previewHeight / 2;
    if (x + previewWidth > window.innerWidth) x = e.clientX - previewWidth - 20;
    if (y < 10) y = 10;
    if (y + previewHeight > window.innerHeight) y = window.innerHeight - previewHeight - 10;
    tablePreviewEl.style.left = x + 'px';
    tablePreviewEl.style.top = y + 'px';
}

function hideTablePosterPreview() {
    if (tablePreviewEl) {
        tablePreviewEl.remove();
        tablePreviewEl = null;
    }
}