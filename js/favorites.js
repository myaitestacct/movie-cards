// ============================================
// FAVORITES: CRUD Operations
// ============================================

function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function toggleFavorite(num) {
    let favs = getFavorites();
    if (favs.includes(num)) {
        favs = favs.filter(n => n !== num);
    } else {
        favs.push(num);
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    return favs.includes(num);
}

function isFavorite(num) {
    return getFavorites().includes(num);
}

function updateFavoritesChipCount() {
    const favChipEl = genreFilters.querySelector('.fav-chip');
    if (favChipEl) {
        const cnt = getFavorites().length;
        favChipEl.textContent = `♥ Favorites${cnt > 0 ? ' (' + cnt + ')' : ''}`;
    }
}