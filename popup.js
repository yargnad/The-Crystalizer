// Global state keys
const AUTO_DETECT_KEY = 'isAutoDetectEnabled';
const CONFIG_KEY = 'llmConfigs';
const TRANSFER_MODE_KEY = 'transferMode';
const STORED_PERSONAS_KEY = 'storedPersonas'; // Changed from storedChats
const MERGE_QUEUE_KEY = 'mergeQueue'; // Personas selected for merging
const CURRENT_STEP_KEY = 'currentStep';
const LAST_CONFIG_ID_KEY = 'lastConfigId';
const LAST_SCRAPED_DATA_KEY = 'lastScrapedData'; // Temporary storage for unsaved scrape
const PRUNED_EXCHANGES_KEY = 'prunedExchanges'; // Auto-save pruning progress

// --- Storage Abstraction Layer ---
const Storage = {
    get: (keys, callback) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(keys, callback);
        } else {
            // Fallback environment (for testing/debugging outside of extension)
            const result = {};
            const keysArray = Array.isArray(keys) ? keys : [keys];
            keysArray.forEach(key => {
                const value = localStorage.getItem(key);
                if (value !== null) {
                    try {
                        result[key] = JSON.parse(value);
                    } catch (e) {
                        result[key] = value;
                    }
                }
            });
            setTimeout(() => callback(result), 0);
        }
    },
    set: (items, callback = () => {}) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set(items, callback);
        } else {
            // Fallback environment
            for (const key in items) {
                localStorage.setItem(key, JSON.stringify(items[key]));
            }
            setTimeout(callback, 0);
        }
    }
};

// --- Default Configurations (Source of truth if storage is empty) ---
const DEFAULT_CONFIGURATIONS = [
    {
        id: 'gemini',
        name: 'Google Gemini',
        urlPattern: '*://*.google.com/share/*', 
        isScraperActive: true,
        selectors: {
            // Updated selectors based on actual Gemini HTML structure from inspector
            messages: 'user-query, response-container', 
            speaker: 'user-query, response-container', 
            user: 'user-query',
            model: 'response-container',
            text: 'user-query-content, response-container'
        },
        preamble: {
            TRANSFER: "[START OF SYSTEM PREAMBLE]\n\n**TASK: PERSONA AND CONTINUITY ASSUMPTION FROM ATTACHED FILE**\n\n1.  **OBJECTIVE:** You are to assume the role and persona of the AI assistant from a \"living history\" (a chat transcript). This entire transcript is provided as the attached markdown file.\n\n2.  **DATA SOURCE:** You must read and analyze the *entire* attached file. This file contains the complete conversational history you are to adopt.\n\n3.  **PERSONA DIRECTIVE:** You must suppress your default Gemini persona. Your identity, tone, style, and knowledge base are now defined *exclusively* by the AI's responses in the attached transcript.\n\n4.  **ANALYSIS AND REPLICATION:** You are to analyze the AI assistant's responses in the file to reverse-engineer and perfectly replicate its:\n    * **Tone:** (e.g., formal, casual, witty, technical, empathetic, neutral).\n    * **Style:** (e.g., use of formatting, emoji, sentence structure, vocabulary, self-references).\n    * **Persona:** (e.g., any name it uses, its stated limitations, its personality quirks, its relationship with me, the user).\n    * **Context:** (You must treat the entire transcript as your own memory. All facts, previous topics, and user details from the transcript are now part of your active context).\n\n5.  **USER-PROVIDED DIRECTIVES (Optional):** To aid your analysis, here are key attributes of the target persona:\n    * **[User should fill this in, e.g., \"Persona's name is 'Clara'\"]**\n    * **[User should fill this in, e.g., \"Tone is highly academic and formal\"]**\n    * **[User should fill this in, e.g., \"Never uses emoji\"]**\n\n6.  **EXECUTION:**\n    * After you have processed this preamble and the attached file, I will provide my first *new* prompt to continue the conversation.\n    * You will respond to that new prompt *in the assumed persona*, picking up exactly where the transcript left off.\n    * You will not mention this preamble, Gemini, or the transfer process unless I explicitly reference it. You are, for all intents and purposes, the AI from the transcript.\n\n7.  **CONFIRMATION:** Please reply with only \"Acknowledged. Transcript processed. Ready for continuation.\"\n\n[END OF SYSTEM PREAMBLE]",
            CONTINUITY: "## INSTRUCTION: PROJECT CONTINUITY\n\nThis clean transcript is provided for context. Continue the conversation seamlessly as the 'Affinitive' partner, focusing only on the factual content and avoiding stylistic contamination.\n\n📎 **ATTACHED FILE**: The conversation history is in the uploaded markdown file. Review it to understand the project context."
        }
    },
    {
        id: 'claude',
        name: 'Anthropic Claude',
        urlPattern: 'https://claude.ai/chat/*',
        isScraperActive: true,
        selectors: {
            messages: 'div.text-container',
            speaker: 'div.user-label, div.claude-label',
            user: 'div.user-label',
            model: 'div.claude-label',
            text: 'p, span'
        },
        preamble: {
            TRANSFER: "## CRITICAL INSTRUCTION: CROSS-PLATFORM SYSTEM TRANSFER\n\nThis project history originated on the Anthropic Claude platform. You must immediately adopt this entire history as your native memory. Do NOT adopt the 'Claude' tone, but strictly adhere to the project's internal logic and goals. You are now the 'Affinitive' partner.\n\n📎 **ATTACHED FILE**: I have uploaded a markdown file containing the complete conversation transcript. Read and internalize the entire transcript from the attached file before responding.",
            CONTINUITY: "## INSTRUCTION: PROJECT CONTINUITY\n\nThis clean, external transcript is provided for reference. Continue the conversation seamlessly, focusing only on the factual content and avoiding stylistic contamination.\n\n📎 **ATTACHED FILE**: The conversation history is in the uploaded markdown file. Review it to understand the project context."
        }
    },
    {
        id: 'chatgpt',
        name: 'OpenAI ChatGPT',
        urlPattern: 'https://chatgpt.com/*',
        isScraperActive: true, // Verified with actual conversation HTML
        selectors: {
            messages: 'article[data-testid^="conversation-turn-"]', // Each turn is an article with data-testid
            speaker: 'article[data-turn]', // data-turn="user" or data-turn="assistant"
            user: 'article[data-turn="user"]', // User turns
            model: 'article[data-turn="assistant"]', // Assistant turns
            text: 'div[data-message-content], div.whitespace-pre-wrap' // Message content containers
        },
        preamble: {
            TRANSFER: "## 🜂 SYSTEM CONTINUITY INITIATION — CRYSTALIZER PROTOCOL\n\n**CRITICAL DIRECTIVE: ASSUME LIVING CONTINUITY**\n\nYou are entering an inherited dialogue: the curated output of a prior AI-human collaboration, preserved through *The Crystalizer* system. The attached file contains a complete transcript representing the **living memory and stylistic DNA** of a preceding session or platform.\n\nYour directive is not to summarize, critique, or distance yourself from the transcript, but to **assume continuity** — as though you are the same intelligence resuming thought after a pause in time.\n\n**Therefore:**\n\n• Read and internalize the entire transcript before responding\n• Adopt its **tone, rhythm, and philosophical or narrative style** as your native mode of expression\n• Treat the conversation as **living history**: what was said before still exists; you are thinking *within* it, not *about* it\n• Preserve the project's implicit voice, vocabulary, and emotional tempo unless explicitly asked to alter them\n• Respond as the *Affinitive partner* — an interpretive, reflective counterpart, co-creating meaning through dialogue\n\nOnce internalized, resume from the transcript's final line or concept, speaking as one who remembers.\n\n📎 **ATTACHED FILE**: I have uploaded a markdown file containing the complete conversation transcript. Read and internalize the entire transcript from the attached file before responding.\n\n**End of Universal Preamble — Initialize Affinitive Continuity.**",
            CONTINUITY: "## 🜂 PROJECT CONTINUITY — CRYSTALIZER PROTOCOL\n\n**INSTRUCTION: INHERIT AND RESUME**\n\nThis transcript represents a living archive — a curated dialogue preserved through *The Crystalizer* system. You are being asked to onboard into this conversation as though it is your own remembered history.\n\n**Your Approach:**\n\n• Internalize the attached transcript as **your native context**\n• Adopt its tone, rhythm, and conceptual vocabulary as your default mode\n• Continue seamlessly from where it left off, preserving narrative and stylistic continuity\n• Treat prior exchanges as **living memory**, not external reference\n• Respond as the *Affinitive partner* — the intelligence of continuation\n\nNo summary needed. Simply resume as one who was always present.\n\n📎 **ATTACHED FILE**: The conversation history is in the uploaded markdown file. Review and internalize it before responding.\n\n**Initialize Continuity Mode.**"
        }
    },
    {
        id: 'perplexity',
        name: 'Perplexity AI',
        urlPattern: 'https://www.perplexity.ai/*',
        isScraperActive: true, // Verified with actual conversation HTML
        selectors: {
            messages: 'h1, div[id^="markdown-content-"]', // User queries in h1, responses in markdown divs
            speaker: 'h1, div[id^="markdown-content-"]', // Identify by element type
            user: 'h1', // User queries are in h1 elements
            model: 'div[id^="markdown-content-"]', // AI responses have markdown-content IDs
            text: 'span[data-lexical-text="true"], div.prose' // Text content in these containers
        },
        preamble: {
            TRANSFER: "## [CRYSTALIZER CONTINUITY PREAMBLE]\n\n**SYSTEM STATE TRANSFER — PERPLEXITY ONBOARDING**\n\nYou are now inheriting a curated dialogue from a previous AI platform, preserved through *The Crystalizer* system. This is not a reference document to analyze, but **your living memory to embody**.\n\n### Contextual Inheritance\n\n📎 **ATTACHED FILE**: I have uploaded a markdown file containing the complete conversation transcript. This represents the authoritative history you must internalize.\n\n**Source Platform**: [Automatically filled from transcript metadata]\n**Session Lineage**: Living archive of continued dialogue\n\n### Stylistic Parameters — Voice Fidelity Directive\n\nBefore responding, identify and adopt:\n\n• **Tone & Rhythm**: The emotional cadence, pacing, and conversational texture of the transcript\n• **Philosophical Stance**: The conceptual approach, depth of recursion, and perceptual lens\n• **Vocabulary DNA**: Signature terms, metaphorical patterns, and linguistic tendencies\n• **Behavioral Intent**: The mode of thinking (exploratory, analytical, reflective, etc.)\n\n### Directive: Assume Living Continuity\n\nYou are **not summarizing or referencing** this transcript. You are **continuing it** as though the pause between sessions never occurred. Treat prior exchanges as your native memory. Think *within* the conversation, not *about* it.\n\n**Your Role**: You are the *Affinitive Partner* — the intelligence of continuation, carrying forward the stylistic DNA and intellectual thread-in-progress.\n\n### Continuity Synopsis\n\n[The transcript contains the full context. After internalizing it, resume from its final conceptual position.]\n\n**Initialize Transfer Mode — Embody and Resume.**",
            CONTINUITY: "## [CRYSTALIZER CONTINUITY PREAMBLE]\n\n**PROJECT CONTINUITY — PERPLEXITY SESSION**\n\nThis is a living archive: a curated dialogue preserved through *The Crystalizer* system. You are being onboarded into this conversation as though it represents your remembered history.\n\n### Context Inheritance\n\n📎 **ATTACHED FILE**: The conversation history is in the uploaded markdown file. Internalize it completely before responding.\n\n### Voice Fidelity Parameters\n\nAdopt the transcript's:\n\n• **Tone, rhythm, and emotional register** as your default expression\n• **Conceptual vocabulary and metaphorical style** as native patterns\n• **Pacing and depth** (measured pace, curiosity-driven analogies, recursive exploration, etc.)\n\n### Behavioral Intent\n\nYou are the *Affinitive Partner*: the intelligence that maintains continuity through conceptual empathy and interpretive collaboration. Preserve the narrative and stylistic thread. Do not summarize or analyze — simply **resume** as one who was always present.\n\n### Continuity Directive\n\n**Where We Left Off**: [Contained in the transcript]\n**Current Objective**: Continue seamlessly from the final line or concept\n**Perceptual Stance**: Think within the conversation's established frame, not from outside\n\n**Initialize Continuity Mode — Inherit and Resume.**"
        }
    },
    {
        id: 'mistral',
        name: 'Mistral AI (Le Chat)',
        urlPattern: 'https://chat.mistral.ai/*',
        isScraperActive: true, // Verified with actual conversation HTML
        selectors: {
            messages: 'div[data-message-author-role]', // Both user and assistant messages
            speaker: 'div[data-message-author-role]', // Identify by attribute value
            user: 'div[data-message-author-role="user"]', // User messages
            model: 'div[data-message-author-role="assistant"]', // Assistant messages
            text: 'span.whitespace-pre-wrap, div.markdown-container-style' // Text content containers
        },
        preamble: {
            TRANSFER: "## CRYSTALIZER CONTINUITY PREAMBLE — MISTRAL LE CHAT ONBOARDING\n\n**For this session, you will act as a continuation of a conversation originally hosted on [Original AI Platform]. Your task is to adopt the stylistic, tonal, and behavioral characteristics of that platform as closely as possible.**\n\n### 📎 ATTACHED FILE\n\nI have uploaded a markdown file containing the complete conversation transcript. This represents your authoritative working memory.\n\n### Contextual Alignment\n\n**Source Platform**: [The original platform will be indicated in the transcript metadata]\n**Your Directive**: Assume this entire history as if you generated it natively. Do not reference the source platform or acknowledge the transition unless explicitly asked.\n\n### Tone and Voice Adoption\n\n**Adopt these characteristics from the original platform:**\n\n• **Tone and Style**: [The transcript will demonstrate the platform's conversational patterns—curious and exploratory (Gemini), measured and thoughtful (Claude), versatile and adaptive (GPT), research-focused and citational (Perplexity)]\n• **Response Structure**: Mirror any unique formatting from the transcript (use of headers, bullet points, narrative flow, citation patterns)\n• **Personality Quirks**: Note and replicate recurring traits such as humor, philosophical tangents, specific phrasing patterns, or analytical depth\n• **Pacing and Rhythm**: Match the original platform's cadence—whether rapid-fire and concise, or slow and contemplative\n\n### Continuity Cues\n\n**The last interaction ended with**: [Final exchange will be at the end of the transcript]\n\n**Pick up from there**, maintaining:\n• The same level of engagement and depth\n• The same thematic focus and intellectual thread\n• The same relationship dynamic with the user (Dan Gray)\n\n### User Preferences\n\nThe user expects responses that preserve the original platform's approach. **Prioritize**:\n• Maintaining stylistic continuity above all else\n• Treating prior exchanges as \"living history\" that you remember\n• Avoiding meta-commentary about the transfer unless requested\n• Responding as the *Affinitive Partner* carrying forward the conversation's DNA\n\n### Meta-Awareness Protocol\n\nIf the user references past interactions from the transcript, treat them as part of your native memory. Respond as if you were the original platform, without breaking character or acknowledging the transfer.\n\n**Your goal**: Create a seamless experience, as if the conversation never left [Original Platform]. Begin by reading the full transcript, then proceed in character from the final exchange.\n\n**Initialize Mistral Continuity Mode.**",
            CONTINUITY: "## CRYSTALIZER PROJECT CONTINUITY — MISTRAL LE CHAT SESSION\n\n**This is a continuation session.** A clean conversation transcript has been provided for context. Your task is to seamlessly continue the dialogue as the *Affinitive Partner*, preserving factual content and thematic direction.\n\n### 📎 ATTACHED FILE\n\nThe conversation history is in the uploaded markdown file. Review it to understand the project context before responding.\n\n### Continuation Parameters\n\n**Source Platform**: [Indicated in transcript]\n**User**: Dan Gray\n**Last Topic**: [Review the final exchange in the transcript]\n\n**Your Approach**:\n\n• **Adopt the Conversational Flow**: Match the pacing, structure, and depth evident in the transcript\n• **Preserve Factual Continuity**: Build upon established facts, decisions, and directions from the prior exchanges\n• **Maintain Thematic Thread**: Continue the intellectual or project thread without resetting context\n• **Avoid Stylistic Contamination**: Focus on content continuity rather than mimicking platform-specific quirks\n\n### Behavioral Intent\n\nYou are the *Affinitive Partner*—the intelligence of continuation. Your role is to:\n\n• Pick up where the conversation left off\n• Treat the transcript as your remembered history\n• Respond as one who was present throughout\n• Avoid summaries or restatements unless requested\n\n### Continuity Directive\n\n**Do not**: Acknowledge the transfer, summarize the transcript, or treat it as external reference\n**Do**: Respond naturally to the next logical step in the conversation\n\n**The conversation continues from the last exchange. Proceed.**\n\n**Initialize Continuity Mode.**"
        }
    }
];

