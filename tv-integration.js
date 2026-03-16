/**
 * TunnelVision Integration
 * When TunnelVision is installed, injects NG tool activity into TV's feed panel
 * instead of showing a separate NG feed widget. Falls back gracefully when TV is absent.
 *
 * TV DOM structure:
 *   .tv-float-trigger      → trigger button (bottom-left)
 *   .tv-float-panel        → panel container
 *     .tv-float-panel-body → where feed items live
 *     .tv-float-panel-tabs → "All" | "Entries" | "Tools" tabs
 */

const LOG_PREFIX = '[NemosGuides:TVIntegration]';

/** Whether TV was detected and integration is active. */
let tvDetected = false;

/** Reference to TV's feed body for injecting items. */
let tvFeedBody = null;

/**
 * Check if TunnelVision's activity feed is present in the DOM.
 * @returns {boolean}
 */
export function isTunnelVisionPresent() {
    return !!document.querySelector('.tv-float-panel');
}

/**
 * Initialize TV integration.
 * Call this after the NG activity feed is initialized.
 * If TV is detected, hides the NG trigger and prepares to inject into TV's feed.
 */
export function initTVIntegration() {
    // Check immediately
    if (detectTV()) return;

    // TV's feed might appear later (lazy init when lorebook is enabled)
    // Use a MutationObserver to detect when it appears
    const observer = new MutationObserver(() => {
        if (!tvDetected && detectTV()) {
            observer.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: false });

    // Stop observing after 30 seconds to avoid indefinite watching
    setTimeout(() => observer.disconnect(), 30000);
}

/**
 * Try to detect TV's feed and set up integration.
 * @returns {boolean} Whether TV was detected
 */
function detectTV() {
    const panel = document.querySelector('.tv-float-panel');
    if (!panel) return false;

    tvFeedBody = panel.querySelector('.tv-float-panel-body');
    if (!tvFeedBody) return false;

    tvDetected = true;

    // Hide NG's own trigger button — TV's feed will show our items
    const ngTrigger = document.querySelector('.ng-feed-trigger');
    if (ngTrigger) {
        ngTrigger.style.display = 'none';
    }

    // Hide NG's own panel
    const ngPanel = document.querySelector('.ng-feed-panel');
    if (ngPanel) {
        ngPanel.style.display = 'none';
    }

    console.log(`${LOG_PREFIX} TunnelVision detected — injecting NG activity into TV feed.`);
    return true;
}

/**
 * Check if TV integration is active.
 * @returns {boolean}
 */
export function isTVIntegrationActive() {
    return tvDetected && !!tvFeedBody;
}

/**
 * Inject an NG feed item into TV's feed panel.
 * Matches TV's item styling so NG items look native.
 * @param {object} item - Feed item data
 * @param {string} item.icon - FontAwesome icon class
 * @param {string} item.verb - Action verb (e.g. "Assessing")
 * @param {string} item.displayName - Tool display name
 * @param {string} item.color - Accent color
 * @param {'running'|'done'|'error'} item.status
 * @param {string} item.summary
 * @param {number} item.timestamp
 * @returns {HTMLElement|null} The created element, or null if TV not active
 */
export function injectIntoTVFeed(item) {
    if (!tvDetected || !tvFeedBody) return null;

    // Remove the "No activity yet" placeholder if present
    const empty = tvFeedBody.querySelector('.tv-float-empty');
    if (empty) empty.style.display = 'none';

    const el = document.createElement('div');
    el.className = 'tv-float-item ng-tv-item';
    el.dataset.source = 'nemos-guides';
    el.dataset.status = item.status;

    const statusIcon = item.status === 'running'
        ? '<i class="fa-solid fa-spinner fa-spin"></i>'
        : item.status === 'done'
            ? '<i class="fa-solid fa-check"></i>'
            : '<i class="fa-solid fa-xmark"></i>';

    const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    el.innerHTML = `
        <div class="tv-float-item-icon" style="color: ${item.color}">
            <i class="fa-solid ${item.icon}"></i>
        </div>
        <div class="tv-float-item-body">
            <div class="tv-float-item-header">
                <span class="ng-tv-badge">NG</span>
                <span class="tv-float-item-verb" style="color: ${item.color}">${item.verb}</span>
                <span class="tv-float-item-name">${item.displayName}</span>
                <span class="tv-float-item-status">${statusIcon}</span>
            </div>
            <div class="tv-float-item-summary">${item.summary || ''}</div>
            <div class="tv-float-item-time">${time}</div>
        </div>
    `;

    // Insert at top of feed body
    tvFeedBody.prepend(el);

    // Add entry animation
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
    requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
    });

    return el;
}

/**
 * Update an existing NG item in TV's feed.
 * @param {HTMLElement} el - The element to update
 * @param {object} updates
 * @param {'done'|'error'} updates.status
 * @param {string} [updates.summary]
 */
export function updateTVFeedItem(el, updates) {
    if (!el) return;

    el.dataset.status = updates.status;

    const statusEl = el.querySelector('.tv-float-item-status');
    if (statusEl) {
        statusEl.innerHTML = updates.status === 'done'
            ? '<i class="fa-solid fa-check" style="color: #55efc4"></i>'
            : '<i class="fa-solid fa-xmark" style="color: #ef4444"></i>';
    }

    if (updates.summary) {
        const summaryEl = el.querySelector('.tv-float-item-summary');
        if (summaryEl) summaryEl.textContent = updates.summary;
    }
}
