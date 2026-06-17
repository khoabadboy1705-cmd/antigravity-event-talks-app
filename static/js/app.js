// Immediate Theme Check to prevent flash
if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-theme');
}

// Application State
let state = {
    releases: [],
    filteredReleases: [],
    searchQuery: '',
    selectedFilter: 'all',
    counts: {
        all: 0,
        Feature: 0,
        Changed: 0,
        Issue: 0,
        Deprecated: 0
    }
};

// Twitter limit constants
const MAX_TWEET_CHARS = 280;
const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * 9; // Radius is 9, Circumference is ~56.55

// DOM Elements
const feedLoader = document.getElementById('feed-loader');
const feedContent = document.getElementById('feed-content');
const feedEmpty = document.getElementById('feed-empty');
const feedError = document.getElementById('feed-error');
const errorMessageText = document.getElementById('error-message-text');
const btnRetryFetch = document.getElementById('btn-retry-fetch');
const btnRefresh = document.getElementById('btn-refresh');
const btnExportCsv = document.getElementById('btn-export-csv');
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const statTotalValue = document.getElementById('stat-total-value');
const statSourceValue = document.getElementById('stat-source-value');
const cacheTimeDisplay = document.getElementById('cache-time-display');

const searchInput = document.getElementById('search-input');
const btnClearSearch = document.getElementById('btn-clear-search');
const btnResetFilters = document.getElementById('btn-reset-filters');

const filterBtns = {
    all: document.getElementById('filter-all'),
    Feature: document.getElementById('filter-feature'),
    Changed: document.getElementById('filter-changed'),
    Issue: document.getElementById('filter-issue'),
    Deprecated: document.getElementById('filter-deprecated')
};

const badges = {
    all: document.getElementById('badge-all'),
    Feature: document.getElementById('badge-feature'),
    Changed: document.getElementById('badge-changed'),
    Issue: document.getElementById('badge-issue'),
    Deprecated: document.getElementById('badge-deprecated')
};

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCountText = document.getElementById('char-count-text');
const progressRingCircle = document.getElementById('progress-ring-circle');
const tweetLengthWarning = document.getElementById('tweet-length-warning');
const btnCopyTweet = document.getElementById('btn-copy-tweet');
const btnPublishTweet = document.getElementById('btn-publish-tweet');
const copyBtnText = document.getElementById('copy-btn-text');
const toastNotification = document.getElementById('toast-notification');
const toastMessage = document.getElementById('toast-message');
const tweetPreviewDate = document.getElementById('tweet-preview-date');

// Initial Setup & Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    fetchReleases();
    
    // Refresh listener
    btnRefresh.addEventListener('click', () => {
        fetchReleases(true);
    });

    // Export CSV listener
    btnExportCsv.addEventListener('click', exportToCsv);

    // Theme toggle listener
    btnThemeToggle.addEventListener('click', toggleTheme);

    // Retry fetch listener
    btnRetryFetch.addEventListener('click', () => {
        fetchReleases(true);
    });

    // Search input listener
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
        applyFiltersAndSearch();
    });

    // Clear search button
    btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        btnClearSearch.style.display = 'none';
        applyFiltersAndSearch();
        searchInput.focus();
    });

    // Reset filters empty state button
    btnResetFilters.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        btnClearSearch.style.display = 'none';
        setActiveFilter('all');
    });

    // Filter type listeners
    Object.keys(filterBtns).forEach(type => {
        filterBtns[type].addEventListener('click', () => {
            setActiveFilter(type);
        });
    });

    // Modal Close listeners
    btnCloseModal.addEventListener('click', closeModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeModal();
    });

    // Textarea input character count tracking
    tweetTextarea.addEventListener('input', updateCharCounter);

    // Copy to clipboard
    btnCopyTweet.addEventListener('click', copyTweetText);

    // Publish to Twitter
    btnPublishTweet.addEventListener('click', publishTweet);

    // Setup Progress Ring SVG
    progressRingCircle.style.strokeDasharray = `${PROGRESS_RING_CIRCUMFERENCE} ${PROGRESS_RING_CIRCUMFERENCE}`;
    progressRingCircle.style.strokeDashoffset = PROGRESS_RING_CIRCUMFERENCE;
});

// Set Active Filter Button
function setActiveFilter(type) {
    state.selectedFilter = type;
    Object.keys(filterBtns).forEach(key => {
        if (key === type) {
            filterBtns[key].classList.add('active');
        } else {
            filterBtns[key].classList.remove('active');
        }
    });
    applyFiltersAndSearch();
}

