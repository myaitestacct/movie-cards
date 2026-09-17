// ============================================
// STATE: DOM Elements, Variables & Constants
// ============================================

// --- DOM Elements (var = global across script files) ---
var contentArea = document.getElementById('content-area');
var searchInput = document.getElementById('search-input');
var btnViewToggle = document.getElementById('btn-view-toggle');
var modal = document.getElementById('movie-modal');
var closeModal = document.getElementById('close-modal');
var modalBody = document.getElementById('modal-body');
var sortSelect = document.getElementById('sort-select');
var genreFilters = document.getElementById('genre-filters');

// --- State Variables (var = global across script files) ---
var currentView = 'grid';
var debounceTimer;
var currentQuery = '';
var currentOffset = 0;
var hasMoreResults = true;
var isLoading = false;
var currentLimit = 50;
var showParipakva = false;       // archive/18+ content toggle (Ctrl+Shift+K)
var currentSort = 'num_asc';     // current sort order
var currentCategory = '';        // current genre filter ('' = all)
var FAVORITES_KEY = 'movielib_favorites';
var THEME_KEY = 'movielib_theme';
var COLLAPSE_KEY = 'movielib_collapsed';

// --- Advanced Filters State ---
var advancedFilters = {
    yearFrom: '',
    yearTo: '',
    ratingFrom: '',
    ratingTo: '',
    resolutions: [],
    audioFormats: [],
    country: '',
    certifications: []
};