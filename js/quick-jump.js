// ============================================
// QUICK JUMP: Jump to a movie by number,
// first letter, or decade
// ============================================

const btnQuickJump = document.getElementById('btn-quick-jump');
const quickJumpPanel = document.getElementById('quick-jump-panel');
const quickJumpClose = document.getElementById('quick-jump-close');
const jumpToNumberInput = document.getElementById('jump-to-number');
const jumpNumberBtn = document.getElementById('jump-number-btn');
const jumpNumberStatus = document.getElementById('jump-number-status');
const jumpLetterStatus = document.getElementById('jump-letter-status');
const jumpDecadeStatus = document.getElementById('jump-decade-status');
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

// --- Tabs (Number / Letter / Decade) ---
const qjTabButtons = Array.from(document.querySelectorAll('.qj-tab-btn'));
const qjTabPanels = Array.from(document.querySelectorAll('.qj-tab-panel'));

qjTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        qjTabButtons.forEach(b => b.classList.toggle('active', b === btn));
        qjTabPanels.forEach(p => p.classList.toggle('active', p.dataset.tabPanel === btn.dataset.tab));
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

        if (!currentPosition.textContent) {
            currentPosition.textContent = `Movie #1 of ${total.toLocaleString()}`;
        }
    } catch (error) {
        console.error('Error fetching collection info:', error);
        totalMoviesCount.textContent = '—';
    }
}

// --- Jump to Movie Number ---
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

// --- Jump to Letter ---
document.querySelectorAll('.jump-letter-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const letter = btn.dataset.letter;

        setJumpStatus(jumpLetterStatus, 'Searching...');
        setJumpButtonsDisabled('.jump-letter-btn', true);

        try {
            const response = await fetch(
                `api.php?action=get_movies_by_letter&letter=${encodeURIComponent(letter)}&limit=50&archive=${showParipakva ? 1 : 0}`
            );
            const data = await response.json();

            if (data.success && data.movies && data.movies.length > 0) {
                renderJumpResults(data.movies, `Titles starting with "${letter}"`);
                setJumpStatus(jumpLetterStatus, `✓ Found ${data.count} movie(s) starting with "${letter}"`, 'success');

                setTimeout(closeQuickJumpPanel, 1000);
            } else if (data.success) {
                setJumpStatus(jumpLetterStatus, `No movies found starting with "${letter}"`, 'error');
            } else {
                setJumpStatus(jumpLetterStatus, data.error || 'Error fetching movies', 'error');
            }
        } catch (error) {
            console.error('Error jumping to letter:', error);
            setJumpStatus(jumpLetterStatus, 'Error fetching movies', 'error');
        } finally {
            setJumpButtonsDisabled('.jump-letter-btn', false);
        }
    });
});

// --- Jump to Decade ---
document.querySelectorAll('.jump-decade-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const decade = btn.dataset.decade;
        const yearFrom = parseInt(decade, 10);
        const yearTo = yearFrom + 9;

        setJumpStatus(jumpDecadeStatus, 'Searching...');
        setJumpButtonsDisabled('.jump-decade-btn', true);

        try {
            const response = await fetch(
                `api.php?action=get_movies_by_decade&from=${yearFrom}&to=${yearTo}&limit=50&archive=${showParipakva ? 1 : 0}`
            );
            const data = await response.json();

            if (data.success && data.movies && data.movies.length > 0) {
                renderJumpResults(data.movies, `Movies from the ${decade}s`);
                setJumpStatus(jumpDecadeStatus, `✓ Found ${data.count} movie(s) from the ${decade}s`, 'success');

                setTimeout(closeQuickJumpPanel, 1000);
            } else if (data.success) {
                setJumpStatus(jumpDecadeStatus, `No movies found from the ${decade}s`, 'error');
            } else {
                setJumpStatus(jumpDecadeStatus, data.error || 'Error fetching movies', 'error');
            }
        } catch (error) {
            console.error('Error jumping to decade:', error);
            setJumpStatus(jumpDecadeStatus, 'Error fetching movies', 'error');
        } finally {
            setJumpButtonsDisabled('.jump-decade-btn', false);
        }
    });
});
