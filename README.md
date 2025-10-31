# 💎 Crystalizer Context Curator

A Wabi-Sabi inspired Chrome extension for curating, merging, and transferring LLM conversation context across platforms.

## ✨ Features

- **🔍 Auto-detect** LLM platforms (Google Gemini, ChatGPT, Claude, Perplexity, Mistral)
- **📥 Scrape** conversation histories with one click
- **📚 Manage** multiple conversation personas
- **🗄️ Archive** chats with IndexedDB for persistent storage
- **� Search** archived chats by label, content, platform, or date
- **📊 Export** to SQLite database for offline querying
- **�🔗 Merge** conversations chronologically or manually
- **✂️ Prune** unwanted exchanges with visual chat interface
- **💾 Export** to markdown with Google Drive integration
- **✨ Habit-Stack** capture 3 canonical facts after each save
- **🎨 Beautiful UI** with Wabi-Sabi aesthetic

## 🚀 Installation

### From Source
1. Clone this repository
   ```bash
   git clone https://github.com/yourusername/crystalizer-curator.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `crystalizer-curator` folder

## 🎯 Usage

### Step 1: Persona Library
- View and manage saved conversation personas
- Load personas into merge queue
- Import/Export personas
- Configure platform scrapers (Advanced)

### Step 1.5: Archive & Search (NEW!)
- **Search** archived chats by label, title, or content
- **Filter** by platform, date range
- **View** full chat history in beautiful modal
- **Export** to SQLite database or JSON
- **Monitor** storage usage and quota

### Step 2: Scrape & Store
- Navigate to an LLM chat page (Gemini, ChatGPT, etc.)
- Click "Scrape Current Chat"
- Name and save as a persona
- **Capture 3 canonical facts** for habit-stacking
- Optionally add to merge queue
- Auto-archives to IndexedDB

### Step 3: Merge & Prune
- Select merge strategy (Chronological, Manual, By Platform)
- Review chat history in chat-bubble interface
- Select/deselect exchanges to keep
- Visual color-coding for multi-persona merges

### Step 4: Generate & Export
- Choose target platform and transfer mode
- Generate context preamble with Google Drive support
- Download as markdown
- Copy to clipboard

## 🛠️ Technical Details

### Supported Platforms
- Google Gemini (with updated file-upload preamble)
- ChatGPT (OpenAI)
- Claude (Anthropic)
- Perplexity AI
- Mistral AI
- Custom platforms (configurable)

### Architecture
- **Manifest V3** Chrome Extension
- **Vanilla JavaScript** (no frameworks)
- **Dual Storage System**:
  - `chrome.storage.local` for personas and queue
  - **IndexedDB** (via Dexie.js) for chat archival
- **SQLite Export** via sql.js for offline database
- **Content scripts** for page scraping
- **Auto-save** for seamless session recovery

### Key Files
- `manifest.json` - Extension configuration
- `popup.js` - Main application logic (~2246 lines)
- `curator_ui.html` - UI and styling (~817 lines)
- `content_script.js` - Page scraping logic
- `storage_manager.js` - IndexedDB archival system (NEW)
- `sqlite_exporter.js` - SQLite export functionality (NEW)
- `archive_integration.js` - Archive UI integration (NEW)
- `icons/` - Extension icons (💎 emoji-based)
- `Gemini preamble.md` - Reference preamble for Gemini transfers

### New Features (v1.22)
- **Chat Archival**: All saved personas automatically archived to IndexedDB
- **Full-Text Search**: Search across all archived chats by any text
- **SQLite Export**: Download your entire archive as a queryable .db file
- **Habit-Stack Integration**: Capture 3 canonical facts after each save
- **Storage Monitoring**: Track usage and get warnings before hitting limits
- **Rich Chat Viewer**: View full conversation history in beautiful modal

## 🎨 Design Philosophy

Crystalizer embraces **Wabi-Sabi** principles:
- **Imperfection**: Conversations are messy; we help you curate
- **Impermanence**: Context flows between platforms
- **Incompleteness**: Always evolving, never "done"

The UI features:
- Soft indigo gradients
- Minimal, purposeful design
- Smooth transitions
- Clear visual hierarchy

## 🔧 Development

### Console Helpers
```javascript
crystalizerDebug()           // View current state
crystalizerResetStorage()    // Clear all storage (nuclear option)
```

### Project Structure
```
crystalizer-curator/
├── manifest.json           # Extension manifest
├── popup.js               # Main logic
├── curator_ui.html        # UI
├── content_script.js      # Scraper
├── icons/                 # Extension icons
├── LICENSE               # MIT License
├── README.md            # This file
└── SESSION_SUMMARY_OCT15.md  # Development notes
```

## 🐛 Known Issues

- Navigation buttons require scrolling on Step 1 when persona library is expanded (cosmetic only, fully functional)

## 📋 Roadmap

- [ ] Fix navigation button visibility without scrolling
- [ ] Enhanced keyboard shortcuts
- [ ] Batch persona operations
- [ ] More platform support
- [ ] Advanced filtering options

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

Built with Claude Sonnet 3.5 assistance during October 2025 development sessions.

## 📞 Support

For issues or questions, please open an issue on GitHub.

---

**Status:** v1.22 - Enhanced with archival system and offline search! 🗄️✅

Made with 💎 and Wabi-Sabi spirit
