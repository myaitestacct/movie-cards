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
var limitSelect = document.getElementById('limit-select');
var genreFilters = document.getElementById('genre-filters');

// --- State Variables (var = global across script files) ---
var currentView = 'grid';
var debounceTimer;
var currentQuery = '';
var currentOffset = 0;
var hasMoreResults = true;
var isLoading = false;          // a listing request is in flight
var fetchRequestSeq = 0;        // sequence number of the newest listing request
var currentLimit = 50;
var showParipakva = false;       // archive/18+ content toggle (Ctrl+Shift+K)
var currentSort = 'num_asc';     // current sort order
var currentCategory = '';        // current genre filter ('' = all)
var currentDecade = '';          // decade filter ('' = all eras)
var cachedDecades = [];          // last fetched decade list (chip labels/counts)
var currentMovies = [];          // movies currently in the result set (slideshow/analytics)
var FAVORITES_KEY = 'movielib_favorites';
var COMPARE_KEY = 'movielib_compare';
var compareList = [];            // movies queued for side-by-side comparison
var THEME_KEY = 'movielib_theme';
var COLLAPSE_KEY = 'movielib_collapsed';
var LIMIT_KEY = 'movielib_page_size';
var PAGE_SIZE_OPTIONS = [25, 50, 100];   // server caps page size at 100

// --- Movie Index Cache (see index-cache.js) ---
var movieIndex = [];             // compact [{num,title,year}] list of the current source
var movieIndexSource = null;     // 'movies' | 'paripakva' — what movieIndex currently holds
var INDEX_CACHE_PREFIX = 'movielib_index_v1_';
var INDEX_CACHE_TTL_MS = 12 * 60 * 60 * 1000;  // background-refresh after 12h

// --- Pagination / Page Jump State ---
var lastTotalMatches = 0;        // size of the current result set (for page math)
var lastFetchOffset = 0;         // offset of the last non-append fetch (top of the window)
var pendingPageOffset = 0;       // offset restored from the URL hash on load
var jumpIsolatedView = false;    // true when a jump replaced the listing (no pages)

// --- Advanced Filters State ---
var advancedFilters = {
    yearFrom: '',
    yearTo: '',
    ratingFrom: '',
    ratingTo: '',
    resolutions: [],
    audioFormats: [],
    country: '',
    director: '',
    actors: '',
    sizeFrom: '',
    sizeTo: '',
    certifications: [],
    subtitles: [],       // language names, e.g. ['English', 'French']
    subPresence: ''      // '' = any, '1' = has subtitles, '0' = no subtitles
};