# Elementor Studio

A full-stack agency tool that converts any website into an Elementor/WordPress site and manages client edits via AI chat. Built with Node.js, React, Playwright, and Anthropic Claude.

## What It Does

1. **Website Conversion** — Paste any URL (Divi, Webflow, Squarespace, Wix, plain HTML) and get a pixel-perfect Elementor page using native Flexbox Containers and widgets
2. **AI Chat Editing** — Click on any client and chat to edit their site in real time ("Change the phone number", "Make the header blue", "Add a testimonial section")
3. **Client Portal** — White-labeled portal where clients can self-serve edits without knowing HTML
4. **Kinsta Deployment** — One-click deploy to Kinsta-hosted WordPress sites
5. **Native Elementor Output** — Everything is built with Elementor containers and widgets, fully editable in Elementor's visual editor

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Frontend | React (Vite) + Framer Motion |
| Scraping | Playwright (with Cheerio fallback) |
| AI | Anthropic Claude API |
| CMS | WordPress REST API + Elementor |
| Hosting | Kinsta API |
| Database | SQLite (better-sqlite3) |

## Quick Start

### 1. Clone and install

```bash
cd elementor-studio
cp .env.example .env
# Edit .env with your API keys

cd backend && npm install
cd ../frontend && npm install
```

### 2. Install Playwright browsers

```bash
cd backend
npx playwright install chromium
```

### 3. Configure .env

```env
ANTHROPIC_API_KEY=sk-ant-...        # Required for AI conversion & editing
KINSTA_API_KEY=...                   # Optional: for Kinsta hosting
KINSTA_COMPANY_ID=...                # Optional: for Kinsta hosting
AGENCY_NAME=Your Agency Name         # Shown in client portal
PORT=3000
```

### 4. Start the backend

```bash
cd backend
npm run dev
```

### 5. Start the frontend (dev mode)

```bash
cd frontend
npm run dev
```

Open http://localhost:5173

### 6. Build for production

```bash
cd frontend && npm run build
cd ../backend && npm start
```

Open http://localhost:3000

## How to Convert a Website

1. Open the Dashboard
2. Paste the URL into the import bar or go to Import
3. Select the source type (Divi, Webflow, etc.)
4. Select or create a client
5. Click "Start Conversion"
6. The system will:
   - Scrape the website (Playwright or HTTP fallback)
   - Analyze layout, colors, fonts, images
   - Convert to native Elementor containers and widgets via Claude AI
   - Deploy to WordPress (if credentials configured)

## How to Edit via Chat

1. Click on any client card from the Dashboard
2. The Editor opens with chat on the left, preview on the right
3. Type what you want changed in plain English:
   - "Change the headline to Welcome Home"
   - "Make the hero background dark blue"
   - "Update the phone number to 555-1234"
   - "Add a new Services section"
   - "Make the button red"
4. The AI processes the change, updates the Elementor JSON, and pushes to WordPress

## Elementor Container Output

All output uses Elementor's modern **Flexbox Container** system (not the legacy section/column system):

- `elType: "container"` instead of `section` or `column`
- `flex_direction`, `flex_gap`, `flex_align_items` for layout
- Every piece of content is a native widget (heading, text-editor, button, image, etc.)
- No raw HTML widgets — everything is editable in Elementor's visual editor
- Responsive settings via `_tablet` and `_mobile` suffixes

## WordPress Setup

For each client, configure:

1. **WordPress URL** — The site URL (e.g., `https://client.kinsta.cloud`)
2. **WP User** — A WordPress admin username
3. **Application Password** — Go to WP Admin > Users > Profile > Application Passwords

Required plugins:
- Elementor (free)
- Elementor Pro (for nav-menu, forms, etc.)
- Hello Elementor theme (recommended)

## Client Portal

The `/portal` routes serve a white-labeled client interface:

- No mention of AI, Claude, or Anthropic
- Clients log in with username/password
- They only see their own sites
- Chat interface looks like a normal "website editor assistant"
- Suggested prompts for common edits

Create portal users via the API:
```bash
POST /api/clients/:id/portal-user
{ "username": "john", "password": "secret", "display_name": "John" }
```

## API Routes

| Route | Description |
|-------|-------------|
| `POST /api/convert` | Start a website conversion |
| `GET /api/convert/:id/status` | Check conversion progress |
| `GET /api/clients` | List all clients |
| `POST /api/clients` | Create a client |
| `POST /api/editor/message` | Send a chat edit message |
| `GET /api/editor/history/:clientId` | Get chat history |
| `GET /api/kinsta/sites` | List Kinsta sites |
| `POST /api/elementor/page/:id/deploy` | Deploy page to WordPress |

## Project Structure

```
elementor-studio/
├── backend/
│   ├── server.js              # Express + WebSocket server
│   ├── routes/
│   │   ├── convert.js         # Website conversion pipeline
│   │   ├── clients.js         # Client CRUD
│   │   ├── editor.js          # AI chat editing
│   │   ├── kinsta.js          # Kinsta API wrapper
│   │   ├── elementor.js       # Elementor JSON management
│   │   └── portal.js          # White-labeled client portal
│   ├── services/
│   │   ├── scraper.js         # Playwright + Cheerio scraping
│   │   ├── analyzer.js        # Claude AI analysis & editing
│   │   ├── converter.js       # Elementor Container JSON builder
│   │   ├── deployer.js        # WordPress REST API deployer
│   │   ├── kinsta-service.js  # Kinsta API service
│   │   └── watcher.js         # Site change watcher
│   └── db/
│       └── schema.js          # SQLite schema
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── views/
│   │   │   ├── Dashboard.jsx  # Client grid + import bar
│   │   │   ├── Editor.jsx     # Chat + preview split view
│   │   │   ├── Import.jsx     # Step-by-step import wizard
│   │   │   └── Settings.jsx   # API keys & agency config
│   │   └── components/
│   │       ├── Sidebar.jsx    # Left navigation
│   │       ├── ClientFolder.jsx
│   │       ├── ChatPanel.jsx  # Chat interface
│   │       └── PreviewPanel.jsx
└── .env.example
```
