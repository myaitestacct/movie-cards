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

    // Batch all cards into a fragment so one DOM insertion replaces one per
    // movie (layout/style recalculation runs once instead of N times).
    const frag = document.createDocumentFragment();

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

        // Source badge (colors live in .movie-badge.badge-source)
        if (movie.source === 'paripakva') {
            const sourceBadge = createElement('div', 'movie-badge badge-source', '18+');
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
                ratingBadge.classList.add('badge-link');
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

        // Subtitle summary badge (subtitles.js owns the parsing/formatting)
        if (typeof getSubtitleCardBadge === 'function') {
            const subBadge = getSubtitleCardBadge(movie.subtitles);
            if (subBadge) posterWrapper.appendChild(subBadge);
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
            updateStatsFavorites();
            updateFavoritesChipCount();
            if (currentCategory === '__favorites__') {
                fetchMovies(searchInput.value, 0, false);
            }
        });
        card.appendChild(favBtn);

        // Compare toggle (compare.js owns the list state)
        if (typeof toggleCompareMovie === 'function') {
            const compareBtn = createElement('button', 'compare-card-btn' + (isMovieInCompare(movie.num) ? ' active' : ''), '⚖');
            compareBtn.dataset.num = movie.num;
            compareBtn.title = isMovieInCompare(movie.num) ? 'Remove from comparison' : 'Add to comparison';
            compareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleCompareMovie(movie);
            });
            card.appendChild(compareBtn);
        }

        card.addEventListener('click', () => openModal(movie));
        frag.appendChild(card);
    });

    grid.appendChild(frag);
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
        // className doubles as the CSS hook (responsive.css hides the Length
        // and Size columns on very narrow screens) and must match the td
        // classes assigned further below. `sort` is the API sort family; it is
        // omitted for columns the backend cannot sort by. Columns that read
        // better "largest first" open in desc (defaultDir).
        const tableColumns = [
            { label: '' },
            { label: '#', sort: 'num', defaultDir: 'asc' },
            { label: 'Cover' },
            { label: 'Title', sort: 'title', defaultDir: 'asc' },
            { label: 'Certification', className: 'cell-cert' },
            { label: 'Year', sort: 'year', defaultDir: 'desc', className: 'cell-year' },
            { label: 'Length', sort: 'length', defaultDir: 'desc', className: 'cell-length' },
            { label: 'Category', className: 'cell-category' },
            { label: 'Size', sort: 'size', defaultDir: 'desc', className: 'cell-size' },
            { label: 'Rating', sort: 'rating', defaultDir: 'desc', className: 'cell-rating' },
        ];
        tableColumns.forEach(col => {
            const th = createElement('th', col.className || '', col.label);

            if (col.sort) {
                const ascSort = col.sort + '_asc';
                const descSort = col.sort + '_desc';
                const isAsc = currentSort === ascSort;
                const isDesc = currentSort === descSort;

                th.setAttribute('data-sort', col.sort);
                th.setAttribute('tabindex', '0');
                th.setAttribute('title', 'Click to sort by ' + col.label.toLowerCase());

                if (isAsc || isDesc) {
                    th.classList.add('sorted');
                    th.setAttribute('aria-sort', isAsc ? 'ascending' : 'descending');
                    th.appendChild(createElement('span', 'sort-arrow', isAsc ? '▲' : '▼'));
                }

                // asc -> desc, desc -> asc, otherwise start on the column's
                // default direction.
                const nextSort = isAsc ? descSort : (isDesc ? ascSort : col.sort + '_' + (col.defaultDir || 'asc'));

                const applySort = () => {
                    currentSort = nextSort;
                    sortSelect.value = nextSort;
                    fetchMovies(searchInput.value, 0, false);
                };

                th.addEventListener('click', e => {
                    e.stopPropagation();
                    applySort();
                });
                th.addEventListener('keydown', e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        applySort();
                    }
                });
            }

            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.append(thead, tbody);
        if (!append) clearContainer(contentArea);
        contentArea.appendChild(table);
    }

    // One DOM insertion for the whole page batch (see renderGrid).
    const frag = document.createDocumentFragment();

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
            updateStatsFavorites();
            updateFavoritesChipCount();
            if (currentCategory === '__favorites__') {
                fetchMovies(searchInput.value, 0, false);
            }
        });
        tdFav.appendChild(favBtn);

        // Compare toggle in list view too
        if (typeof toggleCompareMovie === 'function') {
            const compareBtn = createElement('button', 'compare-card-btn compare-list-btn' + (isMovieInCompare(movie.num) ? ' active' : ''), '⚖');
            compareBtn.dataset.num = movie.num;
            compareBtn.title = isMovieInCompare(movie.num) ? 'Remove from comparison' : 'Add to comparison';
            compareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleCompareMovie(movie);
            });
            tdFav.appendChild(compareBtn);
        }

        const tdNum = createElement('td', 'num-cell', `#${movie.num}`);

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

        // Runtime (e.g. "2h 30m"). Not part of the server-side search columns,
        // so no highlight is needed here - plain text keeps it injection-safe.
        const tdLength = createElement('td', 'cell-length');
        const lengthText = (movie.length ?? '').toString().trim();
        if (lengthText) {
            tdLength.textContent = lengthText;
        } else {
            tdLength.textContent = '-';
            tdLength.classList.add('dimmed');
        }

        const tdGenre = createElement('td');
        tdGenre.innerHTML = highlightSearchTerm(movie.genre, searchInput.value);

        // File size (FILESIZE is MB in the database; formatSize() from
        // analytics.js renders it as MB/GB/TB - guarded so render.js stays
        // standalone like the rest of its helpers).
        const tdSize = createElement('td', 'cell-size');
        const sizeMb = parseFloat(movie.size);
        if (!isNaN(sizeMb) && sizeMb > 0) {
            tdSize.textContent = (typeof formatSize === 'function')
                ? formatSize(sizeMb)
                : Math.round(sizeMb) + ' MB';
            tdSize.title = sizeMb + ' MB';
        } else {
            tdSize.textContent = '-';
            tdSize.classList.add('dimmed');
        }

        const tdRating = createElement('td');
        const ratingVal = parseFloat(movie.rating) || 0;
        const ratingText = ratingVal > 0 ? `★ ${ratingVal}` : '-';

        if (movie.external_url && ratingVal > 0) {
            const link = createElement('a', 'rating-link', ratingText, {
                href: movie.external_url,
                target: '_blank',
                rel: 'noopener noreferrer',
                title: 'Open external link'
            });
            link.addEventListener('click', e => e.stopPropagation());
            tdRating.appendChild(link);
        } else {
            tdRating.textContent = ratingText;
            if (ratingVal === 0) tdRating.classList.add('dimmed');
        }

        // Source badge for paripakva in table view (styles in table.css)
        if (movie.source === 'paripakva') {
            tdTitle.appendChild(createElement('span', 'source-badge', '18+'));
        }

        row.append(tdFav, tdNum, tdImg, tdTitle, tdCert, tdYear, tdLength, tdGenre, tdSize, tdRating);
        row.dataset.poster = movie.poster;
        row.addEventListener('click', () => openModal(movie));

        // Poster preview on hover
        row.addEventListener('mouseenter', (e) => showTablePosterPreview(movie.poster, e));
        row.addEventListener('mousemove', (e) => moveTablePosterPreview(e));
        row.addEventListener('mouseleave', () => hideTablePosterPreview());

        frag.appendChild(row);
    });

    tbody.appendChild(frag);
}

// --- Load More Button ---
function addLoadMoreButton() {
    const existing = contentArea.querySelector('.load-more-btn');
    if (existing) existing.remove();

    const btn = createElement('button', 'load-more-btn', 'Load More Movies');
    btn.addEventListener('click', () => {
        const scrollTarget = btn.offsetTop - 20;
        btn.disabled = true;
        btn.textContent = 'Loading...';
        fetchMovies(currentQuery, currentOffset, true).finally(() => {
            if (btn.parentNode) btn.remove();
            contentArea.scrollTo({ top: scrollTarget, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
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