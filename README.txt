FLOW MONEY MANAGER — OFFLINE STATIC EDITION

Open flow-money-manager-offline.html or index.html directly in your browser. No server, internet, installation, or external dependencies are needed.

Project structure:
- flow-money-manager-offline.html: app shell that links the modular assets
- index.html: same app shell, convenient default entry point
- assets/css/styles.css: all styling
- assets/js/storage.js: IndexedDB persistence helpers
- assets/js/state.js: shared state, constants, and formatting helpers
- assets/js/views.js: page rendering and navigation
- assets/js/modals.js: account, transaction, category, budget, recurring, and settings dialogs
- assets/js/app.js: app startup

Data is saved using browser IndexedDB when supported for local file:// pages. Some browsers restrict IndexedDB on file:// or may treat local files as separate origins. In those browsers, persistent storage cannot be guaranteed when opening an HTML file directly. Use JSON export regularly, especially before moving or renaming the file.

No PIN encryption is implemented in this version. Multi-currency totals use illustrative built-in rates, not live exchange rates.
