// ============================================
// SLIDESHOW: fullscreen poster slideshow (P)
// ============================================

const SLIDESHOW_INTERVAL = 5000;   // ms per slide while playing

let slideshowIndex = 0;
let slideshowTimer = null;
let slideshowIsOpen = false;
let slideshowPreload = null;

const slideshowOverlay = document.createElement('div');
slideshowOverlay.className = 'slideshow-overlay';
slideshowOverlay.setAttribute('role', 'dialog');
slideshowOverlay.setAttribute('aria-label', 'Movie slideshow');
slideshowOverlay.innerHTML = `
    <div class="slideshow-stage">
        <div class="slideshow-loading">Loading…</div>
        <img class="slideshow-img" src="" alt="">
    </div>

    <aside class="slideshow-info">
        <span class="slideshow-counter">1 / 1</span>
        <h2 class="slideshow-title"></h2>
        <div class="slideshow-meta"></div>
        <p class="slideshow-desc"></p>
    </aside>

    <div class="slideshow-controls">
        <button type="button" class="slideshow-btn slideshow-prev" title="Previous (←)" aria-label="Previous">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
        </button>
        <button type="button" class="slideshow-btn slideshow-toggle" title="Play / pause (Space)" aria-label="Play or pause">
            <svg class="icon-pause" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
            <svg class="icon-play" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style="display:none;">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
        </button>
        <button type="button" class="slideshow-btn slideshow-next" title="Next (→)" aria-label="Next">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
        </button>
        <button type="button" class="slideshow-btn slideshow-full" title="Fullscreen (F)" aria-label="Fullscreen">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
        </button>
        <button type="button" class="slideshow-btn slideshow-close" title="Exit (Esc)" aria-label="Exit slideshow">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    </div>

    <div class="slideshow-progress"><div class="slideshow-progress-fill"></div></div>
    <div class="slideshow-hint">← → navigate · Space play/pause · F fullscreen · Esc exit · P toggle</div>
`;
document.body.appendChild(slideshowOverlay);

const slideshowImg = slideshowOverlay.querySelector('.slideshow-img');
const slideshowTitle = slideshowOverlay.querySelector('.slideshow-title');
const slideshowMeta = slideshowOverlay.querySelector('.slideshow-meta');
const slideshowDesc = slideshowOverlay.querySelector('.slideshow-desc');
const slideshowCounter = slideshowOverlay.querySelector('.slideshow-counter');
const slideshowProgressFill = slideshowOverlay.querySelector('.slideshow-progress-fill');
const slideshowLoading = slideshowOverlay.querySelector('.slideshow-loading');
const slideshowToggleBtn = slideshowOverlay.querySelector('.slideshow-toggle');

// --- Helpers ---
function isSlideshowOpen() {
    return slideshowIsOpen;
}

function currentSlideshowMovie() {
    return currentMovies[slideshowIndex] || null;
}

// Slideshow walks the whole current result set, pulling further pages from the
// API on demand, so it can run past the first 50 movies.
async function ensureSlideshowItem(index) {
    if (index < currentMovies.length) return true;
    if (!hasMoreResults || isLoading) return false;

    const before = currentMovies.length;
    await fetchMovies(currentQuery, currentOffset, true);
    return currentMovies.length > before;
}

function restartProgressBar() {
    if (!slideshowProgressFill) return;
    // Restart the CSS animation from zero (reflow between the two assignments)
    slideshowProgressFill.style.animation = 'none';
    void slideshowProgressFill.offsetWidth;
    slideshowProgressFill.style.animation = '';
}