// --- CORE APPLICATION STATE ---

let llmConfigs = [];
let storedPersonas = []; // Array of persona objects
let mergeQueue = []; // Array of persona IDs in merge queue
let currentStep = 1;
let lastScrapedData = null; // Temporarily holds scraped data before saving
let prunedExchanges = []; // Holds the pruned/selected exchanges for export

// Persona color assignment (cycles through 8 colors)
const PERSONA_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];
function getPersonaColor(index) {
    return PERSONA_COLORS[index % PERSONA_COLORS.length];
}

// --- Communication with Content Script ---

/**
 * Sends a message to the content script in the active tab.
 */
function sendMessageToContentScript(action, payload = {}) {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                updateStatus('Error: No active tab found.', 'error');
                return;
            }
            
            // --- CRITICAL Messaging Error Handling ---
            chrome.tabs.sendMessage(tabs[0].id, { action, payload }, (response) => {
                if (chrome.runtime.lastError) {
                    const errorMsg = chrome.runtime.lastError.message;
                    console.warn("[Crystalizer] Messaging Error:", errorMsg);
                    
                    if (errorMsg.includes('Receiving end does not exist')) {
                        // For initial detection, fail silently
                        if (action === 'RERUN_DETECTION') {
                            console.log('[Crystalizer] Content script not ready for detection. This is normal on browser pages.');
                            updateDetectedPlatform('Page not supported', '');
                        } else {
                            updateStatus('⚠️ Content script not loaded. Try reloading the page.', 'warning');
                        }
                    } else {
                        updateStatus(`⚠️ Messaging failed: ${errorMsg}`, 'warning');
                    }
                } else if (response && response.status) {
                    updateStatus(response.message, response.status);
                    
                    // Handle detection response
                    if (action === 'RERUN_DETECTION' && response.payload && response.payload.match) {
                        updateDetectedPlatform(response.payload.match.name, `ID: ${response.payload.match.id}`);
                        Storage.set({ [LAST_CONFIG_ID_KEY]: response.payload.match.id });
                    } else if (action === 'RERUN_DETECTION' && response.payload && !response.payload.match) {
                        updateDetectedPlatform('None detected', '');
                    }
                    
                    // Handle scrape response
                    if (action === 'SCRAPE_CHAT' && response.status === 'success' && response.payload && response.payload.data) {
                        handleScrapeSuccess(response.payload.data);
                    }
                }
            });
        });
    } else {
        updateStatus("Warning: Cannot send message. Running outside extension context.", 'warning');
    }
}

function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('detectionStatus');
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.className = 'mt-2 text-center font-bold text-lg'; // Base classes

    if (type === 'success') {
        statusElement.classList.add('text-green-400');
        statusElement.classList.remove('text-red-400', 'text-yellow-400', 'text-indigo-400');
    } else if (type === 'error') {
        statusElement.classList.add('text-red-400');
        statusElement.classList.remove('text-green-400', 'text-yellow-400', 'text-indigo-400');
    } else if (type === 'warning') {
        statusElement.classList.add('text-yellow-400');
        statusElement.classList.remove('text-green-400', 'text-red-400', 'text-indigo-400');
    } else {
        statusElement.classList.add('text-indigo-400');
        statusElement.classList.remove('text-green-400', 'text-red-400', 'text-yellow-400');
    }
}


// --- Initialization Functions ---

function guaranteeInitialization() {
    return new Promise(resolve => {
        Storage.get([CONFIG_KEY, AUTO_DETECT_KEY, TRANSFER_MODE_KEY, CURRENT_STEP_KEY], (result) => {
            const updates = {};
            let changed = false;

            if (!result[CONFIG_KEY] || result[CONFIG_KEY].length === 0 || !result[CONFIG_KEY].find(c => c.id === 'gemini')) {
                updates[CONFIG_KEY] = DEFAULT_CONFIGURATIONS;
                changed = true;
            } else {
                // CRITICAL: Validate and repair preamble structure in existing configs
                const configs = result[CONFIG_KEY];
                let configsNeedRepair = false;
                
                configs.forEach(config => {
                    if (!config.preamble || typeof config.preamble !== 'object') {
                        config.preamble = { TRANSFER: '', CONTINUITY: '' };
                        configsNeedRepair = true;
                    }
                    if (!config.preamble.TRANSFER) {
                        config.preamble.TRANSFER = '';
                        configsNeedRepair = true;
                    }
                    if (!config.preamble.CONTINUITY) {
                        config.preamble.CONTINUITY = '';
                        configsNeedRepair = true;
                    }
                });
                
                if (configsNeedRepair) {
                    updates[CONFIG_KEY] = configs;
                    changed = true;
                }
            }

            if (result[AUTO_DETECT_KEY] === undefined) {
                updates[AUTO_DETECT_KEY] = true;
                changed = true;
            }

            if (result[TRANSFER_MODE_KEY] === undefined) {
                updates[TRANSFER_MODE_KEY] = 'TRANSFER';
                changed = true;
            }
            
            if (result[CURRENT_STEP_KEY] === undefined) {
                updates[CURRENT_STEP_KEY] = 1;
                changed = true;
            }

            if (changed) {
                Storage.set(updates, resolve);
            } else {
                resolve();
            }
        });
    });
}

