// ============================================
// ANALYTICS: collection growth & timeline (Y)
// ============================================

let analyticsData = null;
let analyticsBasis = 'release';     // 'release' | 'added'
let analyticsIsOpen = false;

const analyticsOverlay = document.createElement('div');
analyticsOverlay.className = 'analytics-overlay';
analyticsOverlay.setAttribute('role', 'dialog');
analyticsOverlay.setAttribute('aria-label', 'Collection growth and timeline');
analyticsOverlay.innerHTML = `
    <div class="analytics-panel glass-panel">
        <div class="analytics-header">
            <div>
                <h3>Collection Growth &amp; Timeline</h3>
                <span class="analytics-subtitle"></span>
            </div>
            <div class="analytics-header-actions">
                <div class="segmented-control analytics-basis" style="display:none;">
                    <button type="button" class="seg-btn active" data-basis="release">By release year</button>
                    <button type="button" class="seg-btn" data-basis="added">By date added</button>
                </div>
                <button type="button" class="adv-filters-close analytics-close" title="Close (Esc)">&times;</button>
            </div>
        </div>
        <div class="analytics-body">
            <div class="analytics-stats"><div class="analytics-loading">Crunching the numbers…</div></div>
        </div>
        <div class="analytics-footer">
            <span class="analytics-hint">Click a bar or decade to filter the library · Esc to close · Y to toggle</span>
        </div>
    </div>
`;
document.body.appendChild(analyticsOverlay);

const analyticsPanel = analyticsOverlay.querySelector('.analytics-panel');
const analyticsStats = analyticsOverlay.querySelector('.analytics-stats');
const analyticsSubtitle = analyticsOverlay.querySelector('.analytics-subtitle');
const analyticsBasisControl = analyticsOverlay.querySelector('.analytics-basis');
const analyticsCloseBtn = analyticsOverlay.querySelector('.analytics-close');

// --- Formatting helpers ---
function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function formatSize(mb) {
    const value = Number(mb) || 0;
    if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + ' TB';
    if (value >= 1024) return (value / 1024).toFixed(1) + ' GB';
    return Math.round(value) + ' MB';
}

function formatMonth(month) {
    const [y, m] = String(month).split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const idx = parseInt(m, 10) - 1;
    return `${names[idx] || m} ${y}`;
}

// --- Data access ---
// Series feeding the timeline/cumulative charts, depending on the chosen basis.
function activeSeries() {
    if (!analyticsData) return [];

    if (analyticsBasis === 'added' && analyticsData.addedByMonth) {
        return analyticsData.addedByMonth.map(row => ({ label: formatMonth(row.month), count: row.count }));
    }

    return (analyticsData.byYear || []).map(row => ({ label: String(row.year), count: row.count }));
}

function cumulativeSeries(series) {
    let running = 0;
    return series.map(point => {
        running += point.count;
        return { label: point.label, count: point.count, total: running };
    });
}

// --- Charts (hand-rolled SVG, no dependencies) ---
function timelineChart(series) {
    const width = 900;
    const height = 220;
    const padding = { top: 16, right: 12, bottom: 30, left: 34 };

    const points = cumulativeSeries(series);
    const max = Math.max(1, ...points.map(p => p.count));
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const slot = plotWidth / Math.max(points.length, 1);
    const barWidth = Math.max(2, Math.min(26, slot * 0.7));

    // Label every nth bar so long histories stay readable
    const labelEvery = Math.max(1, Math.ceil(points.length / 14));

    let bars = '';
    let labels = '';
    let cumulative = '';

    points.forEach((point, i) => {
        const x = padding.left + slot * i + (slot - barWidth) / 2;
        const barHeight = (point.count / max) * plotHeight;
        const y = padding.top + plotHeight - barHeight;

        const isLast = i === points.length - 1;
        bars += `<rect class="chart-bar${isLast ? ' chart-bar-last' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}"
                       width="${barWidth.toFixed(1)}" height="${Math.max(barHeight, 1).toFixed(1)}" rx="2">
                   <title>${point.label}: ${point.count} movie(s) · ${point.total} total</title>
                 </rect>`;

        if (i % labelEvery === 0 || isLast) {
            labels += `<text class="chart-label" x="${(x + barWidth / 2).toFixed(1)}" y="${height - 10}"
                             text-anchor="middle">${escapeHtml(point.label)}</text>`;
        }

        const totalMax = Math.max(1, points[points.length - 1].total);
        const cx = padding.left + slot * i + slot / 2;
        const cy = padding.top + plotHeight - (point.total / totalMax) * plotHeight;
        cumulative += `${i === 0 ? 'M' : 'L'}${cx.toFixed(1)},${cy.toFixed(1)} `;
    });

    const gridLines = [0.25, 0.5, 0.75, 1].map(f => {
        const y = padding.top + plotHeight - plotHeight * f;
        return `<line class="chart-grid" x1="${padding.left}" y1="${y.toFixed(1)}" x2="${width - padding.right}" y2="${y.toFixed(1)}"></line>`;
    }).join('');

    return `
        <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img"
             aria-label="Movies per ${analyticsBasis === 'added' ? 'month' : 'release year'} with cumulative total">
            ${gridLines}
            ${bars}
            <path class="chart-cumulative" d="${cumulative.trim()}"></path>
            ${labels}
        </svg>
    `;
}

