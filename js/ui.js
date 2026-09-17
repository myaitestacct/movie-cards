// ============================================
// UI: Theme, View Toggle, Back-to-Top,
//     Shortcuts, Collapsible Bars, Scroll
// ============================================

// --- View Toggle ---
function updateViewToggleButton() {
    const iconGrid = btnViewToggle.querySelector('.icon-grid');
    const iconList = btnViewToggle.querySelector('.icon-list');
    const label = btnViewToggle.querySelector('.view-toggle-label');

    if (currentView === 'grid') {
        iconGrid.style.display = '';
        iconList.style.display = 'none';
        label.textContent = 'Grid';
    } else {
        iconGrid.style.display = 'none';
        iconList.style.display = '';
        label.textContent = 'List';
    }
}

btnViewToggle.addEventListener('click', () => {
    currentView = currentView === 'grid' ? 'list' : 'grid';
    updateViewToggleButton();
    updatePosterSizeControlState();
    fetchMovies(searchInput.value, 0, false);
});

// Initialize button state (grid is default)
updateViewToggleButton();
updatePosterSizeControlState();

// --- Poster Size Slider ---
const posterSizeSlider = document.getElementById('poster-size-slider');
const posterSizeControl = document.getElementById('poster-size-control');
const POSTER_SIZE_KEY = 'movie_poster_size';

// Apply poster size to grid
function applyPosterSize(size) {
    // Set the minimum width for grid columns
    document.documentElement.style.setProperty('--poster-min-width', size + 'px');
    // Calculate aspect ratio (2:3 ratio, so 150% for portrait posters)
    document.documentElement.style.setProperty('--poster-aspect-ratio', '150%');
}

// Load saved poster size or use default
const savedPosterSize = localStorage.getItem(POSTER_SIZE_KEY);
if (savedPosterSize) {
    posterSizeSlider.value = savedPosterSize;
    applyPosterSize(parseInt(savedPosterSize));
}

// Slider change handler
posterSizeSlider.addEventListener('input', (e) => {
    const size = parseInt(e.target.value);
    applyPosterSize(size);
    localStorage.setItem(POSTER_SIZE_KEY, size);
});

// Disable slider in table view
function updatePosterSizeControlState() {
    if (currentView === 'list') {
        document.body.classList.add('table-view');
    } else {
        document.body.classList.remove('table-view');
    }
}

// --- Theme Toggle ---
const btnTheme = document.getElementById('btn-theme');
const iconMoon = btnTheme.querySelector('.icon-moon');
const iconSun = btnTheme.querySelector('.icon-sun');

// Set the visual theme without necessarily saving to localStorage
function setThemeVisual(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        iconMoon.style.display = 'none';
        iconSun.style.display = '';
    } else {
        document.body.classList.remove('light-theme');
        iconMoon.style.display = '';
        iconSun.style.display = 'none';
    }
}

// Apply theme and save user's manual choice
function applyTheme(theme) {
    setThemeVisual(theme);
    localStorage.setItem(THEME_KEY, theme);
}

// Load saved theme, or auto-detect from OS preference
const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme) {
    // User has manually chosen a theme before — use it
    setThemeVisual(savedTheme);
} else {
    // No saved preference — detect OS theme (don't save, let it follow OS)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setThemeVisual(prefersDark ? 'dark' : 'light');
}

// Live OS theme change listener (only if user hasn't manually overridden)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // Only auto-switch if user hasn't set a manual preference
    if (!localStorage.getItem(THEME_KEY)) {
        setThemeVisual(e.matches ? 'dark' : 'light');
    }
});

// Manual toggle — saves preference to localStorage (overrides auto)
btnTheme.addEventListener('click', () => {
    const current = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    applyTheme(current === 'light' ? 'dark' : 'light');
});

// --- Back to Top Button ---
const backToTopBtn = createElement('button', 'back-to-top-btn');
backToTopBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="18 15 12 9 6 15"></polyline>
    </svg>