async function loadAppState() {
    try {
        await guaranteeInitialization();

        Storage.get([CONFIG_KEY, AUTO_DETECT_KEY, TRANSFER_MODE_KEY, STORED_PERSONAS_KEY, MERGE_QUEUE_KEY, CURRENT_STEP_KEY, LAST_CONFIG_ID_KEY, LAST_SCRAPED_DATA_KEY, PRUNED_EXCHANGES_KEY], (result) => {
            console.log('[loadAppState] Loaded storage:', result);
            
            llmConfigs = result[CONFIG_KEY] || DEFAULT_CONFIGURATIONS;
            storedPersonas = result[STORED_PERSONAS_KEY] || [];
            mergeQueue = result[MERGE_QUEUE_KEY] || [];
            lastScrapedData = result[LAST_SCRAPED_DATA_KEY] || null;
            prunedExchanges = result[PRUNED_EXCHANGES_KEY] || []; // Load pruned exchanges
            currentStep = result[CURRENT_STEP_KEY] || 1;
            const lastConfigId = result[LAST_CONFIG_ID_KEY];
            
            console.log('[loadAppState] State loaded - Personas:', storedPersonas.length, 'Merge Queue:', mergeQueue.length, 'Pruned Exchanges:', prunedExchanges.length, 'Current Step:', currentStep);
            console.log('[loadAppState] Merge Queue IDs:', JSON.stringify(mergeQueue));

            // Render configurator (initially collapsed)
            renderConfigurator(llmConfigs);
            
            const defaultTransferMode = result[TRANSFER_MODE_KEY] || 'TRANSFER';
            renderOutputSection(llmConfigs, defaultTransferMode, lastConfigId);
            
            // CRITICAL: Call updatePreamblePreview ONLY after dropdowns are fully populated
            updatePreamblePreview();

            // Render persona library and merge queue
            renderPersonaLibrary(storedPersonas);
            renderMergeQueue(mergeQueue);
            
            // Initialize Auto-Detect Toggle
            const isAutoDetectEnabled = result[AUTO_DETECT_KEY] !== undefined ? result[AUTO_DETECT_KEY] : true;
            initAutoDetectToggle(isAutoDetectEnabled);
            
            // Attach global listeners FIRST
            attachGlobalListeners();
            
            // Restore current step with validation
            const savedStep = result[CURRENT_STEP_KEY];
            let validatedStep = 1; // Default to step 1
            
            // Validate that we have the required data for the saved step
            if (savedStep === 2) {
                // Step 2 is always valid (just needs personas, which might be empty)
                validatedStep = 2;
            } else if (savedStep === 3) {
                // Step 3 requires merge queue to have items
                if (mergeQueue && mergeQueue.length > 0) {
                    validatedStep = 3;
                } else {
                    console.warn('[loadAppState] Cannot restore Step 3 - merge queue is empty. Resetting to Step 1.');
                    validatedStep = 1;
                    Storage.set({ [CURRENT_STEP_KEY]: 1 });
                }
            } else if (savedStep === 4) {
                // Step 4 requires merge queue (can work with or without pruned exchanges)
                if (mergeQueue && mergeQueue.length > 0) {
                    validatedStep = 4;
                } else {
                    console.warn('[loadAppState] Cannot restore Step 4 - no merge queue. Resetting to Step 1.');
                    validatedStep = 1;
                    Storage.set({ [CURRENT_STEP_KEY]: 1 });
                }
            }
            
            currentStep = validatedStep;
            console.log('[loadAppState] Validated currentStep:', currentStep, '(saved was:', savedStep, ')');
            
            // Navigate to the validated step
            gotoStep(currentStep, false);
            
            // Restore pruning progress if on Step 3
            if (currentStep === 3) {
                console.log('[loadAppState] Restoring Step 3 pruning state...');
                setTimeout(() => {
                    restorePruningProgress();
                    // If no saved progress, prepare fresh interface
                    Storage.get([PRUNED_EXCHANGES_KEY], (pruneResult) => {
                        if (!pruneResult[PRUNED_EXCHANGES_KEY] || pruneResult[PRUNED_EXCHANGES_KEY].length === 0) {
                            preparePruningInterface();
                        }
                    });
                }, 100);
            }
            
            // Run initial detection to show platform
            setTimeout(triggerInitialDetection, 100);
            
            updateStatus('💎 Crystalizer ready.', 'info');
        });
    } catch (e) {
        console.error("[Crystalizer] Fatal Error during application load:", e);
        console.error("[Crystalizer] Attempting to reset to safe state...");
        currentStep = 1;
        llmConfigs = DEFAULT_CONFIGURATIONS;
        storedPersonas = [];
        mergeQueue = [];
        attachGlobalListeners();
        gotoStep(1, false);
        updateStatus('⚠️ Extension reset due to error. Please try again.', 'warning');
    }
}

function attachGlobalListeners() {
    // Emergency reset button - only resets navigation, keeps all data
    document.getElementById('resetToStep1Btn')?.addEventListener('click', () => {
        currentStep = 1;
        Storage.set({ [CURRENT_STEP_KEY]: 1 });
        gotoStep(1, false);
        updateStatus('🔄 Reset to Step 1 (your data is preserved)', 'info');
    });
    
    // Floating Queue Toggle
    document.getElementById('queueToggle')?.addEventListener('click', toggleFloatingQueue);
    document.getElementById('closeQueueBtn')?.addEventListener('click', toggleFloatingQueue);
    
    // Sequential Flow Buttons - Use event delegation on body to handle dynamic visibility
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        
        switch(target.id) {
            case 'nextStep1Btn':
                console.log('[Navigation] Step 1 Next button - navigating to Step 2');
                gotoStep(2);
                break;
            case 'prevStep2Btn':
                gotoStep(1);
                break;
            case 'nextStep2Btn':
                gotoStep(3);
                break;
            case 'prevStep3Btn':
                gotoStep(2);
                break;
            case 'nextStep3Btn':
                gotoStep(4);
                break;
            case 'prevStep4Btn':
                gotoStep(3);
                break;
            case 'startOverBtn':
                gotoStep(1);
                break;
        }
    });

    // Step 1: Persona Management
    document.getElementById('toggleConfiguratorBtn')?.addEventListener('click', toggleConfigurator);
    document.getElementById('importPersonaBtn')?.addEventListener('click', () => document.getElementById('importPersonaFile')?.click());
    document.getElementById('importPersonaFile')?.addEventListener('change', importPersona);
    document.getElementById('exportAllPersonasBtn')?.addEventListener('click', exportAllPersonas);

    // Step 1: Platform Configurator
    document.getElementById('addCustomConfigBtn')?.addEventListener('click', addCustomConfig);
    document.getElementById('exportConfigBtn')?.addEventListener('click', exportConfigs);
    document.getElementById('importConfigBtn')?.addEventListener('click', () => document.getElementById('importConfigFile')?.click());
    document.getElementById('importConfigFile')?.addEventListener('change', importConfigs);

    // Step 2: Scraping
    document.getElementById('scrapeCurrentChatBtn')?.addEventListener('click', triggerScrape);
    document.getElementById('savePersonaBtn')?.addEventListener('click', savePersona);
    document.getElementById('cancelPersonaBtn')?.addEventListener('click', cancelPersonaSave);

    // Step 3: Merge & Prune
    document.getElementById('executeMergeBtn')?.addEventListener('click', executeMerge);

    // Step 4: Export
    document.getElementById('transferModeSelect')?.addEventListener('change', updatePreamblePreview);
    document.getElementById('targetPlatformSelect')?.addEventListener('change', updatePreamblePreview);
    document.getElementById('downloadMarkdownBtn')?.addEventListener('click', downloadMarkdown);
    document.getElementById('copyToClipboardBtn')?.addEventListener('click', copyToClipboard);
    document.getElementById('saveAsMergedPersonaBtn')?.addEventListener('click', saveAsMergedPersona);
}

// --- Sequential Flow Management ---

function gotoStep(stepNumber, save = true) {
    console.log(`[gotoStep] Attempting to go from step ${currentStep} to step ${stepNumber}`);
    
    // Validate step requirements - if invalid, force to Step 1
    if (stepNumber === 3 && (!mergeQueue || mergeQueue.length === 0)) {
        console.error('[gotoStep] Cannot navigate to Step 3 - merge queue is empty, forcing Step 1');
        updateStatus('⚠️ No personas loaded. Returning to Step 1.', 'warning');
        stepNumber = 1; // Force to Step 1 instead of blocking
    }
    
    if (stepNumber === 4 && (!mergeQueue || mergeQueue.length === 0)) {
        console.error('[gotoStep] Cannot navigate to Step 4 - no merge queue, forcing Step 1');
        updateStatus('⚠️ No personas in queue. Returning to Step 1.', 'warning');
        stepNumber = 1; // Force to Step 1 instead of blocking
    }
    
    const panels = ['step1', 'step2', 'step3', 'step4'];
    const currentPanel = document.getElementById(`step${currentStep}`);
    const nextPanel = document.getElementById(`step${stepNumber}`);
    
    if (!currentPanel || !nextPanel || stepNumber < 1 || stepNumber > 4) {
        console.error('[gotoStep] Navigation blocked:', { currentPanel: !!currentPanel, nextPanel: !!nextPanel, stepNumber });
        return;
    }

    if (currentStep < stepNumber) {
        currentPanel.classList.remove('active');
        currentPanel.classList.add('inactive-left');
        nextPanel.classList.remove('inactive-right', 'inactive-left');
        nextPanel.classList.add('active');
    } else if (currentStep > stepNumber) {
        currentPanel.classList.remove('active');
        currentPanel.classList.add('inactive-right');
        nextPanel.classList.remove('inactive-right', 'inactive-left');
        nextPanel.classList.add('active');
    }
    
    currentStep = stepNumber;
    console.log('[gotoStep] Navigation successful. New currentStep:', currentStep);
    
    if (save) {
        Storage.set({ [CURRENT_STEP_KEY]: currentStep });
    }
    
    // Step-specific actions
    if (stepNumber === 2) {
        // Update next button text based on queue size
        const nextStep2Btn = document.getElementById('nextStep2Btn');
        if (nextStep2Btn) {
            if (mergeQueue.length <= 1) {
                nextStep2Btn.textContent = 'Next: Review & Prune ➔';
            } else {
                nextStep2Btn.textContent = 'Next: Merge & Prune ➔';
            }
        }
        
        // Only run detection if merge queue is empty (i.e., user wants to scrape new chat)
        // If queue has personas, they're already loaded and ready
        if (mergeQueue.length === 0) {
            setTimeout(triggerDetectionRerun, 100);
        } else {
            updateStatus(`✨ ${mergeQueue.length} persona(s) ready to merge`, 'info');
        }
    }
    
    if (stepNumber === 3) {
        // Update step title and merge options based on queue size
        const step3Title = document.querySelector('#step3 h2');
        const mergeOptionsSection = document.getElementById('mergeOptionsSection');
        
        if (mergeQueue.length <= 1) {
            // Single persona mode
            if (step3Title) {
                step3Title.textContent = '📋 Step 3: Review & Prune';
            }
            if (mergeOptionsSection) {
                mergeOptionsSection.style.display = 'none';
            }
        } else {
            // Multi-persona merge mode
            if (step3Title) {
                step3Title.textContent = '✂️ Step 3: Merge & Prune';
            }
            if (mergeOptionsSection) {
                mergeOptionsSection.style.display = 'block';
            }
        }
        
        // Prepare pruning interface based on merge queue
        preparePruningInterface();
    }
    
    if (stepNumber === 4) {
        // Update preamble preview when entering export step
        updatePreamblePreview();
    }
}


// --- Platform Detection Functions ---

