/**
 * Archive Integration Module for Crystalizer Context Curator
 * Integrates IndexedDB archival system with existing persona workflow
 */

// Archive integration state
let currentViewedChatId = null;
let lastSavedPersonaForFacts = null;

/**
 * Initialize archive integration
 */
async function initArchiveIntegration() {
    console.log('Initializing archive integration...');
    
    // Update storage stats
    await updateStorageStats();
    
    // Set up event listeners
    setupArchiveEventListeners();
    
    // Update habit streak
    await updateHabitStreak();
    
    console.log('Archive integration initialized');
}

/**
 * Set up event listeners for archive functionality
 */
function setupArchiveEventListeners() {
    // Step 1 -> Step 1.5 navigation
    const nextStep1Btn = document.getElementById('nextStep1Btn');
    if (nextStep1Btn) {
        nextStep1Btn.addEventListener('click', () => navigateToPanel('step1_5'));
    }
    
    // Step 1.5 navigation
    const backToStep1Btn = document.getElementById('backToStep1Btn');
    const nextToStep2Btn = document.getElementById('nextToStep2Btn');
    
    if (backToStep1Btn) {
        backToStep1Btn.addEventListener('click', () => navigateToPanel('step1'));
    }
    
    if (nextToStep2Btn) {
        nextToStep2Btn.addEventListener('click', () => navigateToPanel('step2'));
    }
    
    // Search functionality
    const searchArchiveBtn = document.getElementById('searchArchiveBtn');
    if (searchArchiveBtn) {
        searchArchiveBtn.addEventListener('click', performArchiveSearch);
    }
    
    // Real-time search on input
    const archiveSearchInput = document.getElementById('archiveSearchInput');
    if (archiveSearchInput) {
        let searchTimeout;
        archiveSearchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(performArchiveSearch, 500);
        });
    }
    
    // Export buttons
    const exportSQLiteBtn = document.getElementById('exportSQLiteBtn');
    const exportJSONBtn = document.getElementById('exportJSONBtn');
    
    if (exportSQLiteBtn) {
        exportSQLiteBtn.addEventListener('click', exportToSQLite);
    }
    
    if (exportJSONBtn) {
        exportJSONBtn.addEventListener('click', exportToJSON);
    }
    
    // Canonical facts dialog
    const saveFactsBtn = document.getElementById('saveFactsBtn');
    const skipFactsBtn = document.getElementById('skipFactsBtn');
    
    if (saveFactsBtn) {
        saveFactsBtn.addEventListener('click', saveCanonicalFacts);
    }
    
    if (skipFactsBtn) {
        skipFactsBtn.addEventListener('click', skipCanonicalFacts);
    }
    
    // Chat viewer modal
    const closeChatViewerBtn = document.getElementById('closeChatViewerBtn');
    const deleteViewedChatBtn = document.getElementById('deleteViewedChatBtn');
    const exportViewedChatBtn = document.getElementById('exportViewedChatBtn');
    
    if (closeChatViewerBtn) {
        closeChatViewerBtn.addEventListener('click', closeChatViewer);
    }
    
    if (deleteViewedChatBtn) {
        deleteViewedChatBtn.addEventListener('click', deleteViewedChat);
    }
    
    if (exportViewedChatBtn) {
        exportViewedChatBtn.addEventListener('click', exportViewedChat);
    }
}

/**
 * Update storage statistics display
 */
