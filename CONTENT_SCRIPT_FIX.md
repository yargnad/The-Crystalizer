# 🔧 Content Script Messaging Fix - October 13, 2025

## 🐛 Issue Reported
```
[Crystalizer] Messaging Error: Could not establish connection. Receiving end does not exist.
Context: curator_ui.html
Stack Trace: popup.js:118 (anonymous function)
```

## 🔍 Root Cause Analysis

### The Problem
When the extension popup opens, it immediately tries to:
1. Call `triggerInitialDetection()` during `loadAppState()`
2. Send a message to the content script via `sendMessageToContentScript('RERUN_DETECTION', ...)`
3. But the content script hasn't been injected yet into the current tab

### Why This Happens
**Manifest V3 Behavior:**
- Content scripts defined in `manifest.json` are only injected when pages load
- If the user opens the popup on:
  - A browser page (`chrome://`, `edge://`, `opera://`)
  - An extension page
  - A page loaded before the extension was installed
  - The content script won't exist, causing "Receiving end does not exist" error

### Impact
- ❌ Error logs in console (alarming but non-fatal)
- ❌ Detection shows "Error: Receiver not ready"
- ✅ Extension still functions (user can manually trigger scrape on valid pages)

## ✅ Solution Implemented

### Fix 1: Programmatic Content Script Injection
**Updated:** `triggerInitialDetection()` function

**Before:**
```javascript
function triggerInitialDetection() {
    const isAutoDetectEnabled = document.getElementById('autoDetectToggle')?.checked;
    if (!isAutoDetectEnabled) {
        updateDetectedPlatform('Auto-Detect OFF', '');
        return;
    }
    sendMessageToContentScript('RERUN_DETECTION', { configs: llmConfigs, isAutoDetectEnabled });
}
```

**After:**
```javascript
function triggerInitialDetection() {
    const isAutoDetectEnabled = document.getElementById('autoDetectToggle')?.checked;
    if (!isAutoDetectEnabled) {
        updateDetectedPlatform('Auto-Detect OFF', '');
        return;
    }

    // Get active tab and validate
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0 || !tabs[0].url) {
            updateDetectedPlatform('No active tab', '');
            return;
        }
        
        const url = tabs[0].url;
        
        // Skip browser system pages
        if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || 
            url.startsWith('edge://') || url.startsWith('opera://')) {
            updateDetectedPlatform('Browser page (no detection)', '');
            return;
        }
        
        // Programmatically inject content script
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content_script.js']
        }).then(() => {
            // Script injected successfully, send message
            sendMessageToContentScript('RERUN_DETECTION', { configs: llmConfigs, isAutoDetectEnabled });
        }).catch((error) => {
            // Script already injected or injection failed - try anyway
            console.log('[triggerInitialDetection] Script injection not needed or failed:', error.message);
            sendMessageToContentScript('RERUN_DETECTION', { configs: llmConfigs, isAutoDetectEnabled });
        });
    });
}
```

**What This Does:**
1. ✅ Checks if current tab is a browser system page → show friendly message
2. ✅ Attempts to inject content script programmatically using `chrome.scripting.executeScript()`
3. ✅ If injection succeeds → send detection message
4. ✅ If injection fails (script already there) → send message anyway
5. ✅ Graceful degradation at every step

### Fix 2: Graceful Error Handling
**Updated:** Error handling in `sendMessageToContentScript()`

**Before:**
```javascript
if (chrome.runtime.lastError) {
    const errorMsg = chrome.runtime.lastError.message;
    console.error("[Crystalizer] Messaging Error:", errorMsg);
    
    if (errorMsg.includes('Receiving end does not exist')) {
        updateStatus('Error: Receiver not ready. Try reloading...', 'error');
    }
}
```

**After:**
```javascript
if (chrome.runtime.lastError) {
    const errorMsg = chrome.runtime.lastError.message;
    console.warn("[Crystalizer] Messaging Error:", errorMsg);
    
    if (errorMsg.includes('Receiving end does not exist')) {
        // For initial detection, fail silently
        if (action === 'RERUN_DETECTION') {
            console.log('[Crystalizer] Content script not ready. This is normal on browser pages.');
            updateDetectedPlatform('Page not supported', '');
        } else {
            updateStatus('⚠️ Content script not loaded. Try reloading the page.', 'warning');
        }
    } else {
        updateStatus(`⚠️ Messaging failed: ${errorMsg}`, 'warning');
    }
}
```