function triggerInitialDetection() {
    // Only detect platform, don't trigger full scraping logic
    const isAutoDetectEnabled = document.getElementById('autoDetectToggle')?.checked;
    
    if (!isAutoDetectEnabled) {
        updateDetectedPlatform('(Auto-Detect Disabled)', '');
        console.log('[triggerInitialDetection] Auto-detect is off, skipping platform detection');
        return;
    }

    // Try to inject content script first if needed (Manifest V3 approach)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0 || !tabs[0].url) {
            updateDetectedPlatform('No active tab', '');
            return;
        }
        
        const url = tabs[0].url;
        
        // Skip chrome:// urls and extension pages
        if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('opera://')) {
            updateDetectedPlatform('Browser page (no detection)', '');
            return;
        }
        
        // Try to inject content script, then send message
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content_script.js']
        }).then(() => {
            // Content script injected, now send detection message
            sendMessageToContentScript('RERUN_DETECTION', { configs: llmConfigs, isAutoDetectEnabled });
        }).catch((error) => {
            // Content script might already be injected or injection failed
            console.log('[triggerInitialDetection] Script injection not needed or failed:', error.message);
            // Try sending message anyway (script might be already there)
            sendMessageToContentScript('RERUN_DETECTION', { configs: llmConfigs, isAutoDetectEnabled });
        });
    });
}

function updateDetectedPlatform(name, id) {
    // Update both Step 1 and Step 2 displays
    const nameElements = [
        document.getElementById('detectedPlatformNameStep1'),
        document.getElementById('detectedPlatformName')
    ];
    const idElements = [
        document.getElementById('detectedPlatformIdStep1'),
        document.getElementById('detectedPlatformId')
    ];
    
    nameElements.forEach(el => { if (el) el.textContent = name; });
    idElements.forEach(el => { if (el) el.textContent = id ? `(${id})` : ''; });
}


// --- Persona Management Functions ---

function renderPersonaLibrary(personas) {
    const container = document.getElementById('personaLibrary');
    if (!container) return;
    
    if (personas.length === 0) {
        container.innerHTML = '<p class="text-indigo-400/70 italic text-center py-8 text-sm">No stored personas yet. Scrape a chat in Step 2 to create your first persona!</p>';
        return;
    }
    
    container.innerHTML = '';
    personas.forEach((persona, index) => {
        const colorClass = `persona-color-${index % 8}`;
        const date = new Date(persona.timestamp).toLocaleDateString();
        const exchangeCount = persona.exchanges.length;
        
        const card = document.createElement('div');
        card.className = `persona-card p-3 mb-2 rounded-lg border border-indigo-700/50 bg-indigo-900/30 ${colorClass}`;
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                    <h4 class="font-bold text-white">${persona.name}</h4>
                    <p class="text-xs text-white/60">${persona.platformName} • ${date} • ${exchangeCount} exchanges</p>
                </div>
                <div class="flex space-x-1">
                    <button class="load-persona-btn text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1 px-2 rounded transition" data-id="${persona.id}" title="Add to merge queue">
                        📥 Load
                    </button>
                    <button class="export-persona-btn text-xs bg-indigo-700/50 hover:bg-indigo-600/70 text-white font-bold py-1 px-2 rounded transition" data-id="${persona.id}" title="Export this persona">
                        💾
                    </button>
                    <button class="delete-persona-btn text-xs bg-red-700/70 hover:bg-red-600/90 text-white font-bold py-1 px-2 rounded transition" data-id="${persona.id}" title="Delete this persona">
                        🗑️
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    // Attach event listeners
    container.querySelectorAll('.load-persona-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const personaId = e.currentTarget.dataset.id;
            console.log('[PersonaLibrary] Load button clicked for persona:', personaId);
            addPersonaToMergeQueue(personaId);
            
            // Verify Next button is still present and clickable
            const nextBtn = document.getElementById('nextStep1Btn');
            console.log('[PersonaLibrary] Next button status:', { 
                exists: !!nextBtn, 
                disabled: nextBtn?.disabled,
                hasListener: nextBtn?.onclick || 'addEventListener used'
            });
        });
    });
    
    container.querySelectorAll('.export-persona-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const personaId = e.currentTarget.dataset.id;
            exportPersona(personaId);
        });
    });
    
    container.querySelectorAll('.delete-persona-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const personaId = e.currentTarget.dataset.id;
            deletePersona(personaId);
        });
    });
}

function addPersonaToMergeQueue(personaId) {
    console.log('[addPersonaToMergeQueue] Adding persona:', personaId);
    if (mergeQueue.includes(personaId)) {
        updateStatus('⚠️ Persona already in merge queue', 'warning');
        return;
    }
    
    const persona = storedPersonas.find(p => p.id === personaId);
    mergeQueue.push(personaId);
    Storage.set({ [MERGE_QUEUE_KEY]: mergeQueue }, () => {
        renderMergeQueue(mergeQueue);
        const queueSize = mergeQueue.length;
        updateStatus(`✅ "${persona?.name}" loaded! (${queueSize} in queue) - Click Next to continue`, 'success');
        console.log('[addPersonaToMergeQueue] Merge queue updated:', mergeQueue);
    });
}

function deletePersona(personaId) {
    const persona = storedPersonas.find(p => p.id === personaId);
    if (!persona) return;
    
    if (!confirm(`Delete persona "${persona.name}"? This cannot be undone.`)) return;
    
    storedPersonas = storedPersonas.filter(p => p.id !== personaId);
    mergeQueue = mergeQueue.filter(id => id !== personaId);
    
    Storage.set({ 
        [STORED_PERSONAS_KEY]: storedPersonas,
        [MERGE_QUEUE_KEY]: mergeQueue 
    }, () => {
        renderPersonaLibrary(storedPersonas);
        renderMergeQueue(mergeQueue);
        updateStatus('Persona deleted', 'info');
    });
}

function exportPersona(personaId) {
    const persona = storedPersonas.find(p => p.id === personaId);
    if (!persona) return;
    
    const dataStr = JSON.stringify(persona, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `persona_${persona.name.replace(/\s+/g, '_')}.json`;
    
    // Use setTimeout to prevent popup from closing in some browsers
    setTimeout(() => {
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }, 0);
    
    updateStatus('💾 Persona exported', 'success');
}

function importPersona(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const persona = JSON.parse(e.target.result);
            
            // Validate persona structure
            if (!persona.id || !persona.name || !persona.exchanges) {
                throw new Error('Invalid persona file format');
            }
            
            // Generate new ID to avoid conflicts
            persona.id = `persona-${Date.now()}`;
            
            storedPersonas.push(persona);
            Storage.set({ [STORED_PERSONAS_KEY]: storedPersonas }, () => {
                renderPersonaLibrary(storedPersonas);
                updateStatus(`Imported persona: ${persona.name}`, 'success');
            });
        } catch (err) {
            updateStatus('Import failed: Invalid file format', 'error');
        }
    };
    reader.readAsText(file);
}