// Fetch Releases from Backend API
async function fetchReleases(force = false) {
    setLoadingState(true);
    try {
        const url = `/api/releases${force ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API returned HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
            state.releases = data.releases;
            
            // Format and display last updated
            const updateTime = new Date(data.timestamp * 1000);
            cacheTimeDisplay.textContent = `Last synced: ${updateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            
            // Show source type
            let sourceLabel = 'Cached';
            if (data.source === 'live') sourceLabel = 'Live Feed';
            if (data.source === 'fallback') sourceLabel = 'Offline Fallback';
            statSourceValue.textContent = sourceLabel;
            
            calculateStats();
            applyFiltersAndSearch();
            
            if (force) {
                showToast("Data refreshed successfully!");
            }
        } else {
            throw new Error(data.message || "Unknown server error");
        }
    } catch (error) {
        console.error("Error fetching release notes:", error);
        showToast(`Failed to fetch updates: ${error.message}`, true);
        statSourceValue.textContent = 'Error';
        
        if (!state.releases || state.releases.length === 0) {
            showErrorState(error.message);
        }
    } finally {
        setLoadingState(false);
    }
}

// Set UI Loading State
function setLoadingState(isLoading) {
    if (isLoading) {
        btnRefresh.classList.add('loading');
        btnRefresh.disabled = true;
        feedLoader.style.display = 'flex';
        feedContent.style.display = 'none';
        feedEmpty.style.display = 'none';
        feedError.style.display = 'none';
    } else {
        btnRefresh.classList.remove('loading');
        btnRefresh.disabled = false;
        feedLoader.style.display = 'none';
        
        if (state.releases && state.releases.length > 0) {
            feedContent.style.display = 'block';
        }
    }
}

// Show Initial Load Error State Screen
function showErrorState(message) {
    errorMessageText.textContent = `Failed to retrieve release updates: ${message}. Please verify your network connection.`;
    feedError.style.display = 'flex';
    feedContent.style.display = 'none';
    feedEmpty.style.display = 'none';
}

// Calculate Statistics and Counts for Sidebars
function calculateStats() {
    // Reset Counts
    state.counts = {
        all: 0,
        Feature: 0,
        Changed: 0,
        Issue: 0,
        Deprecated: 0
    };

    let total = 0;
    state.releases.forEach(release => {
        release.items.forEach(item => {
            total++;
            state.counts.all++;
            const type = item.type;
            if (state.counts[type] !== undefined) {
                state.counts[type]++;
            } else {
                // For other types (e.g. general updates or custom tags)
                // We map them to general or make dynamic counter if we want.
                // For safety, let's count only key ones or count them in general if missing.
            }
        });
    });

    // Update statistics badges on UI
    statTotalValue.textContent = total;
    badges.all.textContent = state.counts.all;
    badges.Feature.textContent = state.counts.Feature;
    badges.Changed.textContent = state.counts.Changed;
    badges.Issue.textContent = state.counts.Issue;
    badges.Deprecated.textContent = state.counts.Deprecated;
}

// Filter and Search Algorithm
function applyFiltersAndSearch() {
    let results = [];
    
    state.releases.forEach(release => {
        const filteredItems = release.items.filter(item => {
            // Check Type filter
            if (state.selectedFilter !== 'all' && item.type !== state.selectedFilter) {
                return false;
            }
            
            // Check Search query
            if (state.searchQuery) {
                const textMatch = item.text_content.toLowerCase().includes(state.searchQuery);
                const typeMatch = item.type.toLowerCase().includes(state.searchQuery);
                const dateMatch = release.date.toLowerCase().includes(state.searchQuery);
                return textMatch || typeMatch || dateMatch;
            }
            
            return true;
        });

        if (filteredItems.length > 0) {
            results.push({
                ...release,
                items: filteredItems
            });
        }
    });

    state.filteredReleases = results;
    renderFeed();
}