async function updateStorageStats() {
    try {
        const stats = await storageManager.getStorageStats();
        
        if (stats) {
            const chatCountEl = document.getElementById('archivedChatCount');
            const storageUsedEl = document.getElementById('storageUsed');
            const storageWarningEl = document.getElementById('storageWarning');
            
            if (chatCountEl) {
                chatCountEl.textContent = stats.chatCount;
            }
            
            if (storageUsedEl && stats.quota) {
                const usedMB = (stats.quota.usage / (1024 * 1024)).toFixed(2);
                storageUsedEl.textContent = `${usedMB} MB`;
            }
            
            if (storageWarningEl && stats.quota && stats.quota.warning) {
                storageWarningEl.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Error updating storage stats:', error);
    }
}

/**
 * Perform archive search
 */
async function performArchiveSearch() {
    try {
        const searchInput = document.getElementById('archiveSearchInput');
        const platformFilter = document.getElementById('platformFilter');
        const dateFromFilter = document.getElementById('dateFromFilter');
        const dateToFilter = document.getElementById('dateToFilter');
        const resultsContainer = document.getElementById('searchResults');
        
        if (!searchInput || !resultsContainer) return;
        
        const query = searchInput.value.trim();
        
        // Build filters
        const filters = {};
        
        if (platformFilter && platformFilter.value) {
            filters.platformId = platformFilter.value;
        }
        
        if (dateFromFilter && dateFromFilter.value) {
            filters.dateFrom = new Date(dateFromFilter.value).getTime();
        }
        
        if (dateToFilter && dateToFilter.value) {
            filters.dateTo = new Date(dateToFilter.value).getTime();
        }
        
        // Perform search
        let results;
        if (query) {
            results = await storageManager.searchByContent(query);
            
            // Apply filters to results
            if (filters.platformId) {
                results = results.filter(r => r.platformId === filters.platformId);
            }
            if (filters.dateFrom) {
                results = results.filter(r => r.timestamp >= filters.dateFrom);
            }
            if (filters.dateTo) {
                results = results.filter(r => r.timestamp <= filters.dateTo);
            }
        } else {
            results = await storageManager.getAllRecords(filters);
        }
        
        // Display results
        displaySearchResults(results, resultsContainer);
        
    } catch (error) {
        console.error('Error performing search:', error);
    }
}

/**
 * Display search results
 */
function displaySearchResults(results, container) {
    if (!container) return;
    
    if (results.length === 0) {
        container.innerHTML = '<p class="text-indigo-400/70 italic text-center py-8 text-sm">No results found.</p>';
        return;
    }
    
    container.innerHTML = results.map(result => `
        <div class="p-3 bg-indigo-900/30 rounded-lg border border-indigo-700/30 mb-2 hover:bg-indigo-900/50 transition cursor-pointer" 
             data-chat-id="${result.id}"
             onclick="viewChatDetails('${result.id}')">
            <div class="flex justify-between items-start mb-1">
                <span class="font-semibold text-indigo-300 text-sm">${escapeHtml(result.userLabel)}</span>
                <span class="text-xs text-white/50">${result.platformName}</span>
            </div>
            <div class="text-xs text-white/70 mb-1">${escapeHtml(result.autoGeneratedTitle)}</div>
            <div class="text-xs text-white/50 truncate">${escapeHtml(result.contentSnippet)}</div>
            <div class="flex justify-between items-center mt-2">
                <span class="text-xs text-white/40">${new Date(result.timestamp).toLocaleDateString()}</span>
                <button class="text-xs text-indigo-400 hover:text-indigo-300" onclick="event.stopPropagation(); viewChatDetails('${result.id}')">View Full →</button>
            </div>
        </div>
    `).join('');
}

/**
 * View chat details in modal
 */
async function viewChatDetails(chatId) {
    try {
        const modal = document.getElementById('chatViewerModal');
        const content = document.getElementById('chatViewerContent');
        
        if (!modal || !content) return;
        
        // Get chat from IndexedDB
        const chats = await storageManager.getAllRecords();
        const chat = chats.find(c => c.id === chatId);
        
        if (!chat) {
            console.error('Chat not found:', chatId);
            return;
        }
        
        currentViewedChatId = chatId;
        
        // Parse exchanges
        const exchanges = JSON.parse(chat.fullContent);
        
        // Build HTML
        content.innerHTML = `
            <div class="mb-4">
                <h4 class="font-bold text-indigo-300 text-lg mb-1">${escapeHtml(chat.userLabel)}</h4>
                <div class="text-sm text-white/70 mb-1">${escapeHtml(chat.autoGeneratedTitle)}</div>
                <div class="flex items-center space-x-3 text-xs text-white/50">
                    <span>🏷️ ${chat.platformName}</span>
                    <span>📅 ${new Date(chat.timestamp).toLocaleString()}</span>
                    <span>💬 ${exchanges.length} exchanges</span>
                </div>
            </div>
            
            <div class="space-y-3">
                ${exchanges.map((ex, idx) => `
                    <div class="p-3 rounded-lg ${ex.speaker === 'user' ? 'bg-blue-900/20 border border-blue-700/30' : 'bg-purple-900/20 border border-purple-700/30'}">
                        <div class="font-semibold text-sm mb-1 ${ex.speaker === 'user' ? 'text-blue-300' : 'text-purple-300'}">
                            ${ex.speaker === 'user' ? '👤 User' : '🤖 ' + chat.platformName}
                        </div>
                        <div class="text-sm text-white/90 whitespace-pre-wrap">${escapeHtml(ex.text)}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        modal.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error viewing chat details:', error);
    }
}

/**
 * Close chat viewer modal
 */
function closeChatViewer() {
    const modal = document.getElementById('chatViewerModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentViewedChatId = null;
}

/**
 * Delete viewed chat
 */
async function deleteViewedChat() {
    if (!currentViewedChatId) return;
    
    if (!confirm('Are you sure you want to delete this archived chat? This cannot be undone.')) {
        return;
    }
    
    try {
        await storageManager.deleteRecord(currentViewedChatId);
        closeChatViewer();
        await performArchiveSearch(); // Refresh results
        await updateStorageStats();
        alert('Chat deleted successfully!');
    } catch (error) {
        console.error('Error deleting chat:', error);
        alert('Error deleting chat. Please try again.');
    }
}

/**
 * Export viewed chat
 */
async function exportViewedChat() {
    if (!currentViewedChatId) return;
    
    try {
        const chats = await storageManager.getAllRecords();
        const chat = chats.find(c => c.id === currentViewedChatId);
        
        if (!chat) return;
        
        const exchanges = JSON.parse(chat.fullContent);
        
        // Build markdown
        let markdown = `# ${chat.userLabel}\n\n`;
        markdown += `**Platform:** ${chat.platformName}  \n`;
        markdown += `**Date:** ${new Date(chat.timestamp).toLocaleString()}  \n`;
        markdown += `**Title:** ${chat.autoGeneratedTitle}\n\n`;
        markdown += `---\n\n`;
        
        for (const ex of exchanges) {
            markdown += `### ${ex.speaker === 'user' ? '👤 User' : '🤖 ' + chat.platformName}\n\n`;
            markdown += `${ex.text}\n\n`;
        }
        
        // Download
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${chat.userLabel.replace(/[^a-z0-9]/gi, '_')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Error exporting chat:', error);
        alert('Error exporting chat. Please try again.');
    }
}

/**
 * Export to SQLite
 */
async function exportToSQLite() {
    try {
        const preview = await sqliteExporter.getExportPreview();
        
        if (!preview || preview.recordCount === 0) {
            alert('No chats to export!');
            return;
        }
        
        if (!confirm(`Export ${preview.recordCount} chats (${preview.estimatedSize}) to SQLite database?`)) {
            return;
        }
        
        // Show loading
        const btn = document.getElementById('exportSQLiteBtn');
        const originalText = btn.textContent;
        btn.textContent = '⏳ Exporting...';
        btn.disabled = true;
        
        const filename = await sqliteExporter.downloadDatabase({ includeFacts: true });
        
        alert(`Successfully exported to ${filename}!`);
        
        btn.textContent = originalText;
        btn.disabled = false;
        
    } catch (error) {
        console.error('Error exporting to SQLite:', error);
        alert('Error exporting to SQLite. Please try again.');
        
        const btn = document.getElementById('exportSQLiteBtn');
        btn.textContent = '📊 Export SQLite DB';
        btn.disabled = false;
    }
}

/**
 * Export to JSON
 */
async function exportToJSON() {
    try {
        const jsonData = await storageManager.exportAsJSON();
        
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `crystalizer_archive_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('Archive exported to JSON successfully!');
        
    } catch (error) {
        console.error('Error exporting to JSON:', error);
        alert('Error exporting to JSON. Please try again.');
    }
}

/**
 * Show canonical facts capture dialog
 */
function showCanonicalFactsDialog(personaData) {
    const dialog = document.getElementById('canonicalFactsDialog');
    if (!dialog) return;
    
    lastSavedPersonaForFacts = personaData;
    
    // Clear previous inputs
    document.getElementById('fact1Input').value = '';
    document.getElementById('fact2Input').value = '';
    document.getElementById('fact3Input').value = '';
    
    dialog.classList.remove('hidden');
}

/**
 * Save canonical facts
 */
async function saveCanonicalFacts() {
    try {
        const fact1 = document.getElementById('fact1Input').value.trim();
        const fact2 = document.getElementById('fact2Input').value.trim();
        const fact3 = document.getElementById('fact3Input').value.trim();
        
        if (!fact1 || !fact2 || !fact3) {
            alert('Please fill in all 3 facts!');
            return;
        }
        
        if (!lastSavedPersonaForFacts) {
            console.error('No persona data available for facts');
            return;
        }
        
        await storageManager.addCanonicalFact({
            chatId: lastSavedPersonaForFacts.id,
            facts: [fact1, fact2, fact3],
            userLabel: lastSavedPersonaForFacts.userLabel
        });
        
        // Hide dialog
        document.getElementById('canonicalFactsDialog').classList.add('hidden');
        
        // Update streak
        await updateHabitStreak();
        
        alert('✨ Canonical facts saved! Keep building your habit-stack!');
        
    } catch (error) {
        console.error('Error saving canonical facts:', error);
        alert('Error saving facts. Please try again.');
    }
}

/**
 * Skip canonical facts
 */
function skipCanonicalFacts() {
    document.getElementById('canonicalFactsDialog').classList.add('hidden');
    lastSavedPersonaForFacts = null;
}

/**
 * Update habit streak display
 */
async function updateHabitStreak() {
    try {
        const count = await storageManager.getSessionCount();
        const streakEl = document.getElementById('sessionStreakCount');
        
        if (streakEl) {
            streakEl.textContent = count;
        }
    } catch (error) {
        console.error('Error updating habit streak:', error);
    }
}

/**
 * Archive a persona after saving
 */
async function archivePersona(personaData) {
    try {
        // Extract data for archival
        const chatData = {
            platformId: personaData.platformId,
            platformName: personaData.platformName,
            userLabel: personaData.name,
            exchanges: personaData.exchanges,
            urlReference: personaData.url || '',
            tags: personaData.tags || []
        };
        
        await storageManager.addChatRecord(chatData);
        await updateStorageStats();
        
        // Show canonical facts dialog
        showCanonicalFactsDialog(personaData);
        
    } catch (error) {
        console.error('Error archiving persona:', error);
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available
window.viewChatDetails = viewChatDetails;
window.archivePersona = archivePersona;
window.initArchiveIntegration = initArchiveIntegration;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initArchiveIntegration);
} else {
    initArchiveIntegration();
}