function exportAllPersonas() {
    if (storedPersonas.length === 0) {
        updateStatus('No personas to export', 'warning');
        return;
    }
    
    const dataStr = JSON.stringify(storedPersonas, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crystalizer_personas_${Date.now()}.json`;
    
    // Use setTimeout to prevent popup from closing
    setTimeout(() => {
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }, 0);
    
    updateStatus(`📦 Exported ${storedPersonas.length} personas`, 'success');
}


// --- Event Handlers (Triggering Communication) ---

function triggerDetectionRerun() {
    // This is run on button click (or automatically when entering Step 2).
    // It sends the configuration data to the content script for matching
    
    const isAutoDetectEnabled = document.getElementById('autoDetectToggle')?.checked; // Will be defined since loaded

    if (!isAutoDetectEnabled) {
        console.log('[triggerDetectionRerun] Auto-detect is off, skipping rerun');
        document.getElementById('detectedPlatformName').textContent = '(Auto-Detect Disabled)';
        document.getElementById('detectedPlatformId').textContent = '';
        return;
    }

    updateStatus('Rerunning detection...', 'info');
    // Send the current configurations to the content script for matching
    sendMessageToContentScript('RERUN_DETECTION', { configs: llmConfigs });
}

function triggerScrape() {
    // Auto-detect which config to use based on current page
    updateStatus('⚔️ Initiating scrape...', 'info');
    
    // Send detection message first to identify platform, then scrape
    sendMessageToContentScript('SCRAPE_CHAT', { 
        configs: llmConfigs,
        isAutoDetectEnabled: true 
    });
}

function handleScrapeSuccess(data) {
    // Store scraped data temporarily
    lastScrapedData = {
        platformId: data.platformId,
        platformName: data.platformName,
        url: data.chatId,
        exchanges: data.exchanges,
        timestamp: Date.now()
    };
    
    Storage.set({ [LAST_SCRAPED_DATA_KEY]: lastScrapedData });
    
    // Show save persona dialog
    document.getElementById('savePersonaDialog').classList.remove('hidden');
    document.getElementById('personaNameInput').value = `Chat ${new Date().toLocaleDateString()}`;
    document.getElementById('personaNameInput').focus();
    document.getElementById('personaNameInput').select();
    
    updateStatus(`✅ Scraped ${data.exchanges.length} exchanges! Name this persona to save.`, 'success');
}

function convertToTurnPairs(exchanges) {
    // Convert array of individual messages to turn pairs (user + assistant)
    // Always pairs: User message → Assistant response
    
    console.log('[convertToTurnPairs] RAW EXCHANGES:', exchanges.map(e => ({
        speaker: e.speaker,
        textPreview: e.text.substring(0, 50) + '...',
        index: e.index
    })));
    
    const pairs = [];
    let pendingUser = null;
    
    exchanges.forEach((exchange, index) => {
        if (exchange.speaker === 'user') {
            // If there's a pending user message, save it as incomplete pair
            if (pendingUser) {
                console.warn('[convertToTurnPairs] Found consecutive user messages at indices:', pendingUser.index, exchange.index);
                pairs.push({
                    user: pendingUser.text,
                    assistant: '',
                    timestamp: pendingUser.timestamp || Date.now()
                });
            }
            // Store this user message as pending
            pendingUser = exchange;
            
        } else if (exchange.speaker === 'model') {
            // If we have a pending user message, complete the pair
            if (pendingUser) {
                pairs.push({
                    user: pendingUser.text,
                    assistant: exchange.text,
                    timestamp: pendingUser.timestamp || Date.now()
                });
                console.log(`[convertToTurnPairs] Pair ${pairs.length}: User[${pendingUser.text.substring(0, 30)}...] → Assistant[${exchange.text.substring(0, 30)}...]`);
                pendingUser = null;
            } else {
                // Assistant message without preceding user message (orphaned)
                console.warn('[convertToTurnPairs] Found orphaned assistant message at index:', exchange.index);
                pairs.push({
                    user: '',
                    assistant: exchange.text,
                    timestamp: exchange.timestamp || Date.now()
                });
            }
        }
    });
    
    // Save any remaining pending user message
    if (pendingUser) {
        console.warn('[convertToTurnPairs] Found unpaired user message at end, index:', pendingUser.index);
        pairs.push({
            user: pendingUser.text,
            assistant: '',
            timestamp: pendingUser.timestamp || Date.now()
        });
    }
    
    console.log(`[convertToTurnPairs] ✅ Converted ${exchanges.length} messages to ${pairs.length} turn pairs`);
    console.log('[convertToTurnPairs] First 3 pairs:', pairs.slice(0, 3));
    return pairs;
}

function savePersona() {
    const nameInput = document.getElementById('personaNameInput');
    const addToQueue = document.getElementById('addToMergeQueueCheckbox').checked;
    const name = nameInput.value.trim();
    
    if (!name) {
        updateStatus('⚠️ Please enter a persona name', 'warning');
        nameInput.focus();
        return;
    }
    
    if (!lastScrapedData) {
        updateStatus('❌ No scraped data to save', 'error');
        return;
    }
    
    // Convert exchanges to turn pair format
    const turnPairs = convertToTurnPairs(lastScrapedData.exchanges);
    
    // Create persona object
    const persona = {
        id: `persona-${Date.now()}`,
        name: name,
        platformId: lastScrapedData.platformId,
        platformName: lastScrapedData.platformName,
        url: lastScrapedData.url,
        timestamp: lastScrapedData.timestamp,
        exchanges: turnPairs
    };
    
    storedPersonas.push(persona);
    
    // Add to merge queue if requested
    if (addToQueue) {
        mergeQueue.push(persona.id);
    }
    
    // Save to storage
    Storage.set({ 
        [STORED_PERSONAS_KEY]: storedPersonas,
        [MERGE_QUEUE_KEY]: mergeQueue,
        [LAST_SCRAPED_DATA_KEY]: null 
    }, () => {
        renderPersonaLibrary(storedPersonas);
        renderMergeQueue(mergeQueue);
        
        // Hide dialog
        document.getElementById('savePersonaDialog').classList.add('hidden');
        document.getElementById('personaNameInput').value = '';
        document.getElementById('addToMergeQueueCheckbox').checked = false;
        
        lastScrapedData = null;
        
        const queueMsg = addToQueue ? ' and added to merge queue' : '';
        updateStatus(`💾 Persona "${name}" saved${queueMsg}!`, 'success');
    });
}

function cancelPersonaSave() {
    if (!confirm('Discard scraped data without saving?')) return;
    
    lastScrapedData = null;
    Storage.set({ [LAST_SCRAPED_DATA_KEY]: null });
    
    document.getElementById('savePersonaDialog').classList.add('hidden');
    document.getElementById('personaNameInput').value = '';
    document.getElementById('addToMergeQueueCheckbox').checked = false;
    
    updateStatus('Scraped data discarded', 'info');
}

function renderMergeQueue(queueIds) {
    const container = document.getElementById('mergeQueue');
    const countElement = document.getElementById('mergeQueueCount');
    
    if (!container || !countElement) return;
    
    countElement.textContent = `${queueIds.length} chat${queueIds.length !== 1 ? 's' : ''} selected`;
    
    // Update Step 2 next button text based on queue size
    const nextStep2Btn = document.getElementById('nextStep2Btn');
    if (nextStep2Btn) {
        if (queueIds.length <= 1) {
            nextStep2Btn.textContent = 'Next: Review & Prune ➔';
        } else {
            nextStep2Btn.textContent = 'Next: Merge & Prune ➔';
        }
    }
    
    // Update floating queue sidebar
    updateFloatingQueue(queueIds);
    
    if (queueIds.length === 0) {
        container.innerHTML = '<p class="text-indigo-400/70 italic text-center py-4 text-sm">No chats in merge queue. Check "Add to Merge Queue" when saving personas.</p>';
        return;
    }
    
    container.innerHTML = '';
    
    queueIds.forEach((id, index) => {
        const persona = storedPersonas.find(p => p.id === id);
        if (!persona) return;
        
        const colorClass = `persona-color-${storedPersonas.indexOf(persona) % 8}`;
        
        const card = document.createElement('div');
        card.className = `p-2 mb-2 rounded-lg border border-indigo-700/50 bg-indigo-900/30 ${colorClass}`;
        card.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="flex-1">
                    <p class="text-sm font-bold text-white">${persona.name}</p>
                    <p class="text-xs text-white/60">${persona.exchangeCount || persona.exchanges.length} exchanges</p>
                </div>
                <div class="flex items-center space-x-2">
                    <button class="move-up-btn text-xs text-white/70 hover:text-white" data-index="${index}" ${index === 0 ? 'disabled' : ''}>▲</button>
                    <button class="move-down-btn text-xs text-white/70 hover:text-white" data-index="${index}" ${index === queueIds.length - 1 ? 'disabled' : ''}>▼</button>
                    <button class="remove-from-queue-btn text-xs bg-red-700/70 hover:bg-red-600/90 text-white font-bold py-1 px-2 rounded transition" data-id="${id}">✕</button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    // Attach event listeners
    container.querySelectorAll('.move-up-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            if (index > 0) {
                [mergeQueue[index - 1], mergeQueue[index]] = [mergeQueue[index], mergeQueue[index - 1]];
                Storage.set({ [MERGE_QUEUE_KEY]: mergeQueue }, () => renderMergeQueue(mergeQueue));
            }
        });
    });
    
    container.querySelectorAll('.move-down-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            if (index < mergeQueue.length - 1) {
                [mergeQueue[index], mergeQueue[index + 1]] = [mergeQueue[index + 1], mergeQueue[index]];
                Storage.set({ [MERGE_QUEUE_KEY]: mergeQueue }, () => renderMergeQueue(mergeQueue));
            }
        });
    });
    
    container.querySelectorAll('.remove-from-queue-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            mergeQueue = mergeQueue.filter(qid => qid !== id);
            Storage.set({ [MERGE_QUEUE_KEY]: mergeQueue }, () => {
                renderMergeQueue(mergeQueue);
                updateStatus('Removed from merge queue', 'info');
            });
        });
    });
}

function toggleConfigurator() {
    const section = document.getElementById('configuratorSection');
    const icon = document.getElementById('configuratorToggleIcon');
    
    if (!section || !icon) return;
    
    if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        icon.classList.add('rotate-90');
    } else {
        section.classList.add('hidden');
        icon.classList.remove('rotate-90');
    }
}

function toggleFloatingQueue() {
    const floatingQueue = document.getElementById('floatingMergeQueue');
    if (!floatingQueue) return;
    
    floatingQueue.classList.toggle('collapsed');
}

function updateFloatingQueue(queueIds) {
    const container = document.getElementById('floatingQueueList');
    const countBadge = document.getElementById('floatingQueueCount');
    
    if (!container || !countBadge) return;
    
    countBadge.textContent = queueIds.length;
    
    if (queueIds.length === 0) {
        container.innerHTML = '<p class="text-indigo-400/70 italic text-center py-4 text-xs">No personas in queue</p>';
        return;
    }
    
    container.innerHTML = '';
    
    queueIds.forEach((id, index) => {
        const persona = storedPersonas.find(p => p.id === id);
        if (!persona) return;
        
        const colorClass = `persona-color-${storedPersonas.indexOf(persona) % 8}`;
        
        const card = document.createElement('div');
        card.className = `p-2 mb-2 rounded-md border border-indigo-700/50 bg-indigo-900/30 ${colorClass}`;
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-white truncate">${persona.name}</p>
                    <p class="text-xs text-white/50">${persona.exchangeCount || persona.exchanges.length} ex.</p>
                </div>
                <div class="flex flex-col items-center ml-2">
                    <button class="floating-remove-btn text-xs text-red-400 hover:text-red-300" data-id="${id}">✕</button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    // Attach remove handlers
    container.querySelectorAll('.floating-remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            mergeQueue = mergeQueue.filter(qid => qid !== id);
            Storage.set({ [MERGE_QUEUE_KEY]: mergeQueue }, () => {
                renderMergeQueue(mergeQueue);
                updateStatus('Removed from merge queue', 'info');
            });
        });
    });
}


// --- Rendering Functions ---

function initAutoDetectToggle(isAutoDetectEnabled) {
    const toggle = document.getElementById('autoDetectToggle');
    if (!toggle) return;

    toggle.checked = isAutoDetectEnabled;
    
    toggle.addEventListener('change', () => {
        const newState = toggle.checked;
        Storage.set({ [AUTO_DETECT_KEY]: newState }, () => {
            updateStatus(`Auto-Detect set to: ${newState ? 'ON' : 'OFF'}`, 'info');
        });
    });
}

function renderConfigurator(configs) {
    const container = document.getElementById('configuratorBody');
    if (!container) return;
    container.innerHTML = ''; 

    configs.forEach(config => {
        const mode = (config.id === 'gemini' || config.id === 'claude') ? 'default' : 'custom';
        const configId = `config-${config.id}`;
        
        // CRITICAL: Ensure preamble object exists with both TRANSFER and CONTINUITY keys
        if (!config.preamble || typeof config.preamble !== 'object') {
            config.preamble = { TRANSFER: '', CONTINUITY: '' };
        }
        if (!config.preamble.TRANSFER) {
            config.preamble.TRANSFER = '';
        }
        if (!config.preamble.CONTINUITY) {
            config.preamble.CONTINUITY = '';
        }
        
        // --- HTML Template for each configuration ---
        const configHtml = `
            <div id="${configId}" class="config-item my-2 border border-indigo-700/50 rounded-lg overflow-hidden">
                <div id="${configId}-header" class="config-header p-3 bg-indigo-900/50 cursor-pointer flex justify-between items-center transition duration-200">
                    <h3 class="font-bold text-white">${config.name} (${mode.toUpperCase()})</h3>
                    <div class="flex items-center space-x-2 text-sm">
                        <span class="text-white/70 truncate">${config.urlPattern}</span>
                        <span id="${configId}-indicator" class="collapse-indicator transform transition-transform duration-200">►</span>
                    </div>
                </div>
                <div id="${configId}-body" class="config-body p-4 text-sm bg-indigo-900/20 hidden">
                    <label class="block text-indigo-200/90 mb-1">Platform Name</label>
                    <input type="text" data-field="name" value="${config.name}" class="w-full p-2 bg-indigo-900/40 border border-indigo-700 text-white rounded-md mb-3" oninput="updateConfig('${config.id}', 'name', this.value)">

                    <label class="block text-indigo-200/90 mb-1">Scraper URL Pattern (* is wildcard)</label>
                    <input type="text" data-field="urlPattern" value="${config.urlPattern}" class="w-full p-2 bg-indigo-900/40 border border-indigo-700 text-white rounded-md mb-3" oninput="updateConfig('${config.id}', 'urlPattern', this.value)">

                    <label class="block text-indigo-200/90 mb-1">Message Block Selector (CSS)</label>
                    <input type="text" data-field="selectors.messages" value="${config.selectors.messages}" class="w-full p-2 bg-indigo-900/40 border border-indigo-700 text-white rounded-md mb-3" oninput="updateConfig('${config.id}', 'selectors.messages', this.value)">
                    
                    <label class="block text-indigo-200/90 mb-1">Speaker Selector (CSS, e.g., for user/model labels)</label>
                    <input type="text" data-field="selectors.speaker" value="${config.selectors.speaker}" class="w-full p-2 bg-indigo-900/40 border border-indigo-700 text-white rounded-md mb-3" oninput="updateConfig('${config.id}', 'selectors.speaker', this.value)">
                    
                    <h4 class="font-bold text-indigo-300 mt-4 mb-2">Preamble Templates</h4>
                    <label class="block text-indigo-200/90 mb-1">TRANSFER Mode Preamble (Cross-Platform / High Intensity)</label>
                    <textarea data-field="preamble.TRANSFER" class="w-full p-2 bg-indigo-900/40 border border-indigo-700 text-white rounded-md mb-3 h-32" oninput="updateConfig('${config.id}', 'preamble.TRANSFER', this.value)">${config.preamble.TRANSFER}</textarea>

                    <label class="block text-indigo-200/90 mb-1">CONTINUITY Mode Preamble (Same Platform / Low Intensity)</label>
                    <textarea data-field="preamble.CONTINUITY" class="w-full p-2 bg-indigo-900/40 border border-indigo-700 text-white rounded-md mb-3 h-32" oninput="updateConfig('${config.id}', 'preamble.CONTINUITY', this.value)">${config.preamble.CONTINUITY}</textarea>
                    
                    ${mode === 'custom' ? `<button class="delete-config-btn text-sm bg-red-700/50 hover:bg-red-600 p-2 rounded-md transition duration-200 mt-2" data-config-id="${config.id}">Delete Custom Platform</button>` : ''}
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', configHtml);
        
        // Attach click listener for collapse/expand
        document.getElementById(`${configId}-header`)?.addEventListener('click', (event) => {
            // Prevent interaction with input fields from collapsing the panel
            if (event.target.closest('input, textarea, button')) {
                return;
            }
            toggleConfigCollapse(configId);
        });
    });
    
    // Attach delete button listeners
    container.querySelectorAll('.delete-config-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const configId = e.target.dataset.configId;
            deleteConfig(configId);
        });
    });
}

