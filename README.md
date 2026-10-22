# Flow Money Manager

> A modern, blue-themed, mobile-first, offline personal finance application built with HTML, CSS, vanilla JavaScript and IndexedDB.

**Project status:** Active development
**Specification version:** 1.0
**App version:** maintained in `APP_VERSION` at the top of `assets/js/state.js`; Settings reads this constant.
**Last specification update:** 2026-10-22
**Implementation status:** Not audited against the current local repository. Feature descriptions below are requirements, not assertions that the feature works.

## Table of contents

1. [Vision and scope](#vision-and-scope)
2. [Core user journey](#core-user-journey)
3. [Navigation and design](#navigation-and-design)
4. [Functional requirements](#functional-requirements)
5. [Financial business rules](#financial-business-rules)
6. [Data model](#data-model)
7. [Technical architecture](#technical-architecture)
8. [Privacy, security and backups](#privacy-security-and-backups)
9. [Non-goals](#non-goals)
10. [Development roadmap and feature tracker](#development-roadmap-and-feature-tracker)
11. [Acceptance criteria and test scenarios](#acceptance-criteria-and-test-scenarios)
12. [Agent documentation workflow](#agent-documentation-workflow)
13. [Decisions and open questions](#decisions-and-open-questions)
14. [Change log](#change-log)

## Vision and scope

Flow Money Manager is an original personal finance app inspired by the functionality of Realbyte Money Manager, not a reproduction of its proprietary assets or interface. It helps one user track financial accounts, income, expenses, transfers, budgets, recurring activity and statistics. The app must run locally without a backend, user registration, subscription or runtime internet connection.

**Principles:** financial correctness; user-owned data; dependable offline behavior; excellent mobile usability; clear reporting; small, reviewable changes.

**First-run state:** no accounts, transactions, balances or budgets. Optional starter categories are acceptable. No demo financial data.

## Core user journey

1. Open `index.html` directly in a supported browser.
2. Choose a base reporting currency (EUR by default).
3. Create one or more accounts with native currencies and opening balances.
4. Record income, expenses and transfers; optionally split income or expenses across categories.
5. Review account balances, transaction history and calendar.
6. Set independent monthly overall and category budgets.
7. Inspect charts and filter by date, account, category and currency.
8. Configure recurring entries and optionally a PIN lock.
9. Export a JSON backup or CSV file; restore/import with validation.

## Navigation and design

### Main navigation

| Tab          | Purpose                                                                                 |
| ------------ | --------------------------------------------------------------------------------------- |
| Home         | Balance overview, monthly cash flow, quick actions, spending chart, recent transactions |
| Transactions | Add/edit/delete, chronological history, calendar, search and filters                    |
| Statistics   | Spending distribution, income/expense comparisons, trends and reports                   |
| Accounts     | Balances, account creation/editing, archiving and restoration                           |
| More         | Categories, budgets, recurring rules, currencies, security, import/export, settings     |

### Visual direction

- **Light mode only**; premium blue-and-white visual identity.
- White and pale blue/gray surfaces, clear typography, restrained shadows, rounded cards and controls.
- Mobile-first, optimized for iPhone; fixed bottom navigation on mobile and optional sidebar on desktop.
- Touch-friendly targets, aligned forms, consistent spacing, responsive modals, accessible labels, clear empty/error/loading states.
- Double-tap zoom is disabled throughout the app with `touch-action: manipulation`, allowing rapid taps on period arrows while retaining scrolling and pinch-to-zoom. Physical iPhone gesture verification is pending.
- Settings exchange-rate inputs use 16px text to prevent iPhone focus zoom. On touch devices, dialogs initially focus Close so opening a form does not activate a keyboard or native picker; desktop dialogs retain first-field/action focus. Tapping an editable field still opens its keyboard normally. Physical iPhone verification is pending.
- Never reintroduce the earlier orange theme or add dark mode without approval.

## Functional requirements

> **Status legend:** `Planned` = agreed requirement, not yet verified as implemented; `In progress` = actively being built; `Implemented` = confirmed in source and tested; `Blocked` = cannot proceed yet. See the feature tracker for the current status. This section describes intended behavior.

### Home dashboard

- Default filter: **All Accounts**; optionally select a single account.
- Current combined balance of active accounts in base reporting currency (EUR default).
- The Home card’s Show/Hide button controls balance visibility, saved as the boolean `hideTotalBalance` in IndexedDB Settings (default false), including when filtering to an individual account. Other financial amounts remain visible. This is display privacy, not encryption; stored/exported data and calculations are unchanged and full JSON backups include the preference.
- Monthly income, expenses and net cash flow (`income − expenses`).
- Quick actions for income, expense and transfer.
- Spending-by-category donut chart and recent transactions.
- Month navigation for historical income/expense activity.
- **Important:** current account balance is not the same as income/expenses for the selected month.
- Individual-account views display amounts in that account's native currency.

### Accounts

Supported types: cash, bank, savings, investment, loan and custom. **Credit cards are excluded.**

Account fields: unique ID, name, type, native currency, opening balance, optional description, icon/color, archived flag, visibility (`visible`, default true), sort order, created/updated timestamps.

- Create, edit, list, archive and restore accounts.
- Archived accounts appear in a collapsible section with an account count, closed by default. Its blue outlined header places a rotating chevron beside the label and shows “Tap to expand” / “Tap to collapse” hints, with hover and keyboard-focus feedback. Tap/click its heading (or use Enter/Space when focused) to expand/collapse it. Expansion survives Manage/Done and account updates while on Accounts and resets when leaving the page or reloading. Expand and enable Manage to access archived editing, sorting and Restore controls. The section is omitted when no accounts are archived.
- Accounts open in a clean viewing mode with balances inline beside each account name, including on mobile. The top Manage button switches to management mode, revealing account/type sorting, visibility, editing and Archive/Restore controls; Done hides them. Add account is always visible in both modes, including an empty list. Hidden/Archived badges remain visible in viewing mode. Management mode survives account changes while on Accounts and resets when leaving the page or reopening the app; it is not stored in backups.
- Active accounts have configurable visibility. Archived accounts are always hidden: their visibility checkbox is disabled and archived rows omit both the Hidden badge and eye button. Restoring an account automatically sets it visible, even if it was hidden before archiving. Older/imported archived accounts are treated as hidden regardless of a missing or conflicting `visible` value. Uncheck “Visible in account selectors” in the account create/edit form to hide it from transaction source/destination buttons, account filter dropdowns and new recurring-schedule account selectors. Accounts without a `visible` field remain visible.
- Hidden accounts remain listed on Accounts with a compact Hidden badge and crossed-out eye indicator and remain included in active balances, transaction history/search, statistics, budgets and complete JSON backups. Existing recurring rules continue normally. Recheck the visibility option to show the account again. Each account row also has an eye button immediately before Archive/Restore: click to toggle visibility without confirmation. An eye means visible; a crossed-out eye means hidden. Both controls use the same saved visibility property; archived accounts cannot change visibility until restored.
- Editing or copying a transaction retains its assigned hidden account in the collapsed field without offering that account among selectable buttons. If every active account is hidden, new transaction/schedule creation explains that an account must be made visible. A filter pointing at an account that becomes hidden resets to All accounts.
- Visibility adds an optional account property; no IndexedDB version change or destructive migration is required.
- Accounts are grouped by account type and can be reordered within each type group. Group headers also have up/down controls to reorder account types. Type order is shared by active and archived sections, saved in the `accountTypeOrder` setting and preserved by complete JSON backups. Moves swap with the neighboring displayed group; boundary controls are disabled. Individual accounts also disable Move up on the first row and Move down on the last row within each active/archived type group; single-account groups disable both. Account pickers, dropdowns and account summaries use the same type order first, then saved account `sortOrder` within each type, with alphabetical ties. Accounts without a saved `sortOrder` follow ordered accounts within their type. Without a saved type order, the existing Cash, Bank, Savings, Investment, Loan, Other order is used; new/custom types follow deterministically.
- An archived account is not available for new ordinary transactions and is excluded from the current _active-account_ total by default; historical transactions and reports remain available.
- Prevent unsafe deletion of accounts referenced by transactions.
- Account balance is derived from opening balance and transaction ledger; **no manual balance adjustment feature**.
- Investment accounts initially record manual cash flows, not live market values.
- Loan-account sign convention and repayment behavior must be defined before implementing specialized loan calculations (see open questions).

### Transactions

Three types:

| Type     | Effect                                                                                     |
| -------- | ------------------------------------------------------------------------------------------ |
| Income   | Increase selected account balance; count toward income reporting                           |
| Expense  | Decrease selected account balance; count toward expense reporting and relevant budgets     |
| Transfer | Decrease source and increase destination; exclude from ordinary income/expense and budgets |

Core fields: ID, type, amount, date, time, source account, optional destination account and received amount, category/subcategory where applicable, payee, description, optional attachment references, created/updated timestamps.

- Create, edit, delete, list, search, filter and inspect transaction details.
- Transaction category fields use the same inline expand/select/collapse flow as account selection, including split rows. Categories appear as separate buttons in saved order; a separate chevron expands a category’s ordered subcategories without selecting it. Expanding a category closes any other expanded category within that picker; clicking the open category’s chevron closes it. Split-row pickers operate independently. In split rows, the category and amount fields stay side by side while expanded category choices span the full row underneath both fields. Every expanded parent category spans the full picker width. Multiple subcategories wrap into a responsive grid; a single subcategory stays compact (130px maximum available width) and left-aligned underneath the full-width parent. Parent categories remain selectable. The collapsed field displays Category / Subcategory when applicable; selecting returns keyboard focus to the field and Escape closes the picker. Existing selections initialize correctly when editing/copying; empty category lists explain where to create categories. Save validation checks transaction type and parent/subcategory relationships.
- Transaction account selectors initially show only the selected account name in a compact field; currency remains visible on the expanded account buttons. Tapping the field expands compact square buttons (72px minimum, 6px grid spacing) listing all active accounts in the configured order, with account name, currency and a blue selected state. Selecting an account updates the field, collapses the buttons and returns focus to the field. Reopen it to change the selection; Escape within the buttons collapses the picker. Account fields share the standard selectors’ SVG arrow and the normal fields’ blue focus border and soft shadow, including while expanded. Both source and transfer destination use the same picker; buttons support keyboard focus and expose selection with `aria-pressed`. Archived accounts remain excluded.
- Transaction forms show Date & time first, then Amount, followed by Account. They use one native “Date & time” (`datetime-local`) input, initialized from the saved local date/time or the current local date/time for new records. Copy options retain their original/current date-time behavior.
- Saving validates the local calendar date and time, then stores the existing separate `date` and `time` properties without timezone conversion or schema changes. Native picker appearance varies by browser; recurring schedule fields remain separate.
- Transfers retain an optional Payee (for example, a currency exchange store). Transaction list titles show Payee or “Transfer” when blank; details show Source account → Destination account, followed by date/time. Legacy `place` values remain supported. This applies to history and dashboard recent transactions without rewriting stored records.
- Payee inputs should suggest previously used payees as the user types using an app-rendered suggestion list that works in mobile Safari.
- Display all full dates as `dd.mm.yyyy`, including transaction rows, weekly range labels, recurring next-date labels and currency sync status. Sync timestamps use local 24-hour `HH:mm:ss` time; source date ranges are formatted without timezone conversion using the shared `displayDate` helper. Native date/date-time picker appearance follows browser/OS locale; stored dates and CSV/JSON dates remain ISO `yyyy-mm-dd` for reliable sorting and interchange. Month/year headings retain their existing labels.
- Support daily/calendar, weekly, monthly and chronological review. Transaction lists are newest first across every period and text/account/category filter: local date descending, then local time descending (missing time treated as midnight), then creation timestamp and ID for stable ties. Dashboard recent transactions use the same order. Unfiltered All history retains its latest-250 display limit after sorting.
- Filter by date range, account, type, category/subcategory and search text. The Type dropdown supports All types, Income, Expenses and Transfers. Select Transfers + All history + All accounts with an empty text search to review every recorded transfer, newest first, without the unfiltered-history 250-row cap. Transfer mode hides/ignores category filters; selecting it clears category selections. Clear search resets Type to All types. Existing Payee/Description values remain untouched for manual review/editing. Transaction search starts at 2 characters and resets when the search field is blank. Category search supports selecting multiple category badges at once; income and expense groups are collapsed by default, selecting a parent category includes all of its subcategories and expandable categories allow selecting only specific subcategories. Search period navigation changes with the selected period: monthly, weekly, yearly or no navigator for all history.
- Validate positive amounts, valid account/category references, dates and transfer endpoints.
- Changes must consistently update all dependent balances, charts and budgets.
- Deletions must be intentional and confirmable.

#### Split transactions

- Allow income and expense transactions to contain multiple category allocations.
- Each split has a category, optional subcategory, amount and optional description.
- Enabling splits hides and disables the main category field; only individual split categories are used. Disabling splits restores the main field and its prior selection. Editing/copying split transactions starts with the main field hidden.
- Split transaction records retain `categoryId: null` and `subcategoryId: null` at the parent level. The existing schema already supports this, so no database migration or rewriting existing records is required.
- Split transactions use a branching icon representing one amount divided into categories and show a clickable purple Split badge alongside the blue Note badge when present. It expands a breakdown below the transaction details, with one line per category/subcategory and its amount in the account’s native currency. Clicking again collapses it; the dashboard and transaction history share this behavior.
- Sum of split amounts **must exactly equal** the parent transaction amount.
- The account ledger records the parent total once; category reports and budgets use split allocations.
- Transfers cannot be split.

### Multi-currency

- **Currency synchronization:** Settings & backup has Sync now plus Sync rates when the app opens (enabled by default). Startup synchronization runs after the local app loads and does not block opening the app. Disabling startup sync leaves manual Sync now available.
- The app requests the complete public EUR reference-rate list from [ExchangeRate.fun](https://exchangerate.fun/docs/) at `https://api.exchangerate.fun/latest?base=eur`, the same fixed URL for every user. Requests omit credentials and referrers. No account names, amounts, transactions, notes or selected currency codes are sent. The service still sees the device's IP address and connection information.
- A validated response, provider identity and source timestamp/date are cached in the `currencySync` IndexedDB setting. Settings shows the last successful sync time and source date range in the small muted hint beneath the startup toggle. The API response supplies a shared source timestamp; its date is shown as Rate date in `dd.mm.yyyy` format. Older backups can still display their original source date ranges. These are reference rates rather than guaranteed execution quotes.
- Synchronization updates only enabled currencies and preserves manual overrides. Existing saved rates are treated as manual overrides on upgrade. Use synced rates switches supported enabled currencies to automatic updates; unsupported manual currencies remain unchanged. Editing a rate creates a manual override. Add currency can use a cached rate when its rate field is blank.
- The full cached list does not populate selectors automatically: fresh starts still offer only EUR and USD. All sync settings and cached rates are included in full JSON backups. Reset all data clears them and cancels an outstanding request; startup sync defaults to enabled on the next open.
- Requests time out after 12 seconds. Offline, HTTP, malformed-response and storage failures retain previous rates and show a retry message in Settings. Direct `file://` fetch behavior depends on browser CORS/security rules; manual rates remain available if the browser blocks the request.
- Existing transaction snapshots and transfer amounts are never rewritten by sync. New transactions and recurring occurrences use the rates available when they are recorded. Legacy records without snapshots retain their existing current-rate fallback. Recurring processing on startup runs before the background sync and therefore uses locally cached rates.

- Each account has one native currency; base reporting currency is configurable (EUR default).
- Currency selectors are built dynamically from local reference-rate codes, the reporting currency and all accounts, including archived accounts. Fresh installs and Reset all data start with only EUR and USD. Other currencies can be added in Settings. Existing saved rates and account currencies remain available; older accounts using GBP, CHF, MKD or SEK retain their previous fallback rates if no rate was saved.
- Settings & backup includes Add currency: enter a three-letter code and an explicit positive rate in units per 1 EUR. Codes are normalized to uppercase; malformed codes, duplicates and invalid rates are rejected. Codes are format-validated rather than checked against a live ISO registry. Added codes become available for new accounts and reporting.
- Reference rates and custom codes are saved together in the existing `exchangeRates` setting and included in full JSON backups. No schema migration is required; manual currency management works offline. There is no currency deletion action.
- Reset starter rates resets only EUR and USD while preserving other currencies and their rates. Save rates retains entered rate precision, including values smaller than one millionth.
- Changing the reporting currency is blocked when any existing transaction lacks a required historical rate for that target, including either side of a transfer. Existing snapshots are preserved rather than filled with fabricated historical rates. Legacy transactions without snapshots retain the existing configured-rate fallback.
- Currency-specific decimal precision remains planned: the current ledger and amount formatter use two decimal places for every currency. This limitation is shown beside Add currency.
- Same-currency transfers automatically receive the sent amount; no received-amount or exchange-rate input or conversion estimate is shown.
- Cross-currency transfers require a positive rate. Pairs involving the main currency quote 1 main-currency unit = X other units. For other pairs, the currency with the higher unit value (lower valid Settings rate per EUR) is quoted first: MKD ↔ USD uses 1 USD = X MKD in both directions. When reference rates are missing, existing transfers use their saved destination/source amount ratio to choose a readable quote. New transfers with missing rates start blank and use destination units per source unit until valid reference rates are configured. Quote direction is automatic; there is no manual reversal control. No missing reference rate is invented. Editing rate or received amount does not change the automatically determined quote direction.
- Every cross-currency transfer has editable rate and received fields. When quoting destination currency first, received = sent ÷ rate and rate = sent ÷ received; otherwise received = sent × rate and rate = received ÷ sent. Generated rate text uses up to 10 significant digits without scientific notation; manually entered precision is retained. Received amounts use two decimal places. Existing saved received amounts are preserved when opening/editing/copying and the stored `transferRate` remains received ÷ sent, independent of display orientation. Reporting snapshots are separate.
- Editing or copying an existing cross-currency transfer initializes the rate from its stored received/source amounts, preserving historical amounts. New currency pairs prepopulate the editable rate from Settings when available; missing or invalid reference rates leave the field blank.
- Editing the sent amount retains the entered rate and recalculates the received amount.
- Transfers do not display a blue conversion/reporting note. Cross-currency exchange-rate and received-amount fields provide the calculation through two-way synchronization; same-currency transfers receive the sent amount automatically. Reporting rate snapshots remain stored for historical calculations.
- Transfer form changes require no database migration; existing records remain unchanged until explicitly edited and saved.
- Optional transfer fees remain planned.
- Manual exchange-rate entry remains available alongside optional online reference-rate synchronization. Never fabricate missing rates.
- Combined reporting uses a documented conversion policy; if a required rate is unavailable, show an explicit unavailable/incomplete state rather than an invented amount.
- Non-base-currency transaction forms show the estimated base-currency reporting value and include an editable transaction-level exchange rate initialized from Settings.
- Transactions keep an exchange-rate snapshot so historical reports do not silently change when Settings rates are updated later.
- All-accounts current balance estimates convert each active account's current native balance using the current configured rates in Settings.
- Historical transaction reports use transaction exchange-rate snapshots so old transaction values do not silently change when Settings rates are updated later.
- Settings show editable local reference rates for all available currencies and the conversion formula.
- Monetary UI values use one shared format: grouped number with two decimal places, followed by the uppercase currency code (for example, `1,234.50 EUR`, `10.00 MKD`). Symbols such as €/$ are not used for formatted amounts. Exchange-rate quotes retain their extra precision and use the same trailing currency-code convention. Stored amounts and CSV/JSON numerical values are unchanged.
- Preserve original values and historical conversion information.
- Use integer minor units where appropriate or an exact decimal strategy; avoid ordinary JS floating-point math for money.

### Categories and subcategories

- Unlimited custom income and expense categories and nested subcategories (one subcategory level initially).
- Custom names, icons, colors and ordering.
- Manage categories constrains its grid to the dialog width. On mobile, compact 30px category icons and 28px-wide sort/edit/delete buttons keep all four actions together on the right in the first row. The name column shrinks and wraps as needed; subcategory chips wrap within the dialog. Desktop sizing and layout are unchanged by these compact mobile styles.
- Moving a category up/down preserves the category dialog's scroll position and focuses the moved category's corresponding sort button without scrolling. Subcategory sorting retains its existing inline behavior.
- Optional editable starter categories; no seeded financial records.
- Prevent deletion or reassignment from silently corrupting historical records.

### Budgets

Budget lists show Overall first, then saved category order; category dropdowns use the same category ordering.

- Overall monthly expense budget and category-specific monthly budgets.
- Display spent, remaining, percentage used and overspending warning.
- Split expenses contribute to their corresponding category budgets.
- Transfers and income do not count as spending.
- **No carry-over:** unused budget and overspending do not affect the next month.
- Preserve previous months' budgets and actuals for comparison.

### Recurring transactions

Rules are listed by next date/time ascending, then label and ID, including paused rules. Category dropdowns follow saved category order.

- Recurring **income and expense** rules (not recurring transfers initially).
- Daily, weekly, monthly and yearly frequencies.
- Start date, optional end date, amount, account, category, active/paused state.
- When opened, process due occurrences deterministically, including missed dates, with duplicate prevention.
- Support pause, resume, edit and cancel; distinguish edits to one generated occurrence from future rule changes.
- No background processing while the HTML app is closed; reminders depend on browser support and are not promised.

### Statistics and reports

- Daily, weekly, monthly, yearly and custom date ranges.
- Donut chart for expense categories; drill down to subcategories.
- Bar charts comparing income and expenses across periods.
- Trend charts and account balance history.
- Budget progress and historical comparisons.
- Filter by account, category, period and reporting currency.
- Transfers excluded from ordinary income/expense summaries.
- No dedicated net-worth dashboard.

### Settings and personalization

- Base currency; display currency/number/date formatting.
- Category management, archived accounts, recurring rules, budgets.
- Optional app lock; backup and import/export tools.
- No theme selector: light mode only.

## Financial business rules

1. **Ledger correctness:** balance = opening balance + native-currency income − native-currency expenses + incoming transfers − outgoing transfers (with explicit fee treatment).
2. **No double counting:** transfers are internal movements, not income or spending; split allocations are not extra ledger movements.
3. **Precision:** never rely on binary floating-point arithmetic for exact money comparisons.
4. **Atomicity:** related IndexedDB writes must succeed or fail together where practical.
5. **Historical integrity:** account/category archiving must not erase historical reports.
6. **Cross-currency transparency:** preserve source and destination values and disclose missing conversion rates.
7. **Period correctness:** budgets are independent by calendar month; reports use consistent date/time boundaries.
8. **Correction behavior:** edit or reverse legitimate ledger entries rather than creating a manual balance-adjustment transaction.
9. **Data migration safety:** never reset or silently discard financial records during upgrades.
10. **Reporting clarity:** distinguish total assets/active balances, monthly cash flow and liabilities; do not sum debt as positive wealth without defined semantics.

## Data model

Proposed logical IndexedDB object stores (validate against actual implementation before modifying):

```text
accounts
  id, name, type, currency, openingBalance, archived, visible?,
  description, icon, color, createdAt, updatedAt
transactions
  id, type, amount, currency, date, time, accountId,
  destinationAccountId?, receivedAmount?, exchangeRate?, fee?,
  exchangeRateFrom?, exchangeRateTo?, exchangeRates?, categoryId?, subcategoryId?,
  payee?, description?, recurringRuleId?, occurrenceKey?, createdAt, updatedAt
transactionSplits
  id, transactionId, categoryId, subcategoryId?, amount, description?
categories
  id, name, type, icon, color, sortOrder, archived?,
  subcategories?: [{ id, name, icon, color?, sortOrder? }]
budgets
  id, categoryId?, year, month, limit, currency
recurringRules
  id, type, amount, accountId, categoryId?, frequency,
  startDate, endDate?, active, lastProcessedAt?
exchangeRates
  id, fromCurrency, toCurrency, rate, effectiveDate
attachments
  id, transactionId, blob, filename, mimeType
settings
  key, value
```

Schema details are illustrative, not authoritative. Prefer indexed lookups on dates, account IDs, category IDs and recurrence identifiers. Maintain a schema version and incremental, non-destructive migrations.

## Technical architecture

- HTML5, CSS3, vanilla JavaScript, IndexedDB.
- No framework, bundler, backend or external CDN. Core financial features have no runtime network dependency; optional currency synchronization uses a public HTTPS API.
- Optional **development-only** formatting via Prettier (`npm install` then `npm run format`). This does not affect opening `index.html` directly and is not required to run the app.
- `index.html` is the sole application entry page and must be **directly openable**, without a local HTTP server.
- For `file://` compatibility, avoid ES module imports; use classic scripts in a documented dependency order.
- Separate database operations, financial domain logic, UI rendering and event handling into maintainable files.
- Keep all assets local. The only runtime network request is optional currency-rate synchronization.
- **Browser limitation:** `file://` origin behavior and IndexedDB persistence vary across browsers; detect failures and never claim guaranteed persistence without testing the target browser.
- A successful save must mean data was committed to durable browser storage, not just added to an in-memory array.

Suggested organization (adapt to the actual repository):

```text
index.html
css/
  variables.css
  layout.css
  components.css
js/
  db.js
  storage.js
  accounts.js
  transactions.js
  categories.js
  budgets.js
  recurring.js
  statistics.js
  ui.js
  app.js
AGENTS.md
README.md
```

## Privacy, security and backups

### Privacy

All financial records stay on-device. No cloud sync, account login, third-party analytics or transmission of financial information. Optional rate synchronization requests only the full public rate list; the provider receives the IP address and standard connection information.

### Optional PIN lock

- Disabled by default; 4- or 6-digit PIN, inactivity timeout, change/disable after verification and retry delays.
- Never store the plaintext PIN; use an appropriate password-derived verifier.
- **A PIN gate does not encrypt IndexedDB.** Do not market it as encryption or protection from users with local storage access. Encryption at rest would require a separate design and recovery policy.

### JSON backup and restore

- Export accounts, transactions, splits, categories, budgets, recurring rules, exchange rates, settings and supported attachments.
- Include backup format version, export timestamp and integrity/validation metadata.
- Validate backup structure and references before import; do not overwrite without explicit confirmation.
- Document whether restoration replaces or merges data; avoid accidental duplicate records.

### Reset all data

- Open Settings & backup from the header gear or More → Open settings, then choose **Reset all data**.
- A custom confirmation lists the data to delete and recommends exporting a full JSON backup first. Cancel returns to Settings without deleting anything.
- **Delete all data** clears all accounts (including archived accounts), transactions, budgets, recurring schedules, categories and settings in this browser's app database. Starter categories are restored; base currency and other preferences return to defaults.
- All stores are replaced in one atomic IndexedDB transaction. The app returns to the current month's empty Home screen with All Accounts selected only after the transaction commits. Repeated confirmation clicks are disabled while saving; storage errors are shown and allow retry.
- There is no undo except restoring a previously exported backup. Downloaded backups and data in other browsers are unaffected. No database schema change is required.
- Status: focused automated checks passed; actual browser persistence and mobile layout verification remain pending.

### CSV

- CSV transaction rows are ordered newest first by transaction date/time, consistently with transaction history.
- Export transactions in spreadsheet-compatible format with dates, account/currency, categories, splits and transfer representation documented.
- Import transactions using column mapping, validation, preview and duplicate detection.
- Do not claim CSV contains a complete application backup.

## Non-goals

Explicitly excluded unless the product owner changes the requirements:

- Credit cards, statements, credit limits and credit-card installments.
- Manual balance adjustments.
- Budget carry-over.
- Dark mode or system theme switching.
- Dedicated net-worth dashboard.
- Backend server, mandatory accounts, cloud sync or bank API connections.
- Online-only functionality or mandatory internet access.

## Development roadmap and feature tracker

**Important:** This tracker begins conservatively because the current local Git code has not been audited. An agent must inspect and test the implementation before changing a feature to `Implemented`.

| ID  | Area         | Feature                                         | Status                          | Verification notes                                   |
| --- | ------------ | ----------------------------------------------- | ------------------------------- | ---------------------------------------------------- |
| F01 | Foundation   | Direct-open offline HTML application            | Planned                         | Verify on target browsers                            |
| F02 | Foundation   | Modular CSS and JavaScript                      | Planned                         | Inspect script order                                 |
| F03 | Foundation   | Versioned IndexedDB persistence                 | Planned                         | Reload and migration tests                           |
| F04 | Design       | Responsive premium blue light UI                | Planned                         | Mobile and desktop review                            |
| F05 | Navigation   | Five primary sections                           | Planned                         | All routes/actions functional                        |
| F06 | Accounts     | Create/edit accounts and opening balances       | Planned                         | Balance tests                                        |
| F07 | Accounts     | Archive and restore accounts                    | Planned                         | Historical data preserved                            |
| F08 | Currency     | Native currencies and base reporting currency   | Planned                         | Rate handling verified                               |
| F09 | Currency     | Cross-currency transfers                        | Planned                         | Both ledger sides verified                           |
| F10 | Transactions | Income, expenses, transfers CRUD                | Planned                         | CRUD and totals tested                               |
| F11 | Transactions | Split transactions                              | Planned                         | Exact allocation sums                                |
| F12 | Transactions | History, calendar, search and filters           | Planned                         | Date/filter edge cases                               |
| F13 | Categories   | Custom categories, subcategories, icons, colors | In progress                     | Reference safety                                     |
| F14 | Budgets      | Overall and category monthly budgets            | Planned                         | No carry-over                                        |
| F15 | Recurring    | Recurring income and expenses                   | Planned                         | Idempotent catch-up                                  |
| F16 | Statistics   | Donut, bar, trends, drilldowns                  | Planned                         | Reconcile with ledger                                |
| F17 | Data         | Complete JSON backup and restore                | Planned                         | Round-trip test                                      |
| F18 | Data         | CSV export and import                           | Planned                         | Mapping/duplicates                                   |
| F19 | Security     | Optional PIN lock                               | Planned                         | Clear security limitations                           |
| F20 | Quality      | Error states, accessibility, responsive QA      | Planned                         | Browser verification                                 |
| F21 | Accounts     | Account visibility                              | Partial — focused checks passed | Browser hide/show, reload and restore checks pending |
| F22 | Data         | Reset all data with confirmation                | Partial — focused checks passed | Browser persistence and mobile checks pending        |
| F23 | Currency     | Dynamic currency management                     | Partial — focused checks passed | Browser persistence and transfer checks pending      |
| F24 | Currency     | Optional startup rate synchronization           | Partial — focused checks passed | Browser file access and offline checks pending       |

### Release phases

1. **Foundation:** F01–F05.
2. **Financial core:** F06–F11 and F13.
3. **History and analytics:** F12, F16.
4. **Budgets and automation:** F14–F15.
5. **Data management and security:** F17–F19.
6. **Stabilization:** F20, financial edge cases, migration/restore testing.

## Acceptance criteria and test scenarios

### Currency synchronization checks

- Fresh startup fetches a fixed public URL without user-specific query parameters, credentials or a referrer while the local UI remains usable.
- A successful sync updates automatic enabled rates and source dates without adding all provider currencies to selectors. Historical snapshots and manual overrides stay unchanged.
- Verify Sync now, saved startup toggle, Use synced rates, editing a manual override and adding a currency using its cached rate.
- Reject malformed/duplicate/nonpositive rates and HTTP errors without changing stored rates. Network failure, timeout and storage failure retain existing data and permit retry.
- Reset or restore during a pending request must cancel it so it cannot write into the replacement data.
- Reopen under `file://` to verify cached settings and actual API CORS behavior; verify offline startup and mobile layout.

### Dynamic currency checks

- Fresh state and a completed full data reset offer only EUR and USD. Existing saved currencies remain available on ordinary app startup; older accounts retain their unsaved fallback rates.

- Add a lowercase three-letter code with a positive rate; verify uppercase options in account creation and the reporting selector plus an editable Settings rate row.
- Reject malformed codes, existing codes, zero, negative and nonfinite rates without changing saved settings. A storage failure shows an error and permits retry.
- Verify conversions using the entered rate and preserve custom rates when resetting starter rates. Small positive rates must not be rounded to zero.
- Retain currencies from imported and archived accounts in selectors.
- Preserve custom rates through reload and full JSON backup/restore.
- Reject a reporting-currency change when any transaction snapshot lacks its required historical rates. Keep existing snapshots and ledger amounts unchanged.
- Verify account creation and transfers using a new currency on mobile and desktop; amounts currently retain two-decimal precision.

### Reset data checks

- Opening reset confirmation or cancelling leaves every record unchanged.
- Confirming deletes records in all six stores and restores only starter categories, with no accounts, transactions, budgets, recurring rules or saved settings.
- Home shows the current month, All Accounts, default EUR and empty financial states; old searches and filters are cleared.
- After reopening the app, deleted records and recurring schedules remain absent.
- A failed/aborted reset preserves prior records and shows an error; repeated clicks cannot queue multiple resets.
- Verify the confirmation is usable on mobile and desktop and that a backup exported before reset can be restored.

### Transfer form checks

- A 100 MKD → MKD transfer receives 100 MKD without extra input.
- A 100 EUR → MKD transfer at 61.5 receives 6,150 MKD.
- A 6,150 MKD → EUR transfer at the same quoted rate receives 100 EUR.
- For USD → MKD, sending 100 at rate 56 fills received with 5,600; editing received to 5,700 updates the rate to 57. The info line includes a main-currency estimate.
- Changing the amount or either account updates rate visibility and the preview.
- Empty, zero, negative or nonfinite cross-currency rates cannot be saved.

### Account visibility checks

- Hide/show an account in its editor; confirm source/destination pickers, account filters and new recurring selectors reflect the setting.
- Confirm a hidden account’s balance and transactions still contribute to totals/statistics and are searchable.
- Edit an old transaction belonging to a hidden account without changing its account; verify its account ID is preserved.
- Reload and JSON backup/restore must retain visibility; older accounts without the property must remain visible. Browser persistence/restore verification is pending.

### Full application scenarios

- [ ] At 320–430px widths, Manage categories keeps New inside the dialog and all four compact category action buttons on the first row at the right, including long category/subcategory names and many subcategories. Check desktop category sizing/layout remains unchanged. Confirm all actions and scroll-preserving sorting still work.

- [ ] Scroll down in Manage categories and repeatedly move income/expense categories up/down: the dialog retains its scroll position and focus follows the moved category's sort button. Boundary moves do not change order; subcategory sorting still works inline.
- [ ] Archived accounts start collapsed, show the correct count, expand/collapse by touch and keyboard, retain expansion through Manage/Done and account updates and close after navigation away/reload. No section appears without archived accounts.

- [ ] Accounts always show Add account; other management controls are initially hidden. Manage reveals them, Done hides them and balances stay inline at iPhone widths with long names/large amounts. Verify sorting, visibility, editing, archive/restore in management mode, empty-list creation and return-to-page reset.
- [ ] On iPhone, opening Settings or a data-entry dialog does not activate a field/keyboard automatically; tapping an exchange-rate field opens the decimal keyboard without zooming. Desktop dialogs still focus their first field/action.
- [ ] On iPhone, rapidly tap the previous/next period arrow two or three times: each tap changes the period once without zooming; scrolling and pinch-to-zoom still work.
- [ ] Opening `index.html` requires no server or internet and loads all local assets.
- [ ] Fresh install shows no financial records or fake balances.
- [ ] Records persist across reloads on the supported target browser.
- [ ] €1,000 opening balance + €200 income − €75 expense = €1,125 balance.
- [ ] Transfer of €100 between two EUR accounts changes each account correctly without changing combined total.
- [ ] Cross-currency transfer records source and destination amounts accurately; unavailable rates do not produce fictional reports.
- [ ] A €50 expense split €35/€15 reduces account balance by €50 and distributes budget/statistics by €35/€15.
- [ ] Split amounts not equal to parent total are rejected.
- [ ] Editing/deleting a transaction recalculates dependent values correctly.
- [ ] Archived accounts remain visible in historical records and can be restored.
- [ ] Monthly budgets reset independently without carry-over.
- [ ] Recurring catch-up does not generate duplicate occurrences on repeated app opens.
- [ ] JSON backup restores all relationships in a clean database.
- [ ] Invalid imports fail safely without partial destructive changes.
- [ ] All primary flows work at iPhone viewport widths without overlapping controls.
- [ ] Optional PIN is not represented as encryption.

## Agent documentation workflow

**This README is the living product specification and project status document.** `AGENTS.md` holds persistent coding instructions; the two files must remain consistent.

Whenever Codex or another agent changes the application:

1. **Read** `AGENTS.md`, this README and the relevant implementation before coding.
2. **Identify scope**: which requirements and feature IDs are affected.
3. **Implement narrowly**, preserving financial data and unrelated behavior.
4. **Test** the affected flow and financial calculations; distinguish automated tests from manual verification.
5. **Update this README in the same change** if functionality, architecture, data model, constraints, status or user-facing behavior changed.
6. **Update the feature tracker** only when code evidence and appropriate verification justify the new status; do not mark a feature implemented just because a UI placeholder exists.
7. **Update acceptance criteria** when new rules or edge cases are introduced.
8. **Record product decisions** and any unresolved questions below.
9. **Append a concise change-log entry** with date, affected feature IDs, summary and verification.
10. **Report** what changed, what was tested, what remains incomplete and any storage/migration risks.

Do not erase agreed requirements simply because they are not implemented. Do not claim tests were run if they were not. Do not silently change excluded features. Keep documentation accurate and readable; avoid wholesale rewrites for small changes.

**Suggested one-time Codex instruction to add to `AGENTS.md`:**

> Treat README.md as the living product specification. For every feature addition, behavior change, bug fix affecting documented behavior, schema change or status change, update the relevant README sections, feature tracker, acceptance criteria and change log in the same task. Never mark a feature implemented without verifying it against the code and tests.

### Initial repository audit task

Before treating any feature as complete, ask Codex:

> Audit the current repository against README.md. Do not implement new features. For each feature ID, identify the implementation files and whether the feature is functional, partial, absent or unverified. Update the feature tracker with evidence and accurate statuses, then summarize the highest-priority gaps. Do not delete existing data or make unrelated changes.

## Decisions and open questions

### Confirmed decisions

| Decision                   | Choice                                         |
| -------------------------- | ---------------------------------------------- |
| App name                   | Flow                                           |
| Design                     | Blue and white, light only                     |
| Runtime                    | Direct-open local HTML, no server              |
| Stack                      | Vanilla HTML/CSS/JS + IndexedDB                |
| Default base currency      | EUR                                            |
| Accounts                   | Cash, bank, savings, investment, loan, custom  |
| Credit cards               | Excluded                                       |
| Account archiving          | Included                                       |
| Manual balance adjustments | Excluded                                       |
| Split income/expenses      | Included                                       |
| Category icons/colors      | Included                                       |
| Recurring income/expenses  | Included                                       |
| Monthly budget carry-over  | Excluded                                       |
| Dedicated net worth        | Excluded initially                             |
| Backups                    | JSON backup/restore + CSV import/export        |
| App lock                   | Optional PIN                                   |
| Navigation                 | Home, Transactions, Statistics, Accounts, More |

### Open questions requiring a future decision

- How should loan accounts represent liabilities, repayments and interest?
- How should investment valuations be entered without manual balance adjustments?
- Which rate/date convention should historical multi-currency reporting use and how should missing rates be handled?
- Should archived accounts count in historical all-account balance snapshots even when excluded from current active totals?
- What are the exact semantics of recurring edits to one occurrence versus future occurrences?
- Should JSON restoration support merge, replace or both and how are conflicts resolved?
- Which browser/OS combinations are officially supported for direct `file://` IndexedDB persistence?
- Should a forgotten PIN allow reset without deleting data, given that the PIN is not encryption?

## Change log

### 2026-10-22 — Switch exchange-rate provider

- Replaced the runtime provider with `https://api.exchangerate.fun/latest?base=eur`. Adapted validation to its EUR-based rates map and Unix timestamp, with support for the documented date-only format.
- Cached the provider identity and source timestamp. A successful sync replaces automatic current rates and the provider cache while preserving manual overrides and historical snapshots. Existing cached rates remain usable until a successful sync.
- Verification: retrieved the live endpoint and validated its response through the sync code; automated provider-switch, timestamp/date parsing, EUR identity, invalid-response, failure fallback and existing sync regression checks passed. Syntax, asset/script order, formatting and diff checks passed. Browser CORS, layout and persistence remain unverified because macOS capture permissions are unavailable.

### 2026-10-22 — Two-line rate labels

- Placed the currency code on the first line with the reference quote and rate source together on the second line. Retained shared grid columns to keep rate inputs aligned.
- Verification: reviewed label grid placement; formatting and diff checks passed. Browser appearance was not retested.

### 2026-10-22 — Align exchange-rate inputs

- Replaced independently sized flex rows with consistent grid columns for the inline label, input and currency suffix. Input widths and edges now share the same column sizes regardless of text width.
- Verification: reviewed CSS column sizing; formatting and diff checks passed. Live browser layout remains unverified because macOS capture permission is unavailable.

### 2026-10-22 — Compact exchange-rate rows

- Kept the currency code, reference quote and rate source on one line. Narrowed rate inputs to 140px with room to shrink on small screens while retaining 16px input text to avoid iPhone focus zoom.
- Verification: inspected rate-row CSS and markup; formatting and diff checks passed. Live browser and mobile layout verification remain blocked by macOS capture permissions.

### 2026-10-22 — Sync date format fix

- Applied the shared dotted date format to Last synced and both source-rate dates. Sync timestamps use local 24-hour time with padded fields; stored ISO values are unchanged.
- Verification: sync tests including exact timestamp/range formatting and midnight padding, JavaScript syntax, formatting and diff checks passed. Browser appearance was not retested.

### 2026-10-22 — Compact sync status

- Replaced the explanatory paragraph under the startup sync toggle with the existing live sync status using the same form-hint font and styling.
- Verification: source markup, JavaScript syntax, formatting and diff checks passed. Browser appearance was not retested.

### 2026-10-22 — Optional public exchange-rate synchronization

- Added nonblocking startup sync, Sync now, last-sync/source-date status and a saved startup toggle in Settings & backup. Uses Frankfurter's full public rate list without financial or user-specific request data.
- Cached responses and enabled reference rates are saved atomically. Manual overrides, historical transaction snapshots and EUR/USD-only starter selectors are preserved. Use synced rates switches supported enabled currencies to automatic updates; Add currency supports cached rates.
- Added validation, timeout/offline fallback and cancellation before reset/restore. Updated the project network rule to permit this optional public-data request.
- Verification: automated sync, validation, privacy request shape, manual override, snapshot preservation, concurrency/cancellation, offline/HTTP/storage failure and atomic persistence checks; JavaScript syntax, asset/script order, formatting and diff checks. The live API response format was inspected. Direct browser testing was blocked by macOS screen-capture permission; actual `file://` CORS behavior, browser persistence and mobile layout remain unverified. Run `node --test tests/currency-sync.test.cjs` for the automated checks.

### 2026-10-22 — Remove account currency hint

- Removed the Settings & backup hint beneath Currency in the account form.
- Verification: confirmed the hint is absent; JavaScript syntax, formatting and diff checks passed. Browser layout was not retested.

### 2026-10-22 — EUR and USD starter currencies

- Reduced starter currencies to EUR and USD for fresh installs and full data resets. Other currencies remain available through Add currency.
- Preserved saved currency settings and historical records. Older accounts using the removed starter currencies retain their previous fallback reference rates when no rates were saved. Reset starter rates changes only EUR and USD.
- Verification: focused fresh-state, full-reset, saved-rate preservation and legacy-account conversion checks passed alongside JavaScript syntax, formatting and diff checks. Live browser persistence was not retested.

### 2026-10-22 — Dynamic currencies

- Replaced the fixed selector list with currencies discovered from reference rates and existing accounts. Added a validated Add currency form in Settings & backup with an explicit user-entered rate.
- Rate editing includes every available currency. Reset starter rates preserves custom rates and saving rates no longer rounds small positive values to zero.
- Guarded reporting-currency changes against missing historical snapshot rates; preserved existing transaction amounts and snapshots. Documented the existing two-decimal precision limitation.
- Verification: focused automated discovery, normalization, invalid/duplicate code and rate, conversion/snapshot, small-rate, reset preservation, JSON settings round-trip, historical-rate guard and storage-failure checks passed. Syntax, local assets/script order, formatting and diff checks passed. Live browser persistence, full backup restoration, responsive layout and new-currency transfer interaction remain unverified.

### 2026-10-22 — Balance visibility control on Home

- Removed the duplicate Blur total balance checkbox and its event handler from Settings & backup. The Home card’s Show/Hide button remains the control for the existing saved preference.
- Verification: JavaScript syntax, Settings markup/handler inspection, preserved Home control and preference checks, formatting and diff checks passed. Browser interaction and persistence were not retested.

### 2026-10-22 — Consistent conjunction punctuation

- Removed commas immediately before “and” or “or” from app copy and project documentation.
- Added a permanent writing rule to AGENTS.md for future copy changes. User-entered content and imported records are preserved.
- Verification: source scan for the prohibited punctuation plus JavaScript syntax checks and diff review passed. Browser rendering was not retested for these text-only changes.

### 2026-10-22 — Reset all data

- Added Reset all data to Settings & backup with an explicit deletion confirmation and backup reminder. Cancel returns to Settings.
- Atomically clears all six stores and restores starter categories, then returns to an empty Home screen with default settings and filters. Added abort handling to database replacement and disabled confirmation controls while resetting.
- Verification: focused automated checks for cancellation, commit timing, repeated clicks, all-store replacement, default state/categories, storage failure preservation and transaction abort handling passed; JavaScript syntax, local assets/script order, formatting and diff checks passed. Browser layout, actual IndexedDB persistence after reload and backup restoration were not retested.

### 2026-10-21 — Remove obsolete entry page

- Removed `flow-money-manager-offline.html`, the unused older entry page with the previous logo. Use `index.html`, which loads the local application assets and current logo.
- Verification: no application references to the removed page; local asset existence, script dependency order, JavaScript syntax and diff checks passed. Browser behavior and IndexedDB persistence were not retested.

### 2026-10-21 — Add Prettier formatting and multiline view templates

- Added `.prettierrc.json`, `.prettierignore` and a dev-only `package.json` with `format` / `format:check` scripts.
- Settings: 2-space indent, single quotes, no semicolons, 100-character print width and embedded HTML/CSS formatting in template literals where Prettier can infer structure.
- Refactored `assets/js/views.js` HTML template literals to multiline form. Prettier does not break single-line HTML strings automatically; multiline templates are required for readable markup and stable formatting on save.
- Ran Prettier across JS, CSS, HTML and Markdown sources. Runtime app behavior is unchanged; `node_modules/` is gitignored.
- Verification: JavaScript syntax checks and `npm run format:check` passed. Browser regression testing was not run.

### 2026-10-17 — Fix category manager mobile overflow

- Constrained category grids to available width and allowed long category names/subcategory chips to wrap. Mobile rows use smaller category icons and compact controls on the first row at the right, with a shrinking/wrapping name column and reduced list padding; desktop sizing is unchanged.
- Verification: JavaScript syntax, generated category markup/escaping/action-group checks, compact style scoping and row-width checks, local asset/script-order checks and diff checks passed. Live mobile layout, touch actions and IndexedDB persistence remain unverified.

### 2026-10-17 — Preserve scroll when sorting categories

- Retained the category dialog's scroll offset after sorting rebuilds it and restored focus to the moved category's matching sort button with scrolling prevented. Account and subcategory sorting are unchanged.
- Verification: JavaScript syntax and focused sorting/scroll/focus/boundary checks passed; diff checks passed. Live browser scrolling and IndexedDB persistence remain unverified.

### 2026-10-17 — Collapsible archived accounts

- Moved archived accounts into a native details/summary section with a count, closed by default. The clickable blue outlined header groups its chevron, label and count together and includes expand/collapse hints plus hover/focus feedback. Expansion is temporary UI state retained during account management and reset on navigation away/reload.
- Existing inline balances and archived management actions remain available when expanded.
- Verification: JavaScript syntax, focused collapsed/expanded/empty rendering and state checks, local asset/script-order checks and diff checks passed. Live browser touch/keyboard/layout and IndexedDB interaction remain unverified.

### 2026-10-17 — Accounts viewing and management modes

- Added a Manage/Done toggle above Accounts (labeled Manage because it covers sorting, visibility, editing and archiving). Sorting, visibility, editing and archive/restore controls appear in management mode. Add account stays visible in both modes, including empty lists.
- Kept mobile balances on the same row as account details and placed management actions underneath. Management mode is temporary UI state and resets on navigation away/reload; financial data and calculations are unchanged.
- Verification: focused rendering/toggle/reset checks, Add account visibility for populated/empty lists in both modes, JavaScript syntax, asset/script-order checks and diff checks passed. Live mobile layout and IndexedDB interaction verification remain pending.

### 2026-10-17 — Prevent form focus zoom on mobile

- Set Settings exchange-rate input text to 16px instead of inheriting the rate row's 12px text.
- Dialogs initially focus Close on devices with a coarse pointer, avoiding automatic keyboard/picker activation; desktop first-field/action focus is retained. Pinch-to-zoom remains available.
- Verification: JavaScript syntax, focused dialog focus branches, rate-input style, local asset references and script ordering checks passed. Physical iPhone focus/keyboard/zoom behavior remains unverified.

### 2026-10-17 — Prevent double-tap zoom

- Added root-level `touch-action: manipulation` so rapid repeated taps, including month navigation, do not trigger double-tap zoom. Scrolling and pinch-to-zoom remain allowed; viewport zoom is unrestricted.
- Verification: root CSS rule, viewport configuration, JavaScript syntax, local asset references and script ordering checks passed. Physical iPhone double/triple taps and pinch gestures remain unverified.

### 2026-10-17 — Remove manual quote reversal

- Removed the Reverse quote button, click handler and manual direction state. Automatic Settings/historical quote direction, rate/received synchronization and saved amounts are retained.
- Verification: JavaScript syntax, removal checks and automatic transfer quote/calculation/save regressions passed; browser visual verification remains pending.

### 2026-10-17 — Transfer quotes with missing currency settings

- Existing transfer quotes can choose their orientation from historical amount ratios when a currency reference is unavailable. Added Reverse quote for all cross-currency pairs, including new pairs with missing rates, without fabricating a default rate. Reversal preserves valid received amounts and the stored destination/source rate convention.
- Verification: JavaScript syntax and focused missing-reference, historical fallback, manual reversal, synchronization and save checks passed; browser visual verification remains pending.

### 2026-10-17 — Readable non-main-currency transfer quotes

- Non-main pairs now quote the higher-value currency unit first using Settings rates, keeping MKD ↔ USD expressed as 1 USD = X MKD. Main-currency pair conventions remain unchanged. Generated quotes avoid long floating-point tails with 10 significant digits; both directions retain two-way field calculations and authoritative saved received amounts.
- Verification: JavaScript syntax and focused quote orientation, reciprocal calculations, formatting, historical amount preservation and save checks passed; browser visual verification remains pending.

### 2026-10-17 — Transfer fields without duplicate conversion note

- Removed the blue Amount received/Main-currency estimate note from all transfer forms. Exchange-rate and received-amount fields retain defaults, two-way calculations, validation and saved values. Income/expense reporting previews remain unchanged.
- Verification: JavaScript syntax and focused hidden-note, field synchronization, transfer save/validation and ordinary transaction preview checks passed; browser visual verification remains pending.

### 2026-10-17 — Consistent monetary currency formatting

- Standardized the shared formatter to amount followed by uppercase currency code, with two decimals for every currency. This applies to balances, transaction/split amounts, budgets, statistics, recurring entries and conversion previews. Removed the now-duplicated base currency code from transaction reporting equivalents.
- Verification: JavaScript syntax, supported-currency/negative/grouping/zero/rounding checks, conversion and transaction rendering checks and sorting/export regressions passed; browser visual verification remains pending.

### 2026-10-17 — Editable received amount in both transfer directions

- All cross-currency transfers now show an editable received-amount field, including transfers into the main currency. Received edits respect the main-currency quote direction and saved destination amounts remain authoritative with the stored destination/source rate derived from them. Same-currency transfers still receive the sent amount automatically.
- Verification: JavaScript syntax and focused incoming/outgoing rate/received synchronization, edit/default, validation and save checks passed; browser visual verification and IndexedDB reload persistence remain untested.

### 2026-10-17 — Omit redundant main-currency self-conversion

- Cross-currency transfer previews no longer show a main-currency estimate when sending from the main currency (for example, EUR → MKD with EUR reporting). The received amount/calculation remains visible. Sources in another currency retain the reporting estimate; same-currency transfers remain without a preview.
- Verification: JavaScript syntax and focused source/main-currency, account-switching, received amount and transfer regression checks passed; browser visual verification remains pending.

### 2026-10-17 — No conversion preview for same-currency transfers

- Removed the redundant main-currency estimate and same-amount notice for transfers between accounts sharing a native currency. Cross-currency previews remain available, including after changing accounts. Saved transfer amounts and reporting snapshots are unchanged.
- Verification: JavaScript syntax and focused same/cross-currency preview transition and transfer calculation checks passed; browser visual verification remains pending.

### 2026-10-16 — Persistent total balance blur

- Added a Settings checkbox and Home Show/Hide shortcut backed by the IndexedDB `hideTotalBalance` boolean. Blur state defaults to off for existing databases and is included in complete JSON backups. Hidden balance text is excluded from screen-reader output; other amounts and calculations remain unchanged. No schema migration is needed.
- Verification: JavaScript syntax and focused preference/render/save/error checks passed; live browser blur appearance and IndexedDB persistence after reload remain untested.

### 2026-10-16 — Transfer payee title and account route

- Transfer rows now use Payee as the title, falling back to “Transfer” when empty, with source → destination account names below. The transfer Payee field remains available for currency exchange merchants and other context.
- Verification: JavaScript syntax, transfer/ordinary rendering, empty/legacy values, escaping and transaction sorting checks passed; browser visual verification remains pending.

### 2026-10-16 — Transaction type filter for manual transfer review

- Added All types/Income/Expenses/Transfers filtering alongside the existing period and account filters. Filtered All history shows all matches; transfer filtering does not depend on payee/description text or categories. No financial records are modified automatically.
- Verification: JavaScript syntax, transfer/all-history/filter combination checks and sorting regressions passed; browser visual verification remains pending.

### 2026-10-16 — Dot-separated display dates

- Changed the shared date formatter to `dd.mm.yyyy` (for example, 16.10.2026). Transaction, weekly range and recurring labels inherit the change; stored/exported ISO dates remain unchanged.
- Verification: JavaScript syntax and shared formatter checks passed; browser visual verification remains pending.

### 2026-10-16 — Day/month/year display dates

- Added a shared date display helper and applied `dd/mm/yyyy` to transaction dates, weekly period endpoints and recurring next dates without timezone conversion. Storage, date inputs, sorting, CSV/JSON formats and scheduling retain ISO dates. Native picker presentation remains browser-controlled.
- Verification: JavaScript syntax, date formatting/render checks and transaction/export sorting regressions passed; browser visual verification remains pending.

### 2026-10-16 — Split transaction icon

- Added a local branching SVG for multi-category income/expense transactions in history and dashboard lists. Single-category entries retain category icons and transfers retain their transfer icon.
- Verification: JavaScript syntax and rendered split/ordinary/transfer icon checks passed; browser visual verification remains pending.

### 2026-10-16 — Distinct Split badge color

- Changed the Split badge to purple, including expanded, hover and focus states, to distinguish it from the blue Note badge.
- Verification: JavaScript syntax and badge class/color-state checks passed; browser visual verification remains pending.

### 2026-10-16 — Split breakdown in transaction lists

- Added a Split badge using the Note badge style. It toggles an inline list of split category/subcategory names and native-currency amounts, one allocation per line, in transaction history and dashboard recent transactions. Note and Split disclosures operate independently; totals and stored records are unchanged.
- Verification: JavaScript syntax, rendered breakdown/escaping checks, badge toggle/focus checks and transaction/category regressions passed. Live browser layout and keyboard interaction remain untested.

### 2026-10-16 — Central app version constant

- Added `APP_VERSION` at the top of `assets/js/state.js`. Change this value to update the version displayed at the bottom of Settings; no other UI file needs editing. Database and backup format versions remain independent.
- Verification: JavaScript syntax, script ordering and Settings rendering with both the current and a substituted version passed; live browser rendering remains untested.

### 2026-10-16 — Settings bottom spacing

- Added spacing directly to the version label: 20px above and 25px plus the device safe-area inset below. This keeps the bottom gap inside the scrollable content instead of relying on modal scroll-container padding.
- Verification: checked label padding and removed the ineffective container override. Live browser rendering remains unverified; the connected browser was unavailable.

### 2026-10-16 — App version in Settings

- Added a centered “Flow - v1.0.3” label at the bottom of Settings & backup. This is the app release version; database and backup format versions are unchanged.
- Verification: JavaScript syntax and Settings markup placement checks passed; browser visual verification remains pending.

### 2026-10-16 — Full-row category choices for split transactions

- Split category pickers now expand beneath both Category and Amount fields, using the full row width instead of staying in the left column. The input fields remain side by side with top alignment; existing category accordion and subcategory layout rules are retained.
- Verification: grid placement/hidden-panel checks and focused category/split transaction regressions passed; live browser visual verification remains pending.

### 2026-10-16 — Split checkbox spacing

- Increased spacing below the split checkbox to 15px, matching the standard field spacing above it, so the first split row is clearly separated.
- Verification: checked the targeted CSS rule and diff; browser visual verification remains pending.

### 2026-10-16 — No parent category for split transactions

- Main category selection is hidden and disabled while splitting; it returns with its previous selection when splitting is disabled. Expanded main category choices close when enabling splits. Edit/copy forms apply the same behavior.
- Save logic now reads the parent category only for non-split entries; split entries keep null parent category/subcategory IDs using the existing database structure.
- Verification: JavaScript syntax and focused split-toggle/save/validation and category regressions passed; live browser layout and IndexedDB reload persistence remain untested.

### 2026-10-16 — Consistent budget, recurring and CSV ordering

- Budget and recurring category dropdowns now follow saved category order with alphabetical ties. Both budget displays show Overall first, then category order, with missing categories last.
- Recurring entries display by next scheduled date and time ascending (legacy missing times use noon, matching generation), then label and ID. Paused entries follow the same date ordering; missing dates appear last. This changes display order only, not schedule processing.
- CSV export now uses the same newest-first date/time ordering as transaction history. Sorting uses copied arrays and preserves financial values, IDs, export columns and stored order.
- Verification: JavaScript syntax and focused budget/dropdown/recurring/CSV ordering and empty-state checks passed, plus transaction and category regressions. Live browser layout and persistence remain untested.

### 2026-10-16 — Consistent newest-first transaction ordering

- Fixed monthly and filtered transaction results being shown in database order. All periods and search/filter results now sort by transaction date and time descending before any display limit, with safe fallbacks for older records missing time/creation timestamps. Dashboard recent transactions use the same comparator. Financial records and calculations are unchanged.
- Verification: JavaScript syntax and focused chronological, same-day, missing-value, filter/period and display-limit checks passed; live browser rendering and persistence remain untested.

### 2026-10-16 — Transaction category and subcategory picker

- Replaced category dropdowns in ordinary and split transactions with inline fields that expand into ordered category choices and collapse after selection. Parent categories remain selectable; separate chevrons reveal subcategories. Transfers have no category picker.
- Opening a category closes any other expanded category within that picker; split-row pickers operate independently. Expanded parent categories span the full picker width. Multiple subcategories use a responsive grid, while a single subcategory remains compact and left-aligned underneath.
- Preserved category/subcategory relationships and edit/copy selections, with validation of transaction type and parent relationships. Empty states, selected labels, keyboard focus return and Escape dismissal are supported.
- Acceptance: select parents and subcategories, verify collapsed labels and saved IDs, switch transaction types and check split rows, empty states, accordion behavior and single/multiple-subcategory layouts.
- Verification: JavaScript syntax, focused markup/interaction/validation checks, layout rule checks and transfer regressions passed. Live browser touch/layout and IndexedDB reload persistence remain untested. Consolidated the recent category-picker documentation into this entry.

### 2026-10-16 — Text-only transaction account buttons

- Removed icons from source/destination account choices inside the transaction modal. Buttons retain the account name, currency, compact sizing and selected state; other account wallet icons remain unchanged.
- Verification: JavaScript syntax and focused picker checks passed; browser visual verification remains pending.

### 2026-10-16 — Consistent account wallet icon

- Reused the shared wallet SVG in transaction account buttons, account rows, dashboard account previews and account empty states, replacing the remaining square glyphs.
- Verification: JavaScript syntax and shared-icon reference checks passed; browser visual verification remains pending.

### 2026-10-16 — Accounts navigation icon

- Replaced the square Accounts navigation glyph with a local inline wallet SVG in desktop sidebar and mobile navigation. The icon inherits normal/selected navigation colors.
- Verification: JavaScript syntax and shared navigation icon markup checks passed; browser visual verification remains pending.

### 2026-10-16 — Account reorder boundary controls

- Account rows now disable and dim impossible up/down moves at each type group boundary, matching the account type controls. Single-account groups disable both arrows in active and archived sections.
- Verification: JavaScript syntax and rendered boundary/single-account checks passed; browser visual verification remains pending.

### 2026-10-16 — Consistent account ordering in selectors

- Updated shared account sorting to apply saved type order before within-type account order. Transaction source/destination buttons, account filter dropdowns, recurring account choices and dashboard account summaries now follow the Accounts page ordering.
- Older backups without a type-order setting use the default type order; missing account sort values fall back to alphabetical ordering after explicitly ordered accounts within the type. No import or database migration is needed.
- Verification: JavaScript syntax and focused default/custom order, selector rendering, visibility and missing-sort checks passed. Live browser interaction and reload persistence remain untested.

### 2026-10-16 — Account type sorting

- Added group-header up/down controls and persisted account type ordering in Settings without a database schema change. Active and archived account sections share the order; within-group account sort values are preserved.
- Acceptance: move a group, verify the other section follows the same type order, verify boundary controls and account ordering, then confirm reload/JSON restoration retains the setting.
- Verification: JavaScript syntax and focused sorting/move/render checks passed; browser interaction and IndexedDB reload/backup restoration remain untested.

### 2026-10-16 — Matching account status badges

- Archived and Hidden badges now share the same compact font size, padding, line height and corner radius.
- Verification: JavaScript syntax and shared badge styling checks passed; browser visual verification remains pending.

### 2026-10-16 — Simpler archived account rows

- Removed the redundant Hidden badge and disabled eye button from archived rows. The Archived badge and Restore action remain; archived accounts are still always hidden and become visible when restored. Active rows retain their visibility badge/button behavior.
- Verification: JavaScript syntax and rendered active/archived row checks passed; browser visual verification remains pending.

### 2026-10-16 — Archived account visibility rules

- Archiving now saves hidden visibility; restoring saves visible visibility. Archived rows always show the crossed-out eye and Hidden state, including older/imported records with missing or conflicting flags.
- Disabled archived visibility controls and guarded checkbox saves and eye actions against enabling archived accounts.
- Verification: JavaScript syntax and focused archive/restore, disabled-control, legacy-record and edit-save checks passed. Browser interactions and persistence after reload remain untested.

### 2026-10-16 — Archive button layout regression

- Renamed the archive button class to avoid colliding with the archived-accounts section class. The section’s 30px top margin no longer applies to the button or stretches the action row.
- Verification: JavaScript syntax and rendered class isolation checks passed; live browser layout verification remains pending.

### 2026-10-16 — Archive account icon

- Replaced the minus action with a local SVG archive-box icon, retaining the restore arrow for archived accounts and existing confirmation behavior. Added explicit accessible action labels.
- Verification: JavaScript syntax and rendered action markup checks passed; browser visual verification remains pending.

### 2026-10-16 — Compact, stable Hidden badge

- Restored the Hidden badge with smaller text and padding. A visually hidden, accessibility-hidden placeholder reserves the same space for visible accounts, keeping name widths and row heights stable when toggling.
- Verification: JavaScript syntax and badge markup/style checks passed; live mobile/desktop layout remains untested.

### 2026-10-16 — Stable account rows when toggling visibility

- Removed the redundant Hidden badge from account names; the fixed-size eye/crossed-out-eye button communicates visibility without adding content that can wrap and shift surrounding rows.
- Verification: JavaScript syntax and rendered markup checks passed; live browser layout verification remains pending.

### 2026-10-16 — Quick account visibility toggle

- Added an eye/crossed-out-eye button immediately before Archive/Restore, toggling visibility without confirmation and sharing the account editor checkbox setting. Writes preserve other account properties; failed writes show an error and allow retry.
- Verification: JavaScript syntax, icon/order checks and focused toggle success/failure checks passed. Browser interaction and persistence after reload remain untested.

### 2026-10-16 — Account visibility

- Added a saved visibility checkbox and Hidden account badge, separate from archiving. Account choices exclude hidden accounts while financial calculations and history retain them. Existing transaction assignments are preserved during editing/copying; old accounts default to visible.
- Verification: JavaScript syntax and focused checks passed for hide/show saving, picker/filter exclusion, historical edit safety, all-hidden empty state, balance/statistics/history inclusion, legacy defaults and JSON serialization. Browser interactions and IndexedDB persistence after reload remain untested.

### 2026-10-16 — Smaller account choices

- Reduced account button minimum size from 88px to 72px, tightened grid spacing and padding and reduced icon/text sizes so more accounts fit per row. Names, currencies, selected states and keyboard focus remain available.
- Verification: reviewed the CSS diff and checked picker size/spacing rules; browser rendering remains untested.

### 2026-10-16 — Smooth logo corners

- Brand images now crop past the PNG’s transparent padding and irregular outer edge, with one proportional 25% container radius shared by mobile and desktop. This replaces overlapping asset/CSS curves that flattened the bottom corners. The original PNG and app icons remain unchanged.
- Verification: inspected the supplied screenshot and logo asset, checked shared desktop/mobile sizing and clipping rules and reviewed the diff. Live browser rendering remains unverified.

### 2026-10-16 — Transparent logo container on mobile

- Removed the white fill from the shared brand-icon container so the transparent logo edges blend with the mobile header and desktop sidebar backgrounds. The existing logo asset and dimensions are unchanged.
- Verification: confirmed the PNG has transparency, checked desktop/mobile CSS rules and local asset references and reviewed the diff. Live mobile browser rendering remains untested.

### 2026-10-16 — Account field name only

- Removed the parenthesized currency from collapsed source and destination account fields, including after selection. Expanded buttons still show currencies.
- Verification: JavaScript syntax and focused picker checks passed; browser visual verification remains pending.

### 2026-10-16 — Account field visual consistency

- Account selection fields now share the standard dropdown SVG chevron, spacing and input focus border/shadow for mouse and keyboard focus and while expanded.
- Verification: JavaScript syntax, shared CSS rule checks and focused picker regression checks passed; visual browser verification remains pending.

### 2026-10-16 — Collapsible account selection

- Source and destination account fields expand inline to show account buttons and collapse after selection. The selected account remains visible in the field; no nested modal is opened.
- Verification: JavaScript syntax and focused interaction/form checks passed; native browser layout, touch behavior and reload persistence remain untested.

### 2026-10-16 — Transaction account buttons

- Replaced source and transfer destination account dropdowns with responsive square account buttons. Selection updates the existing account IDs and currency calculations; same-account transfer validation is unchanged.
- Acceptance: selecting a button updates its selected state and the transfer preview; saved transactions use the selected source and destination IDs.
- Verification: JavaScript syntax and focused picker/form checks passed; browser layout, touch behavior and persistence after reload remain untested.

### 2026-10-16 — Transaction field order

- Moved Date & time before Amount in the transaction form, including keyboard focus order.
- Verification: JavaScript syntax and source field-order checks passed; browser layout remains untested.

### 2026-10-16 — Combined transaction date and time

- Replaced separate transaction date/time controls with one labeled Date & time input and extended existing mobile date/time styles. Existing records, reports, CSV/JSON formats and copy options retain separate local date/time values.
- Acceptance: new/edit/copy forms use one date-time control; saving preserves the selected local calendar day and time; blank, invalid dates and invalid times are rejected.
- Verification: JavaScript syntax, focused form/save validation and regression checks passed; native browser picker, responsive rendering and IndexedDB reload checks remain untested.

### 2026-10-16 — README consolidation

- Combined the product specification and transfer documentation into this single README.md, preserving acceptance criteria and changelog history.
- Removed the superseded README.txt.
- Verification: checked preserved specification content, local Markdown links and references to the old filename; no application code changed.

### 2026-10-16 — Transfer amount and exchange-rate form

- Same-currency transfers now calculate the received amount automatically.
- Cross-currency transfers show an explicit editable pair rate and a calculated, non-editable received amount. Saved transfers include the applied `transferRate`, with no schema migration required.
- Validation: JavaScript syntax and focused form tests; full browser persistence and responsive checks remain pending.

### 2026-10-16 — Consistent EUR transfer quotes

- EUR transfers now quote 1 EUR = X other currency in both directions, with matching preview, save calculation and edit initialization. Stored `transferRate` remains destination units per source unit.
- Verified with syntax and focused form checks; browser persistence and responsive checks remain pending.

### 2026-10-16 — Transfer rate defaults from Settings

- New transfer pairs use editable Settings reference rates, including cross rates for non-EUR pairs. Existing transfer amounts take precedence when editing or copying; typing an amount does not reset an edited rate.
- Verified with focused form checks and JavaScript syntax checks; browser persistence and responsive checks remain pending.

### 2026-10-16 — Transfers between two non-main currencies

- Transfers such as USD → MKD expose editable exchange-rate and received-amount fields. Rate edits calculate received = sent × rate; received edits calculate rate = received ÷ sent. Source amount edits retain the rate and update received.
- The information line shows a main-currency estimate using the historical reporting snapshot when available, otherwise Settings reference rates. The transfer pair rate does not replace reporting reference rates.
- Main-currency pairs quote 1 main-currency unit = X other currency; same-currency transfers still receive the sent amount automatically.
- Focused form tests cover synchronization, defaults, historical rates, rounding, saving, invalid inputs and field visibility; JavaScript syntax checks passed. Browser persistence and responsive checks remain pending.

### 2026-10-16 — Editable received amount for outgoing main-currency transfers

- EUR → MKD and EUR → other currencies now show the editable received-amount field alongside the exchange rate. Editing either updates the other; main-currency reporting information remains visible.
- Acceptance: sending 100 EUR at 61.5 fills 6,150 MKD; entering 6,200 MKD sets the rate to 62 and saves 6,200 MKD.
- Verified with JavaScript syntax and focused form checks; browser layout and persistence checks remain pending.

### 2026-10-14 — Comma decimal input

- Updated decimal money and exchange-rate fields to accept both comma and dot separators, such as `1,5` and `1.5`.
- Normalized comma decimals before amount and exchange-rate calculations.
- Kept numeric mobile keyboard hints while avoiding browser `type="number"` decimal-separator restrictions.
- **Verification:** JavaScript syntax checks and decimal parsing checks.

### 2026-10-14 — Transaction copy from edit

- Added a copy action inside the edit transaction modal.
- Copy opens a prefilled New transaction form so the user can change fields before saving.
- Saved copies become distinct transactions with new IDs and timestamps while preserving edited values, splits, transfer details and exchange-rate snapshots.
- **Verification:** JavaScript syntax checks and source inspection.

### 2026-10-14 — Modal form cancel cleanup

- Removed redundant Cancel buttons from modal data-entry forms.
- Kept the top-right modal close button as the single form dismissal control.
- Left confirmation-dialog Cancel actions intact for destructive flows.
- **Verification:** JavaScript syntax checks and source inspection.

### 2026-10-14 — Transaction copy date choice

- Added a copy choice step for edited transactions.
- Users can copy with the current date and time or keep the original transaction date and time.
- The chosen option opens the usual prefilled New transaction form before saving.
- **Verification:** JavaScript syntax checks and source inspection.

### 2026-10-14 — Export filename timestamps

- Updated JSON backup and CSV transaction export filenames to include local hours, minutes and seconds.
- Export names now use `flow-backup-YYYY-MM-DD-HHMMSS.json` and `flow-transactions-YYYY-MM-DD-HHMMSS.csv`.
- **Verification:** JavaScript syntax checks and source inspection.

### 2026-10-14 — Account ordering and compact rows

- Replaced large account cards with compact rows grouped by account type.
- Added persisted up/down ordering controls for accounts within each type group.
- Applied the custom account order to account dropdowns and the Home account preview.
- **Verification:** JavaScript syntax checks and source inspection.

### 2026-10-14 — Account action confirmations

- Removed account deletion from the Accounts list rows.
- Added account deletion to the edit account modal, preserving the existing transaction safety check.
- Added confirmation dialogs before archiving or restoring an account.
- **Verification:** JavaScript syntax checks and source inspection.

### 2026-10-14 — Account picker ordering

- Preserved the custom account order in transaction and recurring transaction account selectors.
- Transfer destination selectors now follow the same account order as the Accounts page.
- **Verification:** JavaScript syntax checks and source inspection.

### 2026-10-14 — Number input stepper prevention

- Hid browser number-input increment and decrement controls.
- Prevented focused modal number fields from changing via mouse wheel or Arrow/Page keys.
- **Verification:** JavaScript syntax checks and source inspection.

### 2026-10-14 — Numeric amount keyboards

- Added explicit decimal input keyboard hints to amount, budget, opening balance, split, transfer received, recurring amount and exchange-rate fields.
- Decimal fields now use text inputs with decimal keyboard hints so comma decimals are accepted consistently.
- **Verification:** JavaScript syntax checks and source inspection.

### 2026-10-13 — Transaction deletion placement

- Removed the delete action from transaction list rows.
- Added transaction deletion to the edit transaction modal so deletion requires opening the record first.
- **Verification:** JavaScript syntax checks and source inspection.

### 2026-10-13 — Modal bottom spacing

- Added consistent bottom padding to scrollable modal bodies so content-only modals do not end flush against the sheet edge.
- Preserved compact spacing for modals whose final row is an action footer.
- **Verification:** CSS source inspection.

### 2026-10-13 — Transaction list display

- Replaced inline transaction descriptions in list rows with a compact clickable `Note` badge and popover.
- Added a hover state to make the `Note` badge read as clickable.
- Fixed the open `Note` badge hover contrast so white text is not shown on a pale background.
- Preserved multiline description formatting inside the note popover.
- Kept descriptions stored, editable and searchable.
- **Verification:** JavaScript syntax checks.

### 2026-10-13 — App install name

- Changed the document title and install metadata to use `Flow`.
- **Verification:** Source inspection.

### 2026-10-13 — Search filter contrast

- Made unselected transaction category filters faded and grayscale.
- Kept selected category filters full opacity with category-colored outlines and icons.
- **Verification:** JavaScript syntax checks and source inspection.

### 2026-10-13 — Transaction search panel

- Added a dedicated search section to the Transactions page.
- Added multi-select category and subcategory filtering with OR matching across selected filters.
- Separated expense and income filters in the search view and made both groups collapsed by default.
- Kept the category UI compact by showing parent badges first and expanding subcategories only on demand.
- Parent category filters include all subcategories and split transactions when any split belongs to the selected category.
- Search period navigation now switches between month, week and year controls and is hidden for all-history search.
- **Verification:** JavaScript syntax checks and source inspection.

### 2026-10-13 — App logo

- Added the local `logo.png` asset to the sidebar and mobile header brand mark.
- Added `logo.png` as the browser favicon and Apple touch icon.
- **Verification:** Source inspection and referenced file checks.

### 2026-10-15 — Logo background fix

- Removed the decorative box shadow around the sidebar and mobile header logo.
- Preserved the original logo size and white container background.
- **Verification:** Reviewed the CSS diff and ran `git diff --check`. Browser appearance was not verified.

### 2026-10-13 — Hidden form rows

- Fixed hidden modal fields so CSS form layout does not override the `hidden` attribute.
- The transaction exchange-rate field now stays hidden for EUR accounts instead of showing `Exchange rate: 1 EUR = EUR`.
- **Verification:** JavaScript syntax checks and source inspection.

### 2026-10-13 — Transaction search

- Added transaction search on the Transactions page.
- Search matches payee/place and description/note text within the selected period and account filter.
- Added search period filters for monthly, weekly, yearly and all-history search.
- Kept the search term in local UI state and preserved cursor position while filtering.
- Updated search behavior so filtering starts at 2 characters, one-character input does not narrow results and blank input clears the search state.
- **Verification:** JavaScript syntax checks.

### 2026-10-13 — Multiline transaction descriptions

- Changed transaction descriptions to a multiline textarea.
- Preserved description line breaks in transaction list details.
- Normalized generated import JSON descriptions with readable line breaks for known imported note patterns.
- **Verification:** JavaScript syntax checks and JSON import validation.

### 2026-10-13 — Compact exchange-rate snapshots

- Changed transaction exchange-rate snapshots to store only the currencies involved in that transaction plus the base currency.
- Compacted JSON export so older full-rate transaction snapshots are reduced during backup export.
- Updated the generated import JSON to remove repeated unrelated currencies from each transaction snapshot.
- **Verification:** JavaScript syntax checks and JSON import validation.

### 2026-10-13 — Category option sorting

- Sorted income and expense categories and subcategories in transaction selectors.
- Reused the same ordering in category management so edit and select views match.
- Ordering uses `sortOrder` when present, then category or subcategory name.
- Added user-defined up/down ordering controls for categories and subcategories, persisted as `sortOrder`.
- **Verification:** JavaScript syntax checks.

### 2026-10-13 — Statistics account filter visibility

- Added the account selector to the Statistics page so the active account filter is visible and changeable there.
- Displayed the selected account context in the net cash flow summary.
- **Verification:** JavaScript syntax checks.

### 2026-10-13 — Subcategories in transactions

- Added one-level subcategories stored under income and expense categories.
- Updated transaction and split forms so users can select either a parent category or a subcategory.
- Display category/subcategory paths in transaction history and expense statistics.
- Prevent removing subcategories that are already referenced by transactions or splits.
- Added subcategory data to JSON backups through the existing category records and added a CSV subcategory column for ordinary transactions.
- **Verification:** JavaScript syntax checks.

### 2026-10-13 — Category management grouping

- Separated category management into Expense categories and Income categories sections.
- Added per-section creation buttons that preselect the correct category type.
- Preserved existing edit/delete behavior and safeguards for categories referenced by transactions.
- Added automatic focus to the first editable modal field, with a fallback to the first modal action.
- **Verification:** JavaScript syntax checks.

### 2026-10-13 — Modal mobile layout

- Reduced excess modal header spacing on mobile and desktop.
- Kept modal action buttons inside the scrollable form content with mobile safe-area padding.
- Normalized form control sizing and iOS native date/time/select appearance so transaction fields align consistently in Safari.
- **Verification:** JavaScript syntax checks passed; browser automation was unavailable in this environment, so visual verification was limited to source inspection.

### 2026-10-13 — Transaction detail fields

- Added transaction time, payee and description fields to the implementation and documented transaction model.
- Added payee reuse suggestions from existing transaction and recurring payees.
- Renamed the previous note behavior to description while preserving existing `note` values as legacy fallback data.
- **Verification:** JavaScript syntax checks and source search for updated transaction/export paths.

### 2026-10-13 — Specification v1.0

- Consolidated agreed product scope, navigation, blue design, financial rules and excluded features.
- Added a conservative feature tracker pending repository audit.
- Added acceptance tests, agent update workflow and unresolved architectural decisions.
- **Verification:** documentation only; no claim of current implementation completeness.

---

**Documentation rule:** After every meaningful development task, keep this README synchronized with the actual code. A feature is only `Implemented` when it has been verified, not merely requested.