// Render Release Stream Feed Cards
function renderFeed() {
    feedContent.innerHTML = '';
    
    if (state.filteredReleases.length === 0) {
        feedContent.style.display = 'none';
        feedEmpty.style.display = 'flex';
        return;
    }
    
    feedEmpty.style.display = 'none';
    feedContent.style.display = 'block';

    state.filteredReleases.forEach(release => {
        // Create Date Header
        const dateHeader = document.createElement('h3');
        dateHeader.className = 'date-header';
        dateHeader.textContent = release.date;
        feedContent.appendChild(dateHeader);

        // Create cards for each update on this date
        release.items.forEach((item, index) => {
            const card = document.createElement('article');
            card.className = 'update-card';
            card.id = `card-${release.date.replace(/[^a-zA-Z0-9]/g, '_')}-${index}`;

            // Map standard badge types
            let typeClass = 'general';
            const normType = item.type.toLowerCase();
            if (normType.includes('feature')) typeClass = 'feature';
            else if (normType.includes('change')) typeClass = 'changed';
            else if (normType.includes('issue')) typeClass = 'issue';
            else if (normType.includes('deprecat')) typeClass = 'deprecated';

            // Card Header
            const headerDiv = document.createElement('div');
            headerDiv.className = 'update-card-header';
            
            const badgeSpan = document.createElement('span');
            badgeSpan.className = `type-badge ${typeClass}`;
            badgeSpan.textContent = item.type;
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'card-actions';
            
            const tweetBtn = document.createElement('button');
            tweetBtn.className = 'btn btn-card-tweet';
            tweetBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align: middle; margin-right: 4px;">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                </svg>
                <span>Tweet</span>
            `;
            
            // Hook up tweet dialog trigger
            tweetBtn.addEventListener('click', () => {
                openTweetComposer(release.date, item);
            });

            // Copy card content to clipboard trigger
            const copyBtn = document.createElement('button');
            copyBtn.className = 'btn btn-card-copy';
            copyBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy</span>
            `;
            copyBtn.addEventListener('click', () => {
                const textToCopy = `📢 BigQuery [${item.type.toUpperCase()}] (${release.date}):\n${item.text_content}`;
                navigator.clipboard.writeText(textToCopy)
                    .then(() => {
                        showToast("Card text copied to clipboard!");
                    })
                    .catch(err => {
                        console.error('Failed to copy text: ', err);
                        showToast("Failed to copy card text", true);
                    });
            });

            actionsDiv.appendChild(tweetBtn);
            actionsDiv.appendChild(copyBtn);
            headerDiv.appendChild(badgeSpan);
            headerDiv.appendChild(actionsDiv);

            // Card Body
            const bodyDiv = document.createElement('div');
            bodyDiv.className = 'update-card-body';
            bodyDiv.innerHTML = item.html_content;

            // Assemble Card
            card.appendChild(headerDiv);
            card.appendChild(bodyDiv);
            feedContent.appendChild(card);
        });
    });
}

// Open Tweet Composer Dialog Modal
function openTweetComposer(date, item) {
    // Generate tweet text templates
    const hashtags = "#BigQuery #GoogleCloud";
    const typeLabel = item.type.toUpperCase();
    
    // Parse links from the item HTML to optionally append to the tweet
    const docSoup = document.createElement('div');
    docSoup.innerHTML = item.html_content;
    const firstAnchor = docSoup.querySelector('a');
    const sourceLink = firstAnchor ? firstAnchor.href : "https://cloud.google.com/bigquery/docs/release-notes";

    // Clean text and create a preview text (replace linebreaks with spaces, truncate if too long)
    let cleanText = item.text_content.replace(/\s+/g, ' ').trim();
    
    // Generate a default text layout
    let tweetTemplate = `📢 BigQuery [${typeLabel}] (${date}):\n${cleanText}`;
    
    // Calculate space for link and hashtags
    // Standard link on Twitter takes exactly 23 characters regardless of actual length
    const twitterLinkLength = 23;
    const footerTemplate = `\n\n🔗 ${sourceLink}\n${hashtags}`;
    
    // If standard tweet layout exceeds the limit, truncate the main content block
    // We want: template length = textLength + link length (23) + footer styling chars
    const footerFakeText = `\n\n🔗 https://t.co/xxxxxxxxxx\n${hashtags}`;
    const charsRemainingForText = MAX_TWEET_CHARS - footerFakeText.length - `📢 BigQuery [${typeLabel}] (${date}):\n`.length;
    
    if (cleanText.length > charsRemainingForText) {
        cleanText = cleanText.substring(0, charsRemainingForText - 3).trim() + "...";
    }
    
    // Assemble final draft
    const finalTweetText = `📢 BigQuery [${typeLabel}] (${date}):\n${cleanText}\n\n🔗 ${sourceLink}\n${hashtags}`;

    // Popualate composer form
    tweetTextarea.value = finalTweetText;
    tweetPreviewDate.textContent = date;
    
    updateCharCounter();

    // Show modal with animation
    tweetModal.style.display = 'flex';
    // Small delay to allow CSS display flex block to initialize, then animate opacity
    setTimeout(() => {
        tweetModal.classList.add('active');
        tweetTextarea.focus();
    }, 10);
}