function barRows(items, options = {}) {
    if (!items || !items.length) {
        return '<div class="analytics-empty">No data</div>';
    }

    const max = Math.max(...items.map(i => i.count));
    const labelKey = options.labelKey || 'label';
    // Values land inside an HTML attribute, so quotes must be escaped too
    const attr = (value) => escapeHtml(String(value)).replace(/"/g, '&quot;');

    return items.map(item => {
        const pct = max > 0 ? (item.count / max) * 100 : 0;
        const label = item[labelKey];
        // Clickable rows carry the raw filter value (e.g. decade start, not "1990s")
        const filterValue = options.valueKey ? item[options.valueKey] : label;
        const extra = options.showRating && item.avgRating ? ` · ★ ${item.avgRating}` : '';
        const tag = options.clickable ? 'button' : 'div';
        const attrs = options.clickable
            ? `type="button" class="analytics-bar-row analytics-bar-clickable" data-value="${attr(filterValue)}"`
            : 'class="analytics-bar-row"';

        return `<${tag} ${attrs} title="${attr(label)}: ${item.count} movie(s)">
                    <span class="analytics-bar-label">${escapeHtml(String(label))}</span>
                    <span class="analytics-bar-track"><span class="analytics-bar-fill" style="width:${pct.toFixed(1)}%"></span></span>
                    <span class="analytics-bar-count">${formatNumber(item.count)}${extra}</span>
                </${tag}>`;
    }).join('');
}

function statCards(data, series) {
    const peak = series.reduce((best, p) => (p.count > (best?.count || 0) ? p : best), null);
    const yearsSpan = (data.firstYear && data.lastYear) ? `${data.firstYear}–${data.lastYear}` : 'n/a';

    const cards = [
        ['Total movies', formatNumber(data.totalMovies)],
        ['Total runtime', data.totalRuntime],
        ['On disk', formatSize(data.totalSizeMb)],
        ['Covered years', yearsSpan],
        ['Genres', formatNumber((data.byGenre || []).length)],
        ['Countries', formatNumber((data.byCountry || []).length)],
    ];

    if (peak) {
        cards.push([analyticsBasis === 'added' ? 'Biggest month' : 'Biggest year',
                    `${peak.label} (${formatNumber(peak.count)})`]);
    }

    return `<div class="analytics-cards">${cards.map(([label, value]) => `
        <div class="analytics-card">
            <span class="analytics-card-value">${escapeHtml(String(value))}</span>
            <span class="analytics-card-label">${escapeHtml(label)}</span>
        </div>`).join('')}</div>`;
}

// --- Render ---
function renderAnalytics() {
    const data = analyticsData;
    if (!data) return;

    const series = activeSeries();
    const hasAddedSeries = Array.isArray(data.addedByMonth) && data.addedByMonth.length > 0;

    analyticsBasisControl.style.display = hasAddedSeries ? '' : 'none';
    analyticsSubtitle.textContent = `${data.source === 'paripakva' ? 'Archive' : 'Library'} · `
        + (analyticsBasis === 'added' ? `by date added (${data.dateColumn})` : 'by release year');

    if (!series.length) {
        analyticsStats.innerHTML = '<div class="analytics-empty">No dated movies to chart yet.</div>';
        return;
    }

    const decades = (data.byDecade || []).map(d => ({
        // data-value is the raw decade start so the click handler can filter
        label: `${d.decade}s`, value: String(d.decade), count: d.count, avgRating: d.avgRating,
    }));

    analyticsStats.innerHTML = `
        ${statCards(data, series)}

        <section class="analytics-chart-block">
            <h4>${analyticsBasis === 'added' ? 'Movies added per month' : 'Movies per release year'}
                <span class="analytics-note">bars = per ${analyticsBasis === 'added' ? 'month' : 'year'} · line = cumulative total</span>
            </h4>
            ${timelineChart(series)}
        </section>

        <div class="analytics-columns">
            <section class="analytics-chart-block">
                <h4>By decade <span class="analytics-note">click to filter</span></h4>
                ${barRows(decades, { clickable: true, showRating: true, valueKey: 'value' })}
            </section>

            <section class="analytics-chart-block">
                <h4>Top genres <span class="analytics-note">click to filter</span></h4>
                ${barRows(data.byGenre || [], { clickable: true })}
            </section>

            <section class="analytics-chart-block">
                <h4>Countries</h4>
                ${barRows(data.byCountry || [])}
            </section>

            <section class="analytics-chart-block">
                <h4>Top directors</h4>
                ${barRows(data.byDirector || [])}
            </section>
        </div>
    `;

    // Decade bars filter by year range, genre bars filter by category
    analyticsStats.querySelectorAll('.analytics-bar-clickable').forEach(row => {
        row.addEventListener('click', () => applyAnalyticsFilter(row));
    });
}

// --- Filter integration (reuses the existing filter + fetch machinery) ---
function applyAnalyticsFilter(row) {
    const section = row.closest('.analytics-chart-block');
    const title = section ? section.querySelector('h4').textContent : '';
    const value = row.dataset.value;

    if (title.startsWith('By decade')) {
        const from = parseInt(value, 10);
        if (isNaN(from)) return;
        closeAnalytics();
        showToast(`Filtered to the ${from}s`, 'info');
        // decades.js owns the decade filter, so the decade bar stays in sync
        if (typeof setDecadeFilter === 'function') setDecadeFilter(from);
        else fetchMovies(searchInput.value, 0, false);
        return;
    }

    if (title.startsWith('Top genres')) {
        currentCategory = (currentCategory === value) ? '' : value;
        updateActiveChip();
        closeAnalytics();
        showToast(currentCategory ? `Filtered to ${value}` : 'Genre filter cleared', 'info');
        fetchMovies(searchInput.value, 0, false);
    }
}

// --- Open / close ---
async function loadAnalytics() {
    analyticsStats.innerHTML = '<div class="analytics-loading">Crunching the numbers…</div>';

    try {
        const response = await fetch(`api.php?action=analytics&archive=${showParipakva ? 1 : 0}`);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        analyticsData = await response.json();
        if (analyticsData.error) throw new Error(analyticsData.error);

        // Default to the acquisition view when the database actually has dates
        if (Array.isArray(analyticsData.addedByMonth) && analyticsData.addedByMonth.length > 0) {
            analyticsBasis = 'added';
        } else {
            analyticsBasis = 'release';
        }
        syncBasisButtons();
        renderAnalytics();
    } catch (err) {
        console.error('Analytics error:', err);
        analyticsStats.innerHTML = `<div class="analytics-empty">Could not load analytics: ${escapeHtml(err.message)}</div>`;
    }
}

function syncBasisButtons() {
    analyticsBasisControl.querySelectorAll('.seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.basis === analyticsBasis);
    });
}

