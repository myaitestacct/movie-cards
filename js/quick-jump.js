// ============================================
// QUICK JUMP NAVIGATION
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

// Toggle Quick Jump Panel
function toggleQuickJumpPanel() {
    quickJumpPanel.classList.toggle('open');
    if (quickJumpPanel.classList.contains('open')) {
        updateCollectionInfo();
    }
}

btnQuickJump.addEventListener('click', toggleQuickJumpPanel);
quickJumpClose.addEventListener('click', () => quickJumpPanel.classList.remove('open'));

// Close panel when clicking outside
document.addEventListener('click', (e) => {
    if (quickJumpPanel.classList.contains('open') &&
        !quickJumpPanel.contains(e.target) &&
        !btnQuickJump.contains(e.target)) {
        quickJumpPanel.classList.remove('open');
    }
});

// Update Collection Info
async function updateCollectionInfo() {
    try {
        const response = await fetch('api.php?action=stats');
        const data = await response.json();
        totalMoviesCount.textContent = data.totalMovies.toLocaleString();
        currentPosition.textContent = `Movie #1 of ${data.totalMovies.toLocaleString()}`;
    } catch (error) {
        console.error('Error fetching collection info:', error);
        totalMoviesCount.textContent = 'Error';
    }
}

// Jump to Movie Number
jumpNumberBtn.addEventListener('click', async () => {
    const num = parseInt(jumpToNumberInput.value);
    if (!num || num < 1) {
        jumpNumberStatus.textContent = 'Please enter a valid movie number';
        jumpNumberStatus.className = 'jump-status error';
        return;
    }

    jumpNumberStatus.textContent = 'Searching...';
    jumpNumberStatus.className = 'jump-status';

    try {
        const response = await fetch(`api.php?action=get_movie_by_num&num=${num}`);
        const data = await response.json();

        if (data.success && data.movie) {
            jumpNumberStatus.textContent = `✓ Found: ${data.movie.title}`;
            jumpNumberStatus.className = 'jump-status success';
            
            clearContainer(contentArea);
            const grid = createElement('div', 'movie-grid');
            contentArea.appendChild(grid);
            
            renderGrid([data.movie]);
            
            currentPosition.textContent = `Movie #${num}`;
            
            contentArea.scrollTop = 0;
            
            setTimeout(() => {
                quickJumpPanel.classList.remove('open');
            }, 1000);
        } else {
            jumpNumberStatus.textContent = data.message || 'Movie not found';
            jumpNumberStatus.className = 'jump-status error';
        }
    } catch (error) {
        console.error('Error jumping to movie:', error);
        jumpNumberStatus.textContent = 'Error fetching movie';
        jumpNumberStatus.className = 'jump-status error';
    }
});

// Allow Enter key in number input
jumpToNumberInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        jumpNumberBtn.click();
    }
});

// Jump to Letter
document.querySelectorAll('.jump-letter-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const letter = btn.dataset.letter;
        
        jumpLetterStatus.textContent = 'Searching...';
        jumpLetterStatus.className = 'jump-status';

        try {
            const searchTerm = letter === '#' ? '[0-9]' : letter;
            const response = await fetch(`api.php?action=get_movies_by_letter&letter=${encodeURIComponent(searchTerm)}&limit=50`);
            const data = await response.json();

            if (data.success && data.movies && data.movies.length > 0) {
                jumpLetterStatus.textContent = `✓ Found ${data.count} movies starting with "${letter}"`;
                jumpLetterStatus.className = 'jump-status success';
                
                clearContainer(contentArea);
                const grid = createElement('div', 'movie-grid');
                contentArea.appendChild(grid);
                
                renderGrid(data.movies);
                
                currentPosition.textContent = `Movies starting with "${letter}"`;
                
                contentArea.scrollTop = 0;
                
                setTimeout(() => {
                    quickJumpPanel.classList.remove('open');
                }, 1000);
            } else {
                jumpLetterStatus.textContent = `No movies found starting with "${letter}"`;
                jumpLetterStatus.className = 'jump-status error';
            }
        } catch (error) {
            console.error('Error jumping to letter:', error);
            jumpLetterStatus.textContent = 'Error fetching movies';
            jumpLetterStatus.className = 'jump-status error';
        }
    });
});

// Jump to Decade
document.querySelectorAll('.jump-decade-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const decade = btn.dataset.decade;
        const yearFrom = parseInt(decade);
        const yearTo = yearFrom + 9;
        
        jumpDecadeStatus.textContent = 'Searching...';
        jumpDecadeStatus.className = 'jump-status';

        try {
            const response = await fetch(`api.php?action=get_movies_by_decade&from=${yearFrom}&to=${yearTo}&limit=50`);
            const data = await response.json();

            if (data.success && data.movies && data.movies.length > 0) {
                jumpDecadeStatus.textContent = `✓ Found ${data.count} movies from ${yearFrom}s`;
                jumpDecadeStatus.className = 'jump-status success';
                
                clearContainer(contentArea);
                const grid = createElement('div', 'movie-grid');
                contentArea.appendChild(grid);
                
                renderGrid(data.movies);
                
                currentPosition.textContent = `Movies from ${yearFrom}s`;
                
                contentArea.scrollTop = 0;
                
                setTimeout(() => {
                    quickJumpPanel.classList.remove('open');
                }, 1000);
            } else {
                jumpDecadeStatus.textContent = `No movies found from ${yearFrom}s`;
                jumpDecadeStatus.className = 'jump-status error';
            }
        } catch (error) {
            console.error('Error jumping to decade:', error);
            jumpDecadeStatus.textContent = 'Error fetching movies';
            jumpDecadeStatus.className = 'jump-status error';
        }
    });
});