`;
backToTopBtn.title = 'Back to top';
backToTopBtn.addEventListener('click', () => {
    contentArea.scrollTo({ top: 0, behavior: 'smooth' });
});
document.body.appendChild(backToTopBtn);

// --- Infinite Scroll & Back-to-Top Visibility ---
contentArea.addEventListener('scroll', () => {
    // Back to top visibility
    if (contentArea.scrollTop > 400) {
        backToTopBtn.classList.add('visible');
    } else {
        backToTopBtn.classList.remove('visible');
    }

    // Infinite scroll: auto-load when near bottom
    const scrollThreshold = 300;
    const distanceFromBottom = contentArea.scrollHeight - contentArea.scrollTop - contentArea.clientHeight;
    if (distanceFromBottom < scrollThreshold && hasMoreResults && !isLoading) {
        const loadBtn = contentArea.querySelector('.load-more-btn');
        if (loadBtn && !loadBtn.disabled) {
            loadBtn.disabled = true;
            loadBtn.textContent = 'Loading...';
            fetchMovies(currentQuery, currentOffset, true);
        }
    }
});

// --- Keyboard Shortcuts Overlay ---
function showShortcutsOverlay() {
    const existing = document.querySelector('.shortcuts-overlay');
    if (existing) existing.remove();

    const overlay = createElement('div', 'shortcuts-overlay');
    overlay.innerHTML = `
        <div class="shortcuts-panel">
            <div class="shortcuts-header">
                <h3>Keyboard Shortcuts</h3>
                <button class="shortcuts-close">&times;</button>
            </div>
            <div class="shortcuts-body">
                <div class="shortcut-row"><kbd>/</kbd> or <kbd>Ctrl+K</kbd> <span>Focus search</span></div>
                <div class="shortcut-row"><kbd>Esc</kbd> <span>Clear search / Close modal / Close panel</span></div>
                <div class="shortcut-row"><kbd>1</kbd> <span>Grid view</span></div>
                <div class="shortcut-row"><kbd>2</kbd> <span>List view</span></div>
                <div class="shortcut-row"><kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> <span>Navigate cards</span></div>
                <div class="shortcut-row"><kbd>Enter</kbd> or <kbd>Space</kbd> <span>Open selected card</span></div>
                <div class="shortcut-row"><kbd>←</kbd> <kbd>→</kbd> <span>Navigate genre chips (when focused)</span></div>
                <div class="shortcut-row"><kbd>G</kbd> <span>Focus genre chips</span></div>
                <div class="shortcut-row"><kbd>F</kbd> <span>Toggle favorites view</span></div>
                <div class="shortcut-row"><kbd>A</kbd> <span>Toggle advanced filters</span></div>
                <div class="shortcut-row"><kbd>Ctrl+Shift+K</kbd> <span>Toggle archive mode</span></div>
                <div class="shortcut-row"><kbd>?</kbd> <span>Show this help</span></div>
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.classList.contains('shortcuts-close')) {
            overlay.remove();
        }
    });

    document.body.appendChild(overlay);
}

// --- Collapsible Bars ---
function getCollapseState() {
    try {
        return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {};
    } catch (e) {
        return {};
    }
}

function saveCollapseState(state) {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state));
}

function initCollapsibleBars() {
    const state = getCollapseState();
    const bars = document.querySelectorAll('.collapsible-bar');

    bars.forEach(bar => {
        const id = bar.id;
        const btn = bar.querySelector('.collapse-toggle');

        // Restore saved state
        if (state[id] === true) {
            bar.classList.add('collapsed');
        }

        // Toggle handler
        btn.addEventListener('click', () => {
            bar.classList.toggle('collapsed');
            const currentState = getCollapseState();
            currentState[id] = bar.classList.contains('collapsed');
            saveCollapseState(currentState);
        });
    });
}

initCollapsibleBars();