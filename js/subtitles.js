// ============================================
// SUBTITLES: Parsing, Flags, Badges & Display
// ============================================

// Map language names to flags/abbreviations
const LANGUAGE_META = {
    'english': { code: 'EN', flag: '🇬🇧', label: 'English' },
    'spanish': { code: 'ES', flag: '🇪🇸', label: 'Spanish' },
    'french': { code: 'FR', flag: '🇫🇷', label: 'French' },
    'german': { code: 'DE', flag: '🇩🇪', label: 'German' },
    'italian': { code: 'IT', flag: '🇮🇹', label: 'Italian' },
    'japanese': { code: 'JA', flag: '🇯🇵', label: 'Japanese' },
    'korean': { code: 'KO', flag: '🇰🇷', label: 'Korean' },
    'chinese': { code: 'ZH', flag: '🇨🇳', label: 'Chinese' },
    'mandarin': { code: 'ZH', flag: '🇨🇳', label: 'Mandarin' },
    'cantonese': { code: 'YUE', flag: '🇭🇰', label: 'Cantonese' },
    'hindi': { code: 'HI', flag: '🇮🇳', label: 'Hindi' },
    'portuguese': { code: 'PT', flag: '🇵🇹', label: 'Portuguese' },
    'russian': { code: 'RU', flag: '🇷🇺', label: 'Russian' },
    'arabic': { code: 'AR', flag: '🇸🇦', label: 'Arabic' },
    'dutch': { code: 'NL', flag: '🇳🇱', label: 'Dutch' },
    'polish': { code: 'PL', flag: '🇵🇱', label: 'Polish' },
    'swedish': { code: 'SV', flag: '🇸🇪', label: 'Swedish' },
    'norwegian': { code: 'NO', flag: '🇳🇴', label: 'Norwegian' },
    'danish': { code: 'DA', flag: '🇩🇰', label: 'Danish' },
    'finnish': { code: 'FI', flag: '🇫🇮', label: 'Finnish' },
    'greek': { code: 'EL', flag: '🇬🇷', label: 'Greek' },
    'turkish': { code: 'TR', flag: '🇹🇷', label: 'Turkish' },
    'thai': { code: 'TH', flag: '🇹🇭', label: 'Thai' },
    'vietnamese': { code: 'VI', flag: '🇻🇳', label: 'Vietnamese' },
    'indonesian': { code: 'ID', flag: '🇮🇩', label: 'Indonesian' }
};

// --- Parse Subtitles String ---
function parseSubtitles(subStr) {
    if (!subStr || subStr === 'None' || String(subStr).trim() === '') {
        return [];
    }

    const parts = String(subStr).split(',').map(s => s.trim()).filter(Boolean);
    return parts.map(part => {
        // Extract format inside brackets [SRT], [PGS], [ASS], [Embedded]
        let format = '';
        const formatMatch = part.match(/\[(.*?)\]/);
        if (formatMatch) {
            format = formatMatch[1].trim();
        }

        // Extract extra tags like (SDH), (Forced)
        let tag = '';
        const tagMatch = part.match(/\((.*?)\)/);
        if (tagMatch) {
            tag = tagMatch[1].trim();
        }

        // Clean language name
        let langName = part.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim();
        const langLower = langName.toLowerCase();

        const meta = LANGUAGE_META[langLower] || {
            code: langName.slice(0, 2).toUpperCase(),
            flag: '💬',
            label: langName
        };

        return {
            raw: part,
            language: meta.label,   // normalised so filters match the API's LIKE
            code: meta.code,
            flag: meta.flag,
            format: format || 'SRT',
            tag: tag
        };
    });
}

// --- Format Subtitle Summary Badge for Cards ---
function getSubtitleCardBadge(subStr) {
    const list = parseSubtitles(subStr);
    if (!list || list.length === 0) return null;

    const badge = createElement('div', 'movie-badge badge-subtitles');
    badge.title = `Subtitles: ${subStr}`;

    if (list.length === 1) {
        badge.innerHTML = `<span class="sub-icon">💬</span> ${escapeHtml(list[0].code)}`;
    } else if (list.length <= 3) {
        const codes = list.map(s => s.code).join('·');
        badge.innerHTML = `<span class="sub-icon">💬</span> ${escapeHtml(codes)}`;
    } else {
        badge.innerHTML = `<span class="sub-icon">💬</span> ${escapeHtml(list[0].code + '+' + (list.length - 1))}`;
    }
    return badge;
}

// --- Render Subtitle Section in Details Modal ---
function renderModalSubtitles(subStr, container) {
    const subsList = parseSubtitles(subStr);

    const subSection = createElement('div', 'modal-subtitles-section');
    const headerRow = createElement('div', 'subtitles-header-row');

    const label = createElement('span', 'modal-label', 'SUBTITLES & AUDIO TRACKS');
    headerRow.appendChild(label);

    if (subsList.length > 0) {
        const copyBtn = createElement('button', 'copy-subtitles-btn', 'Copy Subs');
        copyBtn.title = 'Copy subtitle tracks';
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(subStr).then(() => {
                copyBtn.textContent = 'Copied!';
                showToast('Subtitle info copied to clipboard', 'success');
                setTimeout(() => copyBtn.textContent = 'Copy Subs', 1400);
            });
        });
        headerRow.appendChild(copyBtn);
    }
    subSection.appendChild(headerRow);

    if (subsList.length === 0) {
        const emptyMsg = createElement('div', 'subtitles-empty', 'No subtitles recorded for this title.');
        subSection.appendChild(emptyMsg);
        container.appendChild(subSection);
        return;
    }

    const chipsContainer = createElement('div', 'subtitles-chips-container');
    subsList.forEach(sub => {
        const chip = createElement('div', 'subtitle-chip');

        let chipHtml = `<span class="sub-chip-flag">${sub.flag}</span>`;
        chipHtml += `<span class="sub-chip-lang">${escapeHtml(sub.language)}</span>`;

        if (sub.tag) {
            chipHtml += `<span class="sub-chip-tag">${escapeHtml(sub.tag)}</span>`;
        }
        if (sub.format) {
            chipHtml += `<span class="sub-chip-format">${escapeHtml(sub.format)}</span>`;
        }

        chip.innerHTML = chipHtml;
        chip.title = `Filter library for ${sub.language} subtitles`;
        chip.style.cursor = 'pointer';

        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            smoothClose();
            advancedFilters.subtitles = [sub.language];
            updateFilterCount();
            fetchMovies(searchInput.value, 0, false);
            showToast(`Filtering for ${sub.language} subtitles`, 'info');
        });

        chipsContainer.appendChild(chip);
    });

    subSection.appendChild(chipsContainer);
    container.appendChild(subSection);
}