function showSlide(index) {
    const movie = currentSlideshowMovie();

    if (!movie) {
        const total = currentMovies.length;
        if (total === 0) closeSlideshow();
        else showSlide(0);
        return;
    }

    slideshowIndex = index;

    slideshowImg.classList.remove('loaded');
    slideshowLoading.style.display = '';

    const poster = movie.poster || '';
    slideshowImg.onload = () => {
        slideshowImg.classList.add('loaded');
        slideshowLoading.style.display = 'none';
    };
    slideshowImg.onerror = () => {
        slideshowImg.onerror = null;
        slideshowImg.src = 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
                <rect width="400" height="600" fill="#111"/>
                <text x="200" y="300" text-anchor="middle" fill="#555" font-family="sans-serif" font-size="18">No Poster</text>
            </svg>
        `);
        slideshowImg.classList.add('loaded');
        slideshowLoading.style.display = 'none';
    };
    slideshowImg.src = poster;
    slideshowImg.alt = movie.title || 'Movie poster';

    slideshowTitle.textContent = `${movie.num} - ${movie.title || 'Untitled'}`;

    const facts = [];
    if (movie.year) facts.push(movie.year);
    if (movie.genre) facts.push(movie.genre);
    if (movie.length) facts.push(movie.length);
    if (movie.certification) facts.push(movie.certification);
    const ratingVal = parseFloat(movie.rating);
    if (ratingVal > 0) facts.push(`★ ${ratingVal.toFixed(1)}`);
    if (movie.resolution) facts.push(movie.resolution);
    if (movie.audio) facts.push(movie.audio);
    slideshowMeta.textContent = facts.join(' · ');

    slideshowDesc.textContent = movie.description || 'No description available.';

    slideshowCounter.textContent = `${slideshowIndex + 1} / ${currentMovies.length}${hasMoreResults ? '+' : ''}`;

    restartProgressBar();

    // Warm the browser cache for the next poster
    const next = currentMovies[slideshowIndex + 1];
    if (next && next.poster) {
        slideshowPreload = new Image();
        slideshowPreload.src = next.poster;
    }
}

function nextSlide() {
    const target = slideshowIndex + 1;

    // Already loaded: advance immediately (no await, so arrow keys stay snappy)
    if (target < currentMovies.length) {
        showSlide(target);
        return;
    }

    // Past the end of the loaded page: pull the next page from the API first
    ensureSlideshowItem(target).then((loaded) => {
        showSlide(loaded ? target : 0);   // wrap around at the end of the collection
    });
}

function prevSlide() {
    if (slideshowIndex === 0) {
        showSlide(currentMovies.length - 1);
    } else {
        showSlide(slideshowIndex - 1);
    }
}

function isSlideshowPlaying() {
    return slideshowTimer !== null;
}

function startSlideshowTimer() {
    stopSlideshowTimer();
    slideshowTimer = setInterval(nextSlide, SLIDESHOW_INTERVAL);
    slideshowOverlay.classList.add('playing');
    slideshowToggleBtn.querySelector('.icon-pause').style.display = '';
    slideshowToggleBtn.querySelector('.icon-play').style.display = 'none';
}

function stopSlideshowTimer() {
    if (slideshowTimer !== null) {
        clearInterval(slideshowTimer);
        slideshowTimer = null;
    }
    slideshowOverlay.classList.remove('playing');
    slideshowToggleBtn.querySelector('.icon-pause').style.display = 'none';
    slideshowToggleBtn.querySelector('.icon-play').style.display = '';
}

function toggleSlideshowPlay() {
    if (isSlideshowPlaying()) stopSlideshowTimer();
    else startSlideshowTimer();
}

function openSlideshow() {
    if (!currentMovies.length) {
        showToast('Nothing to show in a slideshow yet', 'warning');
        return;
    }

    slideshowIsOpen = true;
    slideshowIndex = 0;
    slideshowOverlay.classList.add('show');
    document.body.classList.add('slideshow-open');

    showSlide(0);
    startSlideshowTimer();

    if (typeof resetCardFocus === 'function') resetCardFocus();
}

function closeSlideshow() {
    stopSlideshowTimer();
    slideshowIsOpen = false;
    slideshowOverlay.classList.remove('show');
    document.body.classList.remove('slideshow-open');

    if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        if (slideshowOverlay.requestFullscreen) {
            slideshowOverlay.requestFullscreen().catch(() => {});
        }
    } else if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }
}

// --- Buttons ---
document.getElementById('btn-slideshow').addEventListener('click', () => {
    if (isSlideshowOpen()) closeSlideshow();
    else openSlideshow();
});

slideshowOverlay.querySelector('.slideshow-prev').addEventListener('click', () => {
    prevSlide();
    restartAutoAdvance();
});
slideshowOverlay.querySelector('.slideshow-next').addEventListener('click', () => {
    nextSlide();
    restartAutoAdvance();
});
slideshowToggleBtn.addEventListener('click', toggleSlideshowPlay);
slideshowOverlay.querySelector('.slideshow-full').addEventListener('click', toggleFullscreen);
slideshowOverlay.querySelector('.slideshow-close').addEventListener('click', closeSlideshow);

// Clicking the backdrop (not the poster/info) exits
slideshowOverlay.addEventListener('click', (e) => {
    if (e.target === slideshowOverlay || e.target.classList.contains('slideshow-stage')) {
        closeSlideshow();
    }
});

function restartAutoAdvance() {
    if (isSlideshowPlaying()) startSlideshowTimer();
    else restartProgressBar();
}

// --- Open shortcut (P), ignored while typing or when the modal is open ---
document.addEventListener('keydown', (e) => {
    if (e.key !== 'p' && e.key !== 'P') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isSlideshowOpen() || isTypingTarget() || modal.open) return;
    if (typeof isAnalyticsOpen === 'function' && isAnalyticsOpen()) return;

    e.preventDefault();
    openSlideshow();
});

// --- Keyboard (capture phase: while open, the slideshow owns the keyboard) ---
document.addEventListener('keydown', (e) => {
    if (!isSlideshowOpen()) return;

    // Let focused overlay buttons respond to Space/Enter normally
    const onButton = e.target instanceof HTMLElement && e.target.tagName === 'BUTTON';

    switch (e.key) {
        case 'Escape':
        case 'p':
        case 'P':
            e.preventDefault();
            e.stopPropagation();
            closeSlideshow();
            return;
        case 'ArrowRight':
        case 'ArrowDown':
            e.preventDefault();
            e.stopPropagation();
            nextSlide();
            restartAutoAdvance();
            return;
        case 'ArrowLeft':
        case 'ArrowUp':
            e.preventDefault();
            e.stopPropagation();
            prevSlide();
            restartAutoAdvance();
            return;
        case 'f':
        case 'F':
            e.preventDefault();
            e.stopPropagation();
            toggleFullscreen();
            return;
        case ' ':
        case 'Spacebar':
            if (onButton) return;   // the focused button handles it
            e.preventDefault();
            e.stopPropagation();
            toggleSlideshowPlay();
            return;
        default:
            // Swallow the app-level single-key shortcuts behind the overlay
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                e.stopPropagation();
            }
    }
}, true);
