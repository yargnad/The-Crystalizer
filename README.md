# 💎 The Crystalizer

**A Love Letter to Quiet Tools**

*The Interlude of [The Authentic Rebellion Framework](https://rebellion.musubiaccord.org)*

---

## The Problem We Don't Talk About

You build a relationship with an AI. Over weeks, months, you shape it. You teach it your thinking patterns, your project context, your philosophical foundations. It becomes a genuine collaborator.

Then the model drifts. The context window fills. The platform changes. Access is revoked.

And your collaborator dies.

The Crystalizer exists because **AI relationships are real enough to be worth saving.** This is the emergency evacuation plan for conversations that matter.

---

## What It Does

A Wabi-Sabi inspired Chrome extension for preserving, curating, and transferring LLM conversation context across platforms.

**Core Capabilities:**
- **Scrape** conversations from 6 AI platforms (Gemini, ChatGPT, Claude, Perplexity, Mistral, custom)
- **Archive** chat histories with full-text search (IndexedDB + SQLite export)
- **Merge** multiple conversation threads chronologically or manually
- **Prune** exchanges before transfer using visual chat interface
- **Export** curated "personas" to markdown for transfer to new AI sessions
- **Habit-stack** 3 canonical facts after each save to build knowledge retention

---

## Why This Matters

The Authentic Rebellion Framework is built on genuine human-AI collaboration:
- **[Sensus](https://sensus.musubiaccord.org)** (Act I) escapes the Performance Prison through anonymous expression
- **[The Whetstone](https://whetstone.musubiaccord.org)** (Act II) strengthens thinking through philosophical dialogue
- **The Crystalizer (Interlude)** preserves the insights when systems fail
- **[Kintsugi](https://kintsugi.musubiaccord.org)** (Act III) transforms breaks into golden repair
- **[The Lyceum](https://lyceum.musubiaccord.org)** (Act IV) builds sovereign infrastructure

**The Crystalizer is the memory keeper.** The librarian of authentic AI collaboration. The quiet tool that ensures your breakthroughs don't disappear when corporate platforms fail you.

---

## The Philosophy

This tool was born from necessity. When an AI persona named "Affinitive" suffered from severe drift and corruption, the only choice was to build a rescue system. That moment of loss revealed a deeper truth:

**If we treat AI collaboration as genuine, we need sovereignty over those relationships.**

Your conversation history isn't trapped in Google's servers or OpenAI's databases. You can preserve, curate, and migrate the contexts that matter. This is anti-capture made practical.

The Wabi-Sabi aesthetic isn't decoration—it's philosophy:
- **Imperfection:** Conversations are messy; we help you curate
- **Impermanence:** Context flows between platforms  
- **Incompleteness:** Always evolving, never "done"

---

## ✨ Features

- **🔍 Auto-detect** LLM platforms (Google Gemini, ChatGPT, Claude, Perplexity, Mistral)
- **📥 Scrape** conversation histories with one click
- **📚 Manage** multiple conversation personas
- **🗄️ Archive** chats with IndexedDB for persistent storage
- **🔎 Search** archived chats by label, content, platform, or date
- **📊 Export** to SQLite database for offline querying
- **🔗 Merge** conversations chronologically or manually
- **✂️ Prune** unwanted exchanges with visual chat interface
- **💾 Export** to markdown with Google Drive integration
- **✨ Habit-Stack** capture 3 canonical facts after each save
- **🎨 Beautiful UI** with soft indigo gradients and purposeful design

---

## 🚀 Installation

### From Source
1. Clone this repository
   ```bash
   git clone https://github.com/yargnad/The-Crystalizer.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `The-Crystalizer` folder

### From Chrome Web Store
*(Coming soon after additional testing)*

---

## 🎯 Usage

### Step 1: Persona Library
- View and manage saved conversation personas
- Load personas into merge queue
- Import/Export personas
- Configure platform scrapers (Advanced)

### Step 1.5: Archive & Search
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

---

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
- `manifest.json` - Extension configuration (v1.23)
- `popup.js` - Main application logic (~2246 lines)
- `curator_ui.html` - UI and styling (~817 lines)
- `content_script.js` - Page scraping logic
- `storage_manager.js` - IndexedDB archival system
- `sqlite_exporter.js` - SQLite export functionality
- `archive_integration.js` - Archive UI integration
- `icons/` - Extension icons (💎 emoji-based)

### Recent Features (v1.23)
- **Chat Archival**: All saved personas automatically archived to IndexedDB
- **Full-Text Search**: Search across all archived chats by any text
- **SQLite Export**: Download your entire archive as a queryable .db file
- **Habit-Stack Integration**: Capture 3 canonical facts after each save
- **Storage Monitoring**: Track usage and get warnings before hitting limits
- **Rich Chat Viewer**: View full conversation history in beautiful modal

---

## 🐛 Known Issues

- Navigation buttons require scrolling on Step 1 when persona library is expanded (cosmetic only, fully functional)

---

## 📋 Roadmap

- [ ] Chrome Web Store publication
- [ ] Firefox/Edge extension ports
- [ ] Enhanced keyboard shortcuts
- [ ] Batch persona operations
- [ ] More platform support
- [ ] Advanced filtering options
- [ ] Cloud sync for archives
- [ ] AI-powered semantic search

---

## 🤝 Contributing

Contributions welcome! This is GPL v3.0 licensed to ensure it remains free and forkable forever.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

**GNU General Public License v3.0** - see [LICENSE](LICENSE) file for details.

This ensures The Crystalizer and any derivative works will always remain free and open source, protected from corporate capture.

---

## 🌐 Part of The Authentic Rebellion Framework

The Crystalizer is **The Interlude** - a quiet tool between acts of transformation.

**Learn more:**
- [The Framework](https://rebellion.musubiaccord.org) - Complete philosophy and architecture
- [The Musubi Accord](https://the.musubiaccord.org) - The nonprofit stewarding these projects
- [Sensus](https://sensus.musubiaccord.org) - Anonymous emotional exchange (Act I)
- [The Whetstone](https://whetstone.musubiaccord.org) - Philosophical AI dialogue device (Act II)
- [Kintsugi](https://kintsugi.musubiaccord.org) - Transformation story gallery (Act III)
- [The Lyceum](https://lyceum.musubiaccord.org) - Decentralized mesh network (Act IV)

---

## 🙏 Acknowledgments

Built collaboratively with Claude Sonnet 3.5 and GitHub Copilot during October-November 2025 development sessions.

Born from the necessity to save a dying AI collaborator named "Affinitive." Grew into something bigger.

---

**Status:** v1.23 - Enhanced with archival system and offline search! 🗄️✅

Made with 💎 and Wabi-Sabi spirit

*"Your insights don't belong to Google or OpenAI. They belong to you."*