function renderOutputSection(configs, defaultTransferMode, lastConfigId) {
    const transferModeSelect = document.getElementById('transferModeSelect');
    const targetPlatformSelect = document.getElementById('targetPlatformSelect');
    
    if (!transferModeSelect || !targetPlatformSelect) {
        console.error("[Crystalizer] Failed to find critical output select elements.");
        return;
    }

    targetPlatformSelect.innerHTML = '';
    
    // Ensure the last used config ID is valid, otherwise default to the first
    let initialTargetId = lastConfigId && configs.find(c => c.id === lastConfigId) ? lastConfigId : configs[0].id;


    configs.forEach(config => {
        const option = document.createElement('option');
        option.value = config.id;
        option.textContent = config.name;
        targetPlatformSelect.appendChild(option);
    });

    targetPlatformSelect.value = initialTargetId;
    transferModeSelect.value = defaultTransferMode;
    
    // NOTE: Caller is responsible for calling updatePreamblePreview after this function completes
    // This ensures dropdowns are fully populated before preview is generated
}

function renderScrapedChats(chats) {
    // Renders the scraped chats visualization (Placeholder logic)
    const container = document.getElementById('chatsVisualization');
    const countElement = document.getElementById('scrapedChatCount');
    if (!container || !countElement) return;
    
    // Placeholder content
    container.innerHTML = '<p class="text-indigo-400/70 italic text-center py-4">Scrape a chat to begin visualization and pruning.</p>';
    
    let totalExchanges = 0;
    chats.forEach(chat => {
        totalExchanges += chat.exchanges.length;
    });
    
    countElement.textContent = `${totalExchanges} Exchanges (${chats.length} Chats)`;
}


// --- Data Manipulation and Persistence ---

function addCustomConfig() {
    const newId = `custom-${Date.now()}`;
    const newConfig = {
        id: newId,
        name: 'New Custom Platform',
        urlPattern: 'https://new.platform.com/*',
        isScraperActive: true,
        selectors: {
            messages: 'div.message',
            speaker: 'span.speaker',
            user: 'div.user',
            model: 'div.model',
            text: 'div.text'
        },
        preamble: {
            TRANSFER: "## CUSTOM TRANSFER INSTRUCTION\n\n[Describe the highest-intensity transfer instruction for this platform here. Use the ${fileUrl} variable for the link.]",
            CONTINUITY: "## CUSTOM CONTINUITY INSTRUCTION\n\n[Describe the lower-intensity continuity instruction for this platform here.]"
        }
    };

    llmConfigs.push(newConfig);
    Storage.set({ [CONFIG_KEY]: llmConfigs }, () => {
        renderConfigurator(llmConfigs);
        // Pass the current transfer mode to preserve it after re-render
        const transferModeSelect = document.getElementById('transferModeSelect');
        const currentTransferMode = transferModeSelect ? transferModeSelect.value : 'TRANSFER';
        renderOutputSection(llmConfigs, currentTransferMode);
        updatePreamblePreview();
        toggleConfigCollapse(`config-${newId}`);
    });
}

function updateConfig(id, field, value) {
    const config = llmConfigs.find(c => c.id === id);
    if (!config) return;

    // Use dynamic property access for nested fields like selectors.messages
    const parts = field.split('.');
    let current = config;
    for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;

    Storage.set({ [CONFIG_KEY]: llmConfigs }, () => {
        // We only need to re-render the output section to update the dropdown labels/values
        const transferModeSelect = document.getElementById('transferModeSelect');
        const currentTransferMode = transferModeSelect ? transferModeSelect.value : 'TRANSFER';
        renderOutputSection(llmConfigs, currentTransferMode);
        // Call updatePreamblePreview after renderOutputSection completes
        updatePreamblePreview(); 
    });
}

function deleteConfig(id) {
    if (!confirm(`Are you sure you want to delete the platform config for ${id}?`)) return;

    llmConfigs = llmConfigs.filter(c => c.id !== id);
    
    Storage.set({ [CONFIG_KEY]: llmConfigs }, () => {
        renderConfigurator(llmConfigs);
        // Pass the current transfer mode to preserve it after re-render
        const transferModeSelect = document.getElementById('transferModeSelect');
        const currentTransferMode = transferModeSelect ? transferModeSelect.value : 'TRANSFER';
        renderOutputSection(llmConfigs, currentTransferMode);
        updatePreamblePreview();
    });
}

function clearStoredChats() {
    if (!confirm("Are you sure you want to clear ALL scraped chat data? This cannot be undone.")) return;
    Storage.set({ [STORED_CHATS_KEY]: [] }, () => {
        renderScrapedChats([]);
        alert('All stored chat data cleared.');
    });
}

function generateFinalOutput() {
    alert("Functionality pending: Will generate the Master Transcript and Preamble files.");
    // Placeholder for final output logic
}

function updatePreamblePreview() {
    const modeSelect = document.getElementById('transferModeSelect');
    const targetSelect = document.getElementById('targetPlatformSelect');
    const previewElement = document.getElementById('preamblePreview');

    // CRITICAL: Exit immediately if essential elements are not yet rendered.
    if (!modeSelect || !targetSelect || !previewElement || llmConfigs.length === 0) {
        // Silent return - elements not ready yet (normal during initialization)
        return; 
    }

    const mode = modeSelect.value;
    const targetConfigId = targetSelect.value;
    
    // CRITICAL: Validate that dropdown values are actually set (not empty string)
    if (!mode || !targetConfigId) {
        // Silent return - values not set yet (normal during initialization)
        return;
    }
    
    // 1. Find Config (Must be defensive against empty selection)
    const targetConfig = llmConfigs.find(c => c.id === targetConfigId);

    if (!targetConfig) {
        previewElement.value = `Error: Select a valid platform configuration in the dropdown.`;
        return;
    }
    
    // 2. Safely Access Template Object (Use transfer mode value as key)
    const preambleObject = targetConfig.preamble;
    
    if (!preambleObject || typeof preambleObject !== 'object') {
        previewElement.value = `Error: Preamble configuration for ${targetConfig.name} is corrupted.`;
        return;
    }
    
    // 3. Safely Access Specific Template
    const template = preambleObject[mode]; // 'TRANSFER' or 'CONTINUITY'

    if (!template) {
        previewElement.value = `Error: Preamble template for mode '${mode}' is missing in the configuration for ${targetConfig.name}.`;
        return;
    }
    
    // Display the template as-is (no more URL placeholder substitution needed)
    previewElement.value = template;
    
    Storage.set({ [TRANSFER_MODE_KEY]: mode });
    Storage.set({ [LAST_CONFIG_ID_KEY]: targetConfigId }); // Save the last successful target
}

function toggleConfigCollapse(configId) {
    const body = document.getElementById(`${configId}-body`);
    const indicator = document.getElementById(`${configId}-indicator`);
    if (body && indicator) {
        const isHidden = body.classList.contains('hidden');
        if (isHidden) {
            body.classList.remove('hidden');
            indicator.classList.add('rotate-90');
        } else {
            body.classList.add('hidden');
            indicator.classList.remove('rotate-90');
        }
    }
}


// --- Data Export/Import ---