**What This Does:**
1. ✅ Changed `console.error` → `console.warn` (less alarming)
2. ✅ For `RERUN_DETECTION` action → fail silently with friendly message
3. ✅ For other actions (like scraping) → show actionable warning
4. ✅ Changed status from 'error' → 'warning' with emoji

## 🧪 Testing Scenarios

### Scenario 1: Opening Popup on New Tab Page
**Expected:**
- ✅ No error shown to user
- ✅ Detection shows: "Browser page (no detection)"
- ✅ Console shows: "Script injection not needed or failed"

### Scenario 2: Opening Popup on Gemini Chat
**Expected:**
- ✅ Content script injected programmatically (or already present)
- ✅ Detection shows: "Google Gemini (ID: gemini)"
- ✅ User can click "Scrape Current Chat"

### Scenario 3: Opening Popup on Random Website
**Expected:**
- ✅ Content script injected programmatically
- ✅ Detection shows: "Platform not detected" or matched platform
- ✅ No errors in console

### Scenario 4: User Reloads Extension While on Gemini
**Expected:**
- ✅ Content script re-injected on next popup open
- ✅ Detection works immediately
- ✅ Scraping works without page reload

## 📋 User Action Required

### Step 1: Reload the Extension
1. Go to Opera Extensions page (`opera://extensions`)
2. Find "Crystalizer Context Curator"
3. Click the **Reload** button (🔄)

### Step 2: Test the Fix
1. Open extension popup on **any page** (should not show error)
2. Navigate to a Gemini chat
3. Open extension popup → should detect "Google Gemini"
4. Try scraping → should work

### What to Expect
- ✅ No more "Receiving end does not exist" error
- ✅ Friendly messages on browser system pages
- ✅ Auto-detection works on LLM chat pages
- ✅ Scraping works without manual page reloads

## 🔧 Technical Notes

### Manifest V3 Changes Required
The `manifest.json` already has the required permission:
```json
"permissions": [
    "scripting",  // ✅ Required for chrome.scripting.executeScript()
    "activeTab",  // ✅ Required for accessing current tab
    "tabs"        // ✅ Required for chrome.tabs.query()
]
```

### Content Script Injection Pattern
```javascript
// Manifest V2 (old way - not reliable)
chrome.tabs.executeScript(tabId, { file: 'content_script.js' });

// Manifest V3 (new way - used in fix)
chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content_script.js']
});
```

### Why Programmatic Injection?
1. **Reliability:** Ensures script is present when needed
2. **Flexibility:** Works on pages loaded before extension install
3. **Graceful:** Handles already-injected scripts elegantly
4. **MV3 Compliant:** Uses modern Chrome Extension API

## 🎯 Follow-Up Actions

### Immediate (Done ✅)
- ✅ Implement programmatic injection
- ✅ Add URL validation (skip browser pages)
- ✅ Improve error messaging
- ✅ Change error → warning for better UX

### Optional Enhancements (Future)
- 🔮 Add visual indicator when content script successfully injected
- 🔮 Add "Retry Detection" button if initial detection fails
- 🔮 Cache detection results to avoid repeated injections
- 🔮 Add detection status: "Detecting..." → "Detected" → "Ready"

## 📝 Related Files Modified
- `popup.js` (2 functions updated)
  - `triggerInitialDetection()` - Added programmatic injection
  - `sendMessageToContentScript()` - Improved error handling

## 🏆 Expected Outcome
- ✅ Error-free popup opening on all pages
- ✅ Automatic platform detection on LLM chats
- ✅ Clear, actionable messages for users
- ✅ No need to reload pages manually
- ✅ Better developer experience (fewer console errors)

---

**Status:** Fix implemented and ready for testing  
**Confidence:** High (follows Manifest V3 best practices)  
**User Impact:** Significantly improved UX
