// ============================================
// MODAL: Movie Details & Lightbox
// ============================================

// --- Open Modal ---
function openModal(movie) {
    clearContainer(modalBody);

    // Modal header
    const header = createElement('div', 'modal-header');
    // Escape the characters that could terminate the url("...") string - the
    // poster path comes from the database, not from a trusted literal. Quoting
    // the URL makes every other character (spaces, commas, parentheses) safe.
    const posterUrl = String(movie.poster || '').replace(/[\\"\r\n]/g, encodeURIComponent);
    if (posterUrl) {
        header.style.backgroundImage = `url("${posterUrl}")`;
    }

    // Header top row
    const headerTop = createElement('div', 'modal-header-top');
    const title = createElement('h2');
    const numSpan = createElement('span', 'modal-num', `#${movie.num}`);
    const titleSpan = createElement('span');
    titleSpan.innerHTML = highlightSearchTerm(movie.title, searchInput.value);
    title.append(numSpan, titleSpan);
    headerTop.appendChild(title);

    // Content row
    const contentRow = createElement('div', 'modal-content-row');

    // Poster
    const posterWrapper = createElement('div', 'modal-poster-wrapper');
    const posterImg = createElement('img', 'modal-img', '', { src: movie.poster, alt: movie.title });
    posterImg.style.cursor = 'pointer';

    posterImg.onerror = () => {
        posterImg.onerror = null;
        posterImg.src = 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="350" height="500" viewBox="0 0 350 500">
                <rect width="350" height="500" fill="#1a1a1a"/>
                <g transform="translate(175,220)" fill="none" stroke="#444" stroke-width="2">
                    <rect x="-35" y="-50" width="70" height="100" rx="6"/>
                    <circle cx="0" cy="-18" r="18"/>
                    <path d="M-28 38 L-14 15 L0 28 L14 8 L28 38"/>
                </g>
                <text x="175" y="340" text-anchor="middle" fill="#555" font-family="sans-serif" font-size="16">No Poster Available</text>
            </svg>
        `);
    };

    posterImg.addEventListener('click', () => {
        const lightbox = document.getElementById('poster-lightbox');
        const lightboxImg = lightbox.querySelector('.lightbox-img');
        lightboxImg.src = movie.poster;
        lightboxImg.classList.remove('zoomed');
        lightboxImg.style.transform = '';
        lightboxImg.style.cursor = 'zoom-in';
        lightbox.classList.add('show');
    });

    posterWrapper.appendChild(posterImg);

    if (movie.certification) {
        const badge = createCertificationBadge(movie.certification);
        posterWrapper.appendChild(badge);
    }

    contentRow.appendChild(posterWrapper);

    // Details column
    const details = createElement('div', 'modal-details');

    // Meta info
    const meta = createElement('div', 'modal-meta');
    if (movie.year) {
        const yearSpan = createElement('span');
        yearSpan.innerHTML = highlightSearchTerm(movie.year, searchInput.value);
        meta.appendChild(yearSpan);
    }
    if (movie.genre) {
        const genreSpan = createElement('span');
        genreSpan.innerHTML = highlightSearchTerm(movie.genre, searchInput.value);
        meta.appendChild(genreSpan);
    }
    if (movie.length) {
        const lengthSpan = createElement('span');
        lengthSpan.innerHTML = `
            <svg class="tech-icon" width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" style="vertical-align:middle;margin-right:4px;">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${escapeHtml(movie.length)}
        `;
        meta.appendChild(lengthSpan);
    }

    const ratingVal = parseFloat(movie.rating) || 0;
    const ratingText = ratingVal > 0 ? `★ ${ratingVal}` : '-';
    const rating = movie.external_url && ratingVal > 0
        ? createElement('a', 'rating-badge', ratingText, { href: movie.external_url, target: '_blank', rel: 'noopener noreferrer', title: 'Open external link' })
        : createElement('span', 'rating-badge', ratingText);
    if (!rating.href && ratingVal === 0) rating.style.opacity = '0.5';
    if (rating.href) rating.style.cursor = 'pointer';
    meta.appendChild(rating);

    // Synopsis / director / cast
    const descP = createElement('p', 'modal-desc');
    descP.innerHTML = highlightSearchTerm(movie.description || 'No description available.', searchInput.value);
    
    const directorP = createElement('p', 'modal-director');
    directorP.innerHTML = highlightSearchTerm(movie.director || 'Unknown', searchInput.value);
    
    const castP = createElement('p', 'modal-cast');
    castP.innerHTML = highlightSearchTerm(movie.actors || 'Unknown', searchInput.value);
    
    details.append(
        meta,
        createElement('span', 'modal-label', 'SYNOPSIS'),
        descP,
        createElement('span', 'modal-label', 'DIRECTOR'),
        directorP,
        createElement('span', 'modal-label', 'CAST'),
        castP
    );

    // Subtitle tracks (subtitles.js renders the section)
    if (typeof renderModalSubtitles === 'function') {
        renderModalSubtitles(movie.subtitles, details);
    }

    // Tech details
    const techSection = createElement('div', 'tech-details');
    const inlineRow = createElement('div', 'tech-row-inline');

    const resolutionItem = createElement('div', 'tech-item');
    resolutionItem.innerHTML = `<svg class="tech-icon" width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" style="margin-right:6px;"><rect x="2" y="4" width="20" height="14" rx="2"></rect><line x1="8" y1="20" x2="16" y2="20"></line></svg><span class="tech-value">${escapeHtml(movie.resolution) || 'N/A'}</span>`;
    const audioItem = createElement('div', 'tech-item');
    audioItem.innerHTML = `<svg class="tech-icon" width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" style="margin-right:6px;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15 9a4 4 0 010 6"></path></svg><span class="tech-value">${escapeHtml(movie.audio) || 'N/A'}</span>`;
    const sizeItem = createElement('div', 'tech-item');
    sizeItem.innerHTML = `<svg class="tech-icon" width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" style="margin-right:6px;"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M8 12h8"></path></svg><span class="tech-value">${escapeHtml(movie.size) || 'N/A'}</span>`;

    inlineRow.append(sizeItem, resolutionItem, audioItem);
    techSection.appendChild(inlineRow);

    // File row
    if (movie.filepath) {
        const fullPath = movie.filepath.replace(/\\/g, '/');
        const lastSlash = fullPath.lastIndexOf('/');
        const fileName = lastSlash >= 0 ? fullPath.slice(lastSlash + 1) : fullPath;

        const fileWrapper = createElement('div', 'tech-file-wrapper');
        fileWrapper.style.marginTop = '0';

        const fileRow = createElement('div', 'tech-item tech-file-row');
        fileRow.innerHTML = `
            <svg class="tech-icon" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span class="tech-file-name">${escapeHtml(fileName) || 'N/A'}</span>
            <button class="copy-file-btn" title="Copy file name">Copy</button>
        `;
        const copyBtn = fileRow.querySelector('.copy-file-btn');
        copyBtn.addEventListener('click', e => {
            e.stopPropagation();
            navigator.clipboard.writeText(fileName).then(() => {
                copyBtn.textContent = 'Copied!';
                showToast('Filename copied to clipboard', 'success');
                setTimeout(() => copyBtn.textContent = 'Copy', 1200);
            });
        });

        fileWrapper.appendChild(fileRow);
        techSection.appendChild(fileWrapper);
    }

    details.appendChild(techSection);
    contentRow.appendChild(details);
    header.append(headerTop, contentRow);
    modalBody.appendChild(header);

    modal.showModal();
}

// --- Smooth Close Modal ---
function smoothClose() {
    modal.classList.add('closing');
    setTimeout(() => {
        modal.classList.remove('closing');
        modal.close();
    }, 260);
}

// ============================================
// LIGHTBOX: Zoom & Pan
// ============================================

const lightbox = document.getElementById('poster-lightbox');
const closeLightboxBtn = lightbox.querySelector('.close-lightbox');
const lightboxImg = lightbox.querySelector('.lightbox-img');

let isZoomed = false;
let zoomLevel = 1;
let isDragging = false;
let startX, startY, translateX = 0, translateY = 0;

function closeLightbox() {
    lightbox.classList.remove('show');
    isZoomed = false;
    zoomLevel = 1;
    translateX = 0;
    translateY = 0;
    lightboxImg.classList.remove('zoomed');
    lightboxImg.style.transform = '';
    lightboxImg.style.cursor = 'zoom-in';
}

function updateZoom() {
    if (isZoomed) {
        lightboxImg.classList.add('zoomed');
        lightboxImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoomLevel})`;
        lightboxImg.style.cursor = 'grab';
    } else {
        lightboxImg.classList.remove('zoomed');
        lightboxImg.style.transform = '';
        lightboxImg.style.cursor = 'zoom-in';
        translateX = 0;
        translateY = 0;
    }
}

// Click to toggle zoom
lightboxImg.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isZoomed) {
        isZoomed = true;
        zoomLevel = 2;
        updateZoom();
    } else if (zoomLevel === 2) {
        zoomLevel = 3;
        updateZoom();
    } else {
        isZoomed = false;
        zoomLevel = 1;
        updateZoom();
    }
});

// Mouse wheel zoom
lightboxImg.addEventListener('wheel', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    zoomLevel = Math.max(1, Math.min(5, zoomLevel + delta));
    isZoomed = zoomLevel !== 1;
    updateZoom();
});

// Drag to pan
lightboxImg.addEventListener('mousedown', (e) => {
    if (!isZoomed) return;
    e.preventDefault();
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    lightboxImg.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    updateZoom();
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        if (isZoomed) lightboxImg.style.cursor = 'grab';
    }
});

// Zoom control buttons
const zoomInBtn = lightbox.querySelector('.zoom-in-btn');
const zoomOutBtn = lightbox.querySelector('.zoom-out-btn');
const zoomResetBtn = lightbox.querySelector('.zoom-reset-btn');
const zoomFullBtn = lightbox.querySelector('.zoom-full-btn');

if (zoomInBtn) {
    zoomInBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        zoomLevel = Math.min(5, zoomLevel + 0.5);
        isZoomed = true;
        updateZoom();
    });
}

if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        zoomLevel = Math.max(1, zoomLevel - 0.5);
        if (zoomLevel === 1) isZoomed = false;
        updateZoom();
    });
}

if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isZoomed = false;
        zoomLevel = 1;
        updateZoom();
    });
}

if (zoomFullBtn) {
    zoomFullBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isZoomed = true;
        zoomLevel = 3;
        updateZoom();
    });
}

closeLightboxBtn.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
});