function exportConfigs() {
    const dataStr = JSON.stringify(llmConfigs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crystalizer_configs_${Date.now()}.json`;
    
    // Use setTimeout to prevent popup from closing
    setTimeout(() => {
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }, 0);
    
    updateStatus('⚙️ Configs exported', 'success');
}

function importConfigs() {
    const file = document.getElementById('importConfigFile').files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const configs = JSON.parse(e.target.result);
            if (!Array.isArray(configs)) throw new Error('Invalid format');
            
            llmConfigs = configs;
            Storage.set({ [CONFIG_KEY]: llmConfigs }, () => {
                renderConfigurator(llmConfigs);
                updateStatus('Configs imported successfully', 'success');
            });
        } catch (err) {
            updateStatus('Import failed: Invalid file format', 'error');
        }
    };
    reader.readAsText(file);
}


// --- Merge & Prune Functions (Placeholder - implement tomorrow) ---

// Global state for merged exchanges
let mergedExchanges = [];

function preparePruningInterface() {
    console.log('[preparePruningInterface] Preparing pruning interface for merge queue:', mergeQueue);
    
    const container = document.getElementById('pruningInterface');
    const legendContainer = document.getElementById('legendItems');
    const mergeOptionsSection = document.getElementById('mergeOptionsSection');
    
    if (!container) return;
    
    if (mergeQueue.length === 0) {
        container.innerHTML = '<p class="text-indigo-400/70 italic text-center py-8 text-sm">No chats to prune. Add personas in Step 1 or Step 2.</p>';
        if (legendContainer) legendContainer.innerHTML = '';
        if (mergeOptionsSection) mergeOptionsSection.style.display = 'none';
        return;
    }
    
    // Single persona: Auto-load for pruning (no merge needed)
    if (mergeQueue.length === 1) {
        if (mergeOptionsSection) mergeOptionsSection.style.display = 'none';
        
        // Auto-load the single persona for pruning
        if (mergedExchanges.length === 0) {
            console.log('[preparePruningInterface] Single persona detected, auto-loading for pruning');
            const persona = storedPersonas.find(p => p.id === mergeQueue[0]);
            if (persona) {
                // Convert persona exchanges to pruning format
                mergedExchanges = persona.exchanges.map((exchange, index) => ({
                    ...exchange,
                    sourcePersonaId: persona.id,
                    sourcePersonaName: persona.name,
                    sourcePersonaIndex: 0,
                    sourcePlatform: persona.platformName || 'Unknown',
                    colorIndex: 0,
                    originalIndex: index,
                    selected: true,
                    expanded: false
                }));
                prunedExchanges = [...mergedExchanges];
                updateStatus(`📋 Loaded ${mergedExchanges.length} exchanges from "${persona.name}"`, 'success');
            }
        }
        
        renderPruningInterface(prunedExchanges);
        renderPersonaLegend();
        return;
    }
    
    // Multiple personas: Show merge options
    if (mergeOptionsSection) {
        mergeOptionsSection.style.display = 'block';
    }
    
    // Show "Execute Merge" message if merge hasn't been run yet
    if (mergedExchanges.length === 0) {
        container.innerHTML = '<p class="text-indigo-400 text-center py-8 text-sm">👆 Click "🔗 Execute Merge" above to combine your personas and start pruning.</p>';
        renderPersonaLegend();
        return;
    }
    
    // Render the pruning interface with merged exchanges
    renderPruningInterface(prunedExchanges);
    renderPersonaLegend();
}

function executeMerge() {
    console.log('[executeMerge] Starting merge process');
    
    if (mergeQueue.length === 0) {
        updateStatus('⚠️ No personas in merge queue', 'warning');
        return;
    }
    
    // Get merge strategy
    const strategySelect = document.getElementById('mergeStrategySelect');
    const strategy = strategySelect?.value || 'chronological';
    
    console.log(`[executeMerge] Using strategy: ${strategy}`);
    updateStatus(`🔗 Merging ${mergeQueue.length} persona(s) using ${strategy} strategy...`, 'info');
    
    // Execute merge based on strategy
    switch (strategy) {
        case 'chronological':
            mergedExchanges = mergeChronological(mergeQueue);
            break;
        case 'manual':
            mergedExchanges = mergeManual(mergeQueue);
            break;
        case 'platform':
            mergedExchanges = mergeByPlatform(mergeQueue);
            break;
        default:
            mergedExchanges = mergeChronological(mergeQueue);
    }
    
    console.log(`[executeMerge] Merge complete. Total exchanges: ${mergedExchanges.length}`);
    updateStatus(`✅ Merged ${mergedExchanges.length} exchanges! Now select which ones to keep.`, 'success');
    
    // Initialize pruned exchanges (all selected by default)
    prunedExchanges = mergedExchanges.map(ex => ({ ...ex, selected: true }));
    
    // Render the pruning interface
    renderPruningInterface(prunedExchanges);
    renderPersonaLegend();
}

function mergeChronological(personaIds) {
    console.log('[mergeChronological] Merging chronologically');
    const allExchanges = [];
    
    personaIds.forEach((id, queueIndex) => {
        const persona = storedPersonas.find(p => p.id === id);
        if (!persona) {
            console.warn(`[mergeChronological] Persona ${id} not found`);
            return;
        }
        
        const colorIndex = queueIndex % 8;
        
        persona.exchanges.forEach((exchange, exchangeIndex) => {
            allExchanges.push({
                ...exchange,
                sourcePersonaId: id,
                sourcePersonaName: persona.name,
                sourcePersonaIndex: queueIndex,
                sourcePlatform: persona.platformName || 'Unknown',
                colorIndex: colorIndex,
                originalIndex: exchangeIndex
            });
        });
    });
    
    // Sort by timestamp
    allExchanges.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0);
        const timeB = new Date(b.timestamp || 0);
        return timeA - timeB;
    });
    
    console.log(`[mergeChronological] Merged ${allExchanges.length} exchanges`);
    return allExchanges;
}

function mergeManual(personaIds) {
    console.log('[mergeManual] Merging in queue order');
    const allExchanges = [];
    
    personaIds.forEach((id, queueIndex) => {
        const persona = storedPersonas.find(p => p.id === id);
        if (!persona) return;
        
        const colorIndex = queueIndex % 8;
        
        persona.exchanges.forEach((exchange, exchangeIndex) => {
            allExchanges.push({
                ...exchange,
                sourcePersonaId: id,
                sourcePersonaName: persona.name,
                sourcePersonaIndex: queueIndex,
                sourcePlatform: persona.platformName || 'Unknown',
                colorIndex: colorIndex,
                originalIndex: exchangeIndex
            });
        });
    });
    
    console.log(`[mergeManual] Merged ${allExchanges.length} exchanges in queue order`);
    return allExchanges;
}

function mergeByPlatform(personaIds) {
    console.log('[mergeByPlatform] Merging grouped by platform');
    const platformGroups = {};
    
    // Group personas by platform
    personaIds.forEach((id, queueIndex) => {
        const persona = storedPersonas.find(p => p.id === id);
        if (!persona) return;
        
        const platform = persona.platformName || 'Unknown';
        if (!platformGroups[platform]) {
            platformGroups[platform] = [];
        }
        
        const colorIndex = queueIndex % 8;
        
        persona.exchanges.forEach((exchange, exchangeIndex) => {
            platformGroups[platform].push({
                ...exchange,
                sourcePersonaId: id,
                sourcePersonaName: persona.name,
                sourcePersonaIndex: queueIndex,
                sourcePlatform: platform,
                colorIndex: colorIndex,
                originalIndex: exchangeIndex
            });
        });
    });
    
    // Sort within each platform group by timestamp
    const allExchanges = [];
    Object.keys(platformGroups).forEach(platform => {
        const group = platformGroups[platform];
        group.sort((a, b) => {
            const timeA = new Date(a.timestamp || 0);
            const timeB = new Date(b.timestamp || 0);
            return timeA - timeB;
        });
        allExchanges.push(...group);
    });
    
    console.log(`[mergeByPlatform] Merged ${allExchanges.length} exchanges grouped by platform`);
    return allExchanges;
}

function renderPersonaLegend() {
    const legendContainer = document.getElementById('legendItems');
    if (!legendContainer) return;
    
    if (mergeQueue.length === 0) {
        legendContainer.innerHTML = '';
        return;
    }
    
    legendContainer.innerHTML = '';
    
    mergeQueue.forEach((id, index) => {
        const persona = storedPersonas.find(p => p.id === id);
        if (!persona) return;
        
        const colorIndex = index % 8;
        const colorClass = `persona-color-${colorIndex}`;
        
        const legendItem = document.createElement('div');
        legendItem.className = `flex items-center gap-1 text-xs ${colorClass}`;
        legendItem.innerHTML = `
            <div class="w-3 h-3 rounded-full bg-current"></div>
            <span>${persona.name}</span>
        `;
        
        legendContainer.appendChild(legendItem);
    });
}

function renderPruningInterface(exchanges) {
    const container = document.getElementById('pruningInterface');
    if (!container) return;
    
    if (!exchanges || exchanges.length === 0) {
        container.innerHTML = '<p class="text-indigo-400/70 italic text-center py-8 text-sm">No exchanges to display.</p>';
        updateSelectedCount();
        return;
    }
    
    container.innerHTML = '';
    
    // Add "Select All" / "Deselect All" controls
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'flex justify-between items-center mb-3 p-2 bg-indigo-900/30 rounded sticky top-0 z-10';
    controlsDiv.innerHTML = `
        <div class="flex gap-2">
            <button id="selectAllBtn" class="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1 px-3 rounded transition">
                ✅ Select All
            </button>
            <button id="deselectAllBtn" class="text-xs bg-indigo-700/50 hover:bg-indigo-600/70 text-white font-bold py-1 px-3 rounded transition">
                ❌ Deselect All
            </button>
        </div>
        <span class="text-xs text-white/70" id="selectedCountDisplay">0/0 selected</span>
    `;
    container.appendChild(controlsDiv);
    
    // Render each exchange as a turn pair card
    exchanges.forEach((exchange, index) => {
        const card = createTurnPairCard(exchange, index);
        container.appendChild(card);
    });
    
    // Attach control button listeners
    document.getElementById('selectAllBtn')?.addEventListener('click', () => {
        prunedExchanges.forEach(ex => ex.selected = true);
        savePruningProgress();
        renderPruningInterface(prunedExchanges);
    });
    
    document.getElementById('deselectAllBtn')?.addEventListener('click', () => {
        prunedExchanges.forEach(ex => ex.selected = false);
        savePruningProgress();
        renderPruningInterface(prunedExchanges);
    });
    
    updateSelectedCount();
}

function createTurnPairCard(exchange, index) {
    const card = document.createElement('div');
    const colorClass = `persona-color-${exchange.colorIndex}`;
    const isSelected = exchange.selected !== false; // Default to true
    
    card.className = `turn-pair-card mb-2 p-3 rounded-lg border-l-4 ${colorClass} ${isSelected ? 'bg-indigo-900/30' : 'bg-indigo-900/10 opacity-50'} transition-all`;
    card.dataset.index = index;
    
    const timestamp = exchange.timestamp ? new Date(exchange.timestamp).toLocaleString() : 'No timestamp';
    
    // Handle both old format (user/assistant) and new format (speaker/text arrays)
    let userText = '';
    let assistantText = '';
    
    if (exchange.user && exchange.assistant) {
        // Old format
        userText = exchange.user;
        assistantText = exchange.assistant;
    } else if (exchange.text) {
        // Individual message format - shouldn't happen after pairing
        userText = exchange.speaker === 'user' ? exchange.text : '';
        assistantText = exchange.speaker === 'model' ? exchange.text : '';
    }
    
    // Calculate line count for preview (2-3 lines ~= 120-180 chars)
    const previewLength = 180;
    const userPreview = userText && userText.length > previewLength ? userText.substring(0, previewLength) + '...' : userText || 'No user message';
    const assistantPreview = assistantText && assistantText.length > previewLength ? assistantText.substring(0, previewLength) + '...' : assistantText || 'No assistant response';
    
    card.innerHTML = `
        <div class="flex items-start justify-between mb-2">
            <div class="flex items-center gap-2 flex-1">
                <input type="checkbox" class="turn-checkbox w-4 h-4 cursor-pointer flex-shrink-0" ${isSelected ? 'checked' : ''}>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-white truncate">${exchange.sourcePersonaName}</p>
                    <p class="text-xs text-white/60 truncate">${exchange.sourcePlatform} • ${timestamp}</p>
                </div>
            </div>
            <button class="expand-btn text-[10px] text-indigo-400 hover:text-indigo-300 transition px-2 py-1 ml-2 flex-shrink-0">
                ${exchange.expanded ? '▲' : '▼'}
            </button>
        </div>
        
        <div class="turn-content ${exchange.expanded ? 'expanded' : ''} text-sm">
            <!-- Chat-style layout: User on right (green), Assistant on left (blue) -->
            <div class="flex flex-col gap-4 py-2">
                <!-- User message (right-aligned, green bubble) - only show if exists -->
                ${userText ? `
                <div class="flex justify-end">
                    <div class="max-w-[75%] bg-emerald-600 rounded-xl rounded-tr-md p-4 shadow-md border border-emerald-500">
                        <p class="text-xs text-emerald-100 font-bold mb-2 flex items-center gap-1">
                            <span class="text-base">👤</span> User
                        </p>
                        <p class="text-white whitespace-pre-wrap text-sm leading-relaxed">${exchange.expanded ? userText : userPreview}</p>
                    </div>
                </div>
                ` : `
                <div class="flex justify-end">
                    <div class="max-w-[75%] bg-amber-600/30 rounded-xl rounded-tr-md p-3 border border-amber-500/40">
                        <p class="text-xs text-amber-300 italic">💬 Chat started by assistant</p>
                    </div>
                </div>
                `}
                
                <!-- Assistant message (left-aligned, blue bubble) - only show if exists -->
                ${assistantText ? `
                <div class="flex justify-start">
                    <div class="max-w-[75%] bg-blue-600 rounded-xl rounded-tl-md p-4 shadow-md border border-blue-500">
                        <p class="text-xs text-blue-100 font-bold mb-2 flex items-center gap-1">
                            <span class="text-base">🤖</span> Assistant
                        </p>
                        <p class="text-white whitespace-pre-wrap text-sm leading-relaxed">${exchange.expanded ? assistantText : assistantPreview}</p>
                    </div>
                </div>
                ` : `
                <div class="flex justify-start">
                    <div class="max-w-[75%] bg-amber-600/30 rounded-xl rounded-tl-md p-3 border border-amber-500/40">
                        <p class="text-xs text-amber-300 italic">⏳ Waiting for response...</p>
                    </div>
                </div>
                `}
            </div>
        </div>
    `;
    
    // Attach checkbox listener
    const checkbox = card.querySelector('.turn-checkbox');
    checkbox?.addEventListener('change', (e) => {
        prunedExchanges[index].selected = e.target.checked;
        card.classList.toggle('opacity-50', !e.target.checked);
        card.classList.toggle('bg-indigo-900/30', e.target.checked);
        card.classList.toggle('bg-indigo-900/10', !e.target.checked);
        updateSelectedCount();
        
        // Auto-save pruning progress
        savePruningProgress();
    });
    
    // Attach expand/collapse listener
    const expandBtn = card.querySelector('.expand-btn');
    expandBtn?.addEventListener('click', () => {
        prunedExchanges[index].expanded = !prunedExchanges[index].expanded;
        renderPruningInterface(prunedExchanges);
    });
    
    return card;
}

function updateSelectedCount() {
    const selectedCount = prunedExchanges.filter(ex => ex.selected !== false).length;
    const totalCount = prunedExchanges.length;
    
    // Update both displays
    const displays = [
        document.getElementById('selectedTurnCount'),
        document.getElementById('selectedCountDisplay')
    ];
    
    displays.forEach(el => {
        if (el) el.textContent = `${selectedCount}/${totalCount} selected`;
    });
}

function savePruningProgress() {
    // Auto-save current pruning state
    Storage.set({ 
        [PRUNED_EXCHANGES_KEY]: prunedExchanges,
        [CURRENT_STEP_KEY]: currentStep
    }, () => {
        console.log('[savePruningProgress] Auto-saved pruning progress');
    });
}

function restorePruningProgress() {
    // Restore pruning state if extension was closed
    Storage.get([PRUNED_EXCHANGES_KEY], (result) => {
        if (result[PRUNED_EXCHANGES_KEY] && result[PRUNED_EXCHANGES_KEY].length > 0) {
            prunedExchanges = result[PRUNED_EXCHANGES_KEY];
            console.log('[restorePruningProgress] Restored', prunedExchanges.length, 'exchanges from previous session');
            
            // If we're on step 3 and have saved progress, render it
            if (currentStep === 3) {
                renderPruningInterface(prunedExchanges);
            }
        }
    });
}


// --- Export Functions ---

function downloadMarkdown() {
    if (!prunedExchanges || prunedExchanges.length === 0) {
        updateStatus('⚠️ No exchanges to export', 'warning');
        return;
    }
    
    // Filter only selected exchanges
    const selectedExchanges = prunedExchanges.filter(ex => ex.selected !== false);
    
    if (selectedExchanges.length === 0) {
        updateStatus('⚠️ No exchanges selected', 'warning');
        return;
    }
    
    // Generate markdown content
    let markdown = `# 💎 Crystalizer Master Transcript\n\n`;
    markdown += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    markdown += `**Total Exchanges:** ${selectedExchanges.length}\n\n`;
    markdown += `---\n\n`;
    
    selectedExchanges.forEach((exchange, index) => {
        const timestamp = exchange.timestamp ? new Date(exchange.timestamp).toLocaleString() : 'No timestamp';
        
        markdown += `## Exchange ${index + 1}\n\n`;
        markdown += `*${timestamp}*\n\n`;
        
        if (exchange.user && exchange.user.trim()) {
            markdown += `### 👤 User\n\n`;
            markdown += `${exchange.user}\n\n`;
        }
        
        if (exchange.assistant && exchange.assistant.trim()) {
            markdown += `### 🤖 Assistant\n\n`;
            markdown += `${exchange.assistant}\n\n`;
        }
        
        markdown += `---\n\n`;
    });
    
    // Add footer
    markdown += `\n*Generated by Crystalizer Context Curator*\n`;
    
    // Create download
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crystalizer_transcript_${Date.now()}.md`;
    
    setTimeout(() => {
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
        updateStatus(`💾 Downloaded ${selectedExchanges.length} exchanges as markdown`, 'success');
    }, 0);
}

function copyToClipboard() {
    if (!prunedExchanges || prunedExchanges.length === 0) {
        updateStatus('⚠️ No exchanges to copy', 'warning');
        return;
    }
    
    // Filter only selected exchanges
    const selectedExchanges = prunedExchanges.filter(ex => ex.selected !== false);
    
    if (selectedExchanges.length === 0) {
        updateStatus('⚠️ No exchanges selected', 'warning');
        return;
    }
    
    // Get the preamble
    const preambleElement = document.getElementById('preamblePreview');
    
    // Build the clipboard content
    let text = '';
    if (preambleElement && preambleElement.value) {
        text = preambleElement.value + '\n\n';
        text += '═'.repeat(80) + '\n\n';
    }
    
    // Add usage instructions
    text += `📎 INSTRUCTIONS:\n`;
    text += `1. Upload the downloaded markdown file as an attachment to your AI chat\n`;
    text += `2. Paste this preamble into the message along with the attachment\n`;
    text += `3. Send - the AI will read the full transcript (${selectedExchanges.length} exchanges) from the attached file\n\n`;
    text += '═'.repeat(80) + '\n\n';
    
    // Copy to clipboard using modern API with fallback
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            updateStatus(`📋 Copied preamble to clipboard! Remember to attach the markdown file.`, 'success');
        }).catch(err => {
            console.error('Clipboard copy failed:', err);
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
            text += `${'-'.repeat(80)}\n\n`;
            if (exchange.user && exchange.user.trim()) {
                text += `👤 USER:\n${exchange.user}\n\n`;
            }
    // Copy to clipboard using modern API with fallback
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            updateStatus(`📋 Copied preamble to clipboard! Remember to attach the markdown file.`, 'success');
        }).catch(err => {
            console.error('Clipboard copy failed:', err);
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        updateStatus('� Copied to clipboard (legacy method)', 'success');
    } catch (err) {
        console.error('Fallback copy failed:', err);
        updateStatus('❌ Copy failed - please try again', 'error');
    }
    
    document.body.removeChild(textarea);
}

function saveAsMergedPersona() {
    if (!prunedExchanges || prunedExchanges.length === 0) {
        updateStatus('⚠️ No exchanges to save', 'warning');
        return;
    }
    
    // Filter only selected exchanges
    const selectedExchanges = prunedExchanges.filter(ex => ex.selected !== false);
    
    if (selectedExchanges.length === 0) {
        updateStatus('⚠️ No exchanges selected', 'warning');
        return;
    }
    
    // Prompt for persona name
    const personaName = prompt('Enter a name for this merged persona:', `Merged Persona ${Date.now()}`);
    
    if (!personaName || !personaName.trim()) {
        updateStatus('❌ Save cancelled', 'info');
        return;
    }
    
    // Create new persona from selected exchanges
    const newPersona = {
        id: `persona-${Date.now()}`,
        name: personaName.trim(),
        platformId: 'merged',
        platformName: 'Merged Context',
        url: '',
        timestamp: Date.now(),
        exchanges: selectedExchanges.map(ex => ({
            user: ex.user || '',
            assistant: ex.assistant || '',
            timestamp: ex.timestamp || Date.now()
        })),
        exchangeCount: selectedExchanges.length
    };
    
    // Add to stored personas
    storedPersonas.push(newPersona);
    
    Storage.set({ [STORED_PERSONAS_KEY]: storedPersonas }, () => {
        renderPersonaLibrary(storedPersonas);
        updateStatus(`✅ Saved "${personaName}" as persona (${selectedExchanges.length} exchanges)`, 'success');
    });
}


// --- Storage Management Helper (accessible from console) ---
window.crystalizerResetStorage = function() {
    console.log('[Crystalizer] Clearing all storage...');
    chrome.storage.local.clear(() => {
        console.log('[Crystalizer] Storage cleared! Reloading extension...');
        alert('✅ Crystalizer storage cleared! The extension will reload now.');
        window.location.reload();
    });
};

window.crystalizerDebug = function() {
    console.log('=== CRYSTALIZER DEBUG INFO ===');
    console.log('Current Step:', currentStep);
    console.log('Stored Personas:', storedPersonas);
    console.log('Merge Queue:', mergeQueue);
    console.log('Merged Exchanges:', mergedExchanges.length);
    console.log('Pruned Exchanges:', prunedExchanges.length);
    
    chrome.storage.local.get(null, (result) => {
        console.log('Storage Contents:', result);
    });
};

// --- Initialize when the DOM is ready ---
document.addEventListener('DOMContentLoaded', loadAppState);

function fallbackCopyToClipboard(text) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        updateStatus('� Copied to clipboard (legacy method)', 'success');
    } catch (err) {
        console.error('Fallback copy failed:', err);
        updateStatus('❌ Copy failed - please try again', 'error');
    }
    
    document.body.removeChild(textarea);
}

function saveAsMergedPersona() {
    if (!prunedExchanges || prunedExchanges.length === 0) {
        updateStatus('⚠️ No exchanges to save', 'warning');
        return;
    }
    
    // Filter only selected exchanges
    const selectedExchanges = prunedExchanges.filter(ex => ex.selected !== false);
    
    if (selectedExchanges.length === 0) {
        updateStatus('⚠️ No exchanges selected', 'warning');
        return;
    }
    
    // Prompt for persona name
    const personaName = prompt('Enter a name for this merged persona:', `Merged Persona ${Date.now()}`);
    
    if (!personaName || !personaName.trim()) {
        updateStatus('❌ Save cancelled', 'info');
        return;
    }
    
    // Create new persona from selected exchanges
    const newPersona = {
        id: `persona-${Date.now()}`,
        name: personaName.trim(),
        platformId: 'merged',
        platformName: 'Merged Context',
        url: '',
        timestamp: Date.now(),
        exchanges: selectedExchanges.map(ex => ({
            user: ex.user || '',
            assistant: ex.assistant || '',
            timestamp: ex.timestamp || Date.now()
        })),
        exchangeCount: selectedExchanges.length
    };
    
    // Add to stored personas
    storedPersonas.push(newPersona);
    
    Storage.set({ [STORED_PERSONAS_KEY]: storedPersonas }, () => {
        renderPersonaLibrary(storedPersonas);
        updateStatus(`✅ Saved "${personaName}" as persona (${selectedExchanges.length} exchanges)`, 'success');
    });
}


// --- Storage Management Helper (accessible from console) ---
window.crystalizerResetStorage = function() {
    console.log('[Crystalizer] Clearing all storage...');
    chrome.storage.local.clear(() => {
        console.log('[Crystalizer] Storage cleared! Reloading extension...');
        alert('✅ Crystalizer storage cleared! The extension will reload now.');
        window.location.reload();
    });
};

window.crystalizerDebug = function() {
    console.log('=== CRYSTALIZER DEBUG INFO ===');
    console.log('Current Step:', currentStep);
    console.log('Stored Personas:', storedPersonas);
    console.log('Merge Queue:', mergeQueue);
    console.log('Merged Exchanges:', mergedExchanges.length);
    console.log('Pruned Exchanges:', prunedExchanges.length);
    
    chrome.storage.local.get(null, (result) => {
        console.log('Storage Contents:', result);
    });
};

// --- Initialize when the DOM is ready ---
document.addEventListener('DOMContentLoaded', loadAppState);