// Close Tweet Composer Modal
function closeModal() {
    tweetModal.classList.remove('active');
    setTimeout(() => {
        tweetModal.style.display = 'none';
    }, 300);
}

// Update Character limit and progress ring loader
function updateCharCounter() {
    const text = tweetTextarea.value;
    
    // Twitter handles URLs as taking 23 characters exactly. Let's do a basic url length mapping for accuracy!
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let computedLength = text.length;
    const urls = text.match(urlRegex);
    
    if (urls) {
        urls.forEach(url => {
            // Subtract original URL length and replace with standard 23 chars
            computedLength = computedLength - url.length + 23;
        });
    }

    const remaining = MAX_TWEET_CHARS - computedLength;
    
    // Update text counter
    charCountText.textContent = remaining;
    
    // Color states depending on limits
    if (remaining < 0) {
        charCountText.className = 'char-count danger';
        tweetLengthWarning.style.display = 'flex';
        progressRingCircle.style.stroke = '#f4212e';
    } else if (remaining <= 20) {
        charCountText.className = 'char-count warning';
        tweetLengthWarning.style.display = 'none';
        progressRingCircle.style.stroke = '#ffd400';
    } else {
        charCountText.className = 'char-count';
        tweetLengthWarning.style.display = 'none';
        progressRingCircle.style.stroke = '#1d9bf0';
    }

    // Update SVG Progress Ring
    const percentage = Math.min(computedLength / MAX_TWEET_CHARS, 1);
    const strokeDashoffset = PROGRESS_RING_CIRCUMFERENCE - (percentage * PROGRESS_RING_CIRCUMFERENCE);
    progressRingCircle.style.strokeDashoffset = strokeDashoffset;
}

// Copy Tweet text to Clipboard
function copyTweetText() {
    const text = tweetTextarea.value;
    navigator.clipboard.writeText(text)
        .then(() => {
            copyBtnText.textContent = "Copied!";
            btnCopyTweet.classList.add('success');
            showToast("Tweet text copied to clipboard!");
            
            setTimeout(() => {
                copyBtnText.textContent = "Copy Text";
                btnCopyTweet.classList.remove('success');
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy text: ', err);
            showToast("Failed to copy text", true);
        });
}

// Share via Twitter Web Intent
function publishTweet() {
    const text = tweetTextarea.value;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
    closeModal();
}

// Export filtered releases to CSV file
function exportToCsv() {
    if (!state.filteredReleases || state.filteredReleases.length === 0) {
        showToast("No data available to export!", true);
        return;
    }

    // Define CSV headers
    const headers = ["Date", "Type", "Content"];
    
    // Generate CSV rows
    const rows = [];
    state.filteredReleases.forEach(release => {
        release.items.forEach(item => {
            // Clean content: escape double quotes, strip outer spaces
            const escapedContent = item.text_content
                .replace(/"/g, '""') // Escape double quotes by doubling them
                .trim();
            
            rows.push([
                `"${release.date}"`,
                `"${item.type}"`,
                `"${escapedContent}"`
            ]);
        });
    });

    // Combine headers and rows
    const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
    ].join("\n");

    // Create a Blob with UTF-8 encoding (and BOM to support Excel opening CSV correctly with UTF-8 characters)
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Generate download link and trigger click
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    // Set appropriate filename with date/time of export
    const exportTime = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `bigquery_release_notes_${exportTime}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("CSV export completed successfully!");
}

// Toggle Light/Dark Theme
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    showToast(`${isLight ? 'Light' : 'Dark'} theme applied!`);
}

// Toast Notifications helper
function showToast(message, isError = false) {
    toastMessage.textContent = message;
    
    if (isError) {
        toastNotification.classList.add('error');
    } else {
        toastNotification.classList.remove('error');
    }
    
    toastNotification.classList.add('active');
    
    setTimeout(() => {
        toastNotification.classList.remove('active');
    }, 3500);
}
