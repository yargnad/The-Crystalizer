// This script runs on every page but only executes its core logic when loaded
// on a shared chat URL and when the popup sends a command.

// --- CORE FUNCTIONALITY ---

/**
 * Encapsulates the URL matching logic to check the current tab's URL
 * against a pattern stored in the configurations.
 * @param {string} url The current tab's URL.
 * @param {string} pattern The URL pattern from the config (e.g., *://*.google.com/share/*)
 * @returns {boolean} True if the URL matches the pattern.
 */
function matchesUrlPattern(url, pattern) {
    if (!url || !pattern) return false;

    // 1. Safely escape special regex characters except for the wildcard '*'
    let regexString = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    
    // 2. Convert extension wildcard '*' into regex wildcard '.*'
    regexString = regexString.replace(/\*/g, '.*');
    
    // 3. Handle protocol specificity (http:// vs https://)
    regexString = regexString.replace('://', ':\\/\\/');

    try {
        const regex = new RegExp(`^${regexString}$`, 'i');
        return regex.test(url);
    } catch (e) {
        console.error("[Crystalizer] Invalid URL Pattern Regex:", e);
        return false;
    }
}

/**
 * Attempts to find and return the configuration that matches the current URL.
 * @param {Array<Object>} configs All LLM configurations.
 * @returns {Object | null} Matching config object or null.
 */
function findMatchingConfig(configs) {
    const currentUrl = window.location.href;
    if (!configs) return null;

    for (const config of configs) {
        if (matchesUrlPattern(currentUrl, config.urlPattern)) {
            return config;
        }
    }
    return null;
}

/**
 * Runs the detection process and reports back to the popup.
 * This function is executed when the popup sends an RERUN_DETECTION message.
 * @param {Object} payload The message payload containing all LLM configurations.
 * @returns {Object} A response object for the popup.
 */
function runDetection(payload) {
    const configs = payload.configs;
    const isAutoDetectEnabled = payload.isAutoDetectEnabled;
    const match = findMatchingConfig(configs);
    
    if (!configs || configs.length === 0) {
        return { status: 'error', message: 'No platform configurations found.', payload: { match: null } };
    }

    if (!match) {
        const msg = isAutoDetectEnabled 
            ? 'Auto-detect ON. No configuration matched the current URL.' 
            : 'Detection OFF. No platform matched the current URL.';
        return { status: 'warning', message: msg, payload: { match: null } };
    }

    // Success response
    return {
        status: 'success',
        message: `Auto-detect SUCCESS! Matching config found for: ${match.name}`,
        payload: { match: { id: match.id, name: match.name, urlPattern: match.urlPattern } }
    };
}

/**
 * Executes the scraping process using the selected configuration.
 * @param {Object} payload Message payload containing the matched config.
 * @returns {Object} A response object for the popup.
 */
function scrapeChat(payload) {
    // First, auto-detect the platform if configs array is provided
    let config = payload.config;
    
    if (!config && payload.configs) {
        const match = findMatchingConfig(payload.configs);
        if (!match) {
            return { status: 'error', message: 'No matching platform configuration found for this page.', payload: null };
        }
        config = match;
    }
    
    if (!config) {
        return { status: 'error', message: 'No configuration provided for scraping.', payload: null };
    }
    
    console.log(`[Crystalizer] Scraper is running for: ${config.name}.`);

    try {
        // --- Core Scraping Logic ---
        const messageBlocks = document.querySelectorAll(config.selectors.messages);
        
        if (messageBlocks.length === 0) {
            console.warn("[Crystalizer] Scraper found 0 blocks. Selectors may be incorrect or page not fully loaded.");
            return { status: 'warning', message: '⚠️ Scraper found 0 blocks. Check selectors or refresh the page.', payload: { exchangeCount: 0 } };
        }

        // Extract exchanges with timestamps
        const exchanges = [];
        messageBlocks.forEach((block, index) => {
            // Determine if this is a user or model message
            const isUser = block.matches(config.selectors.user);
            const isModel = block.matches(config.selectors.model);
            
            const textContent = block.querySelector(config.selectors.text)?.textContent.trim() || 
                               block.textContent.trim();
            
            if (textContent) {
                exchanges.push({ 
                    speaker: isUser ? 'user' : (isModel ? 'model' : 'unknown'),
                    text: textContent,
                    timestamp: Date.now() + index, // Sequential timestamps
                    index: index
                });
            }
        });
        
        // --- Data Structuring ---
        const scrapedData = {
            chatId: window.location.href,
            platformId: config.id,
            platformName: config.name,
            timestamp: Date.now(),
            exchanges: exchanges
        };

        return { 
            status: 'success', 
            message: `✅ Scraped ${exchanges.length} exchanges from ${config.name}!`, 
            payload: { data: scrapedData, exchangeCount: exchanges.length } 
        };

    } catch (e) {
        console.error("[Crystalizer] Scraping Failed:", e);
        return { status: 'error', message: `❌ Scraping failed: ${e.message}`, payload: { exchangeCount: 0 } };
    }
}


// --- Message Listener Initialization ---

/**
 * Runs immediately upon page load to set up the message listener.
 */
function initializeContentScript() {
    // This listener must be set up immediately so the receiver exists when the popup sends a message.
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (!request || !request.action) return false;

        switch (request.action) {
            case 'RERUN_DETECTION':
                // The popup sends configurations and asks the content script to detect the platform.
                const detectionResult = runDetection(request.payload);
                sendResponse(detectionResult);
                break;
            
            case 'SCRAPE_CHAT':
                // The popup asks the content script to scrape using the confirmed config.
                const scrapeResult = scrapeChat(request.payload);
                sendResponse(scrapeResult);
                break;

            default:
                // Unhandled action
                return false; 
        }

        // Return true to indicate that the response will be sent asynchronously (required for sendMessage)
        return true; 
    });

    console.log("[Crystalizer] Content script listener active.");
}

initializeContentScript();