function isAnalyticsOpen() {
    return analyticsIsOpen;
}

function openAnalytics() {
    analyticsIsOpen = true;
    analyticsOverlay.classList.add('show');
    document.body.classList.add('analytics-open');
    if (typeof resetCardFocus === 'function') resetCardFocus();
    loadAnalytics();
}

function closeAnalytics() {
    analyticsIsOpen = false;
    analyticsOverlay.classList.remove('show');
    document.body.classList.remove('analytics-open');
}

function toggleAnalytics() {
    if (isAnalyticsOpen()) closeAnalytics();
    else openAnalytics();
}

document.getElementById('btn-analytics').addEventListener('click', toggleAnalytics);
analyticsCloseBtn.addEventListener('click', closeAnalytics);

analyticsOverlay.addEventListener('click', (e) => {
    if (e.target === analyticsOverlay) closeAnalytics();
});

analyticsBasisControl.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    analyticsBasis = btn.dataset.basis;
    syncBasisButtons();
    renderAnalytics();
});

// --- Open shortcut (Y), ignored while typing or when the modal is open ---
document.addEventListener('keydown', (e) => {
    if (e.key !== 'y' && e.key !== 'Y') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isAnalyticsOpen() || modal.open || isTypingTarget()) return;
    if (typeof isSlideshowOpen === 'function' && isSlideshowOpen()) return;

    e.preventDefault();
    openAnalytics();
});

// --- Keyboard (capture phase, same pattern as the slideshow) ---
document.addEventListener('keydown', (e) => {
    if (!isAnalyticsOpen()) return;

    if (e.key === 'Escape' || e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        e.stopPropagation();
        closeAnalytics();
        return;
    }

    // Keep single-key app shortcuts from firing behind the overlay, but leave
    // Space/Enter/Tab alone so the buttons stay keyboard-operable.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.stopPropagation();
    }
}, true);
