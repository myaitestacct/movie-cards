// ============================================
// FAVORITES: CRUD Operations
// ============================================

// Movie numbers are ids, not text: the API sends NUM as a number, but lists
// saved by older sessions (and any value read back from the URL) can hold the
// same id as a string. Compare numerically so "5" and 5 are one favorite
// instead of two entries that silently fail to match.
function toMovieNum(value) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
}

function getFavorites() {
    try {
        const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY));
        if (!Array.isArray(stored)) return [];
        return stored.map(toMovieNum).filter(num => num !== null);
    } catch (e) {
        return [];
    }
}

function toggleFavorite(num) {
    const wanted = toMovieNum(num);
    if (wanted === null) return false;

    let favs = getFavorites();
    if (favs.includes(wanted)) {
        favs = favs.filter(n => n !== wanted);
    } else {
        favs.push(wanted);
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    return favs.includes(wanted);
}

function isFavorite(num) {
    const wanted = toMovieNum(num);
    return wanted !== null && getFavorites().includes(wanted);
}

function updateFavoritesChipCount() {
    const favChipEl = genreFilters.querySelector('.fav-chip');
    if (favChipEl) {
        const cnt = getFavorites().length;
        favChipEl.textContent = `♥ Favorites${cnt > 0 ? ' (' + cnt + ')' : ''}`;
    }
}