# Flow Money Manager

> A modern, blue-themed, mobile-first, offline personal finance application built with HTML, CSS, vanilla JavaScript, and IndexedDB.

**Project status:** Active development
**Specification version:** 1.0
**Last specification update:** 2026-10-13
**Implementation status:** Not audited against the current local repository. Feature descriptions below are requirements, not assertions that the feature works.

## Table of contents

1. [Vision and scope](#vision-and-scope)
2. [Core user journey](#core-user-journey)
3. [Navigation and design](#navigation-and-design)
4. [Functional requirements](#functional-requirements)
5. [Financial business rules](#financial-business-rules)
6. [Data model](#data-model)
7. [Technical architecture](#technical-architecture)
8. [Privacy, security, and backups](#privacy-security-and-backups)
9. [Non-goals](#non-goals)
10. [Development roadmap and feature tracker](#development-roadmap-and-feature-tracker)
11. [Acceptance criteria and test scenarios](#acceptance-criteria-and-test-scenarios)
12. [Agent documentation workflow](#agent-documentation-workflow)
13. [Decisions and open questions](#decisions-and-open-questions)
14. [Change log](#change-log)

## Vision and scope

Flow Money Manager is an original personal finance app inspired by the functionality of Realbyte Money Manager, not a reproduction of its proprietary assets or interface. It helps one user track financial accounts, income, expenses, transfers, budgets, recurring activity, and statistics. The app must run locally without a backend, user registration, subscription, or runtime internet connection.

**Principles:** financial correctness; user-owned data; dependable offline behavior; excellent mobile usability; clear reporting; small, reviewable changes.

**First-run state:** no accounts, transactions, balances, or budgets. Optional starter categories are acceptable. No demo financial data.

## Core user journey

1. Open `index.html` directly in a supported browser.
2. Choose a base reporting currency (EUR by default).
3. Create one or more accounts with native currencies and opening balances.
4. Record income, expenses, and transfers; optionally split income or expenses across categories.
5. Review account balances, transaction history, and calendar.
6. Set independent monthly overall and category budgets.
7. Inspect charts and filter by date, account, category, and currency.
8. Configure recurring entries and optionally a PIN lock.
9. Export a JSON backup or CSV file; restore/import with validation.

## Navigation and design

### Main navigation

| Tab | Purpose |
| --- | --- |
| Home | Balance overview, monthly cash flow, quick actions, spending chart, recent transactions |
| Transactions | Add/edit/delete, chronological history, calendar, search and filters |
| Statistics | Spending distribution, income/expense comparisons, trends and reports |
| Accounts | Balances, account creation/editing, archiving and restoration |
| More | Categories, budgets, recurring rules, currencies, security, import/export, settings |

### Visual direction

- **Light mode only**; premium blue-and-white visual identity.
- White and pale blue/gray surfaces, clear typography, restrained shadows, rounded cards and controls.
- Mobile-first, optimized for iPhone; fixed bottom navigation on mobile and optional sidebar on desktop.
- Touch-friendly targets, aligned forms, consistent spacing, responsive modals, accessible labels, clear empty/error/loading states.
- Never reintroduce the earlier orange theme or add dark mode without approval.

## Functional requirements

> **Status legend:** `Planned` = agreed requirement, not yet verified as implemented; `In progress` = actively being built; `Implemented` = confirmed in source and tested; `Blocked` = cannot proceed yet. See the feature tracker for the current status. This section describes intended behavior.

### Home dashboard

- Default filter: **All Accounts**; optionally select a single account.
- Current combined balance of active accounts in base reporting currency (EUR default).
- Monthly income, expenses, and net cash flow (`income − expenses`).
- Quick actions for income, expense, and transfer.
- Spending-by-category donut chart and recent transactions.
- Month navigation for historical income/expense activity.
- **Important:** current account balance is not the same as income/expenses for the selected month.
- Individual-account views display amounts in that account's native currency.

### Accounts

Supported types: cash, bank, savings, investment, loan, and custom. **Credit cards are excluded.**

Account fields: unique ID, name, type, native currency, opening balance, optional description, icon/color, archived flag, created/updated timestamps.

- Create, edit, list, archive, and restore accounts.
- An archived account is not available for new ordinary transactions and is excluded from the current *active-account* total by default; historical transactions and reports remain available.
- Prevent unsafe deletion of accounts referenced by transactions.
- Account balance is derived from opening balance and transaction ledger; **no manual balance adjustment feature**.
- Investment accounts initially record manual cash flows, not live market values.
- Loan-account sign convention and repayment behavior must be defined before implementing specialized loan calculations (see open questions).

### Transactions

Three types:

| Type | Effect |
| --- | --- |
| Income | Increase selected account balance; count toward income reporting |
| Expense | Decrease selected account balance; count toward expense reporting and relevant budgets |
| Transfer | Decrease source and increase destination; exclude from ordinary income/expense and budgets |

Core fields: ID, type, amount, date, time, source account, optional destination account and received amount, category/subcategory where applicable, payee, description, optional attachment references, created/updated timestamps.

- Create, edit, delete, list, search, filter, and inspect transaction details.
- Payee inputs should suggest previously used payees as the user types using an app-rendered suggestion list that works in mobile Safari.
- Support daily/calendar, weekly, monthly, and chronological review.
- Filter by date range, account, type, category, and search text.
- Validate positive amounts, valid account/category references, dates, and transfer endpoints.
- Changes must consistently update all dependent balances, charts, and budgets.
- Deletions must be intentional and confirmable.

#### Split transactions

- Allow income and expense transactions to contain multiple category allocations.
- Each split has a category, optional subcategory, amount, and optional description.
- Sum of split amounts **must exactly equal** the parent transaction amount.
- The account ledger records the parent total once; category reports and budgets use split allocations.
- Transfers cannot be split.

### Multi-currency

- Each account has one native currency; base reporting currency is configurable (EUR default).
- Support ISO currencies including EUR, USD, GBP, CHF, MKD, with correct decimal precision.
- Cross-currency transfers store the exact source amount, destination amount, conversion rate, and optional fee.
- Manual exchange-rate entry in Settings; automatic rates are not required and must not be fabricated.
- Combined reporting uses a documented conversion policy; if a required rate is unavailable, show an explicit unavailable/incomplete state rather than an invented amount.
- Non-base-currency transaction forms show the estimated base-currency reporting value and include an editable transaction-level exchange rate initialized from Settings.
- Transactions keep an exchange-rate snapshot so historical reports do not silently change when Settings rates are updated later.
- All-accounts current balance estimates convert each active account's current native balance using the current configured rates in Settings.
- Historical transaction reports use transaction exchange-rate snapshots so old transaction values do not silently change when Settings rates are updated later.
- Settings show editable local reference rates for currencies used in the app and the conversion formula.
- Preserve original values and historical conversion information.
- Use integer minor units where appropriate or an exact decimal strategy; avoid ordinary JS floating-point math for money.

### Categories and subcategories

- Unlimited custom income and expense categories and nested subcategories (one subcategory level initially).
- Custom names, icons, colors, and ordering.
- Optional editable starter categories; no seeded financial records.
- Prevent deletion or reassignment from silently corrupting historical records.

### Budgets

- Overall monthly expense budget and category-specific monthly budgets.
- Display spent, remaining, percentage used, and overspending warning.
- Split expenses contribute to their corresponding category budgets.
- Transfers and income do not count as spending.
- **No carry-over:** unused budget and overspending do not affect the next month.
- Preserve previous months' budgets and actuals for comparison.

### Recurring transactions

- Recurring **income and expense** rules (not recurring transfers initially).
- Daily, weekly, monthly, and yearly frequencies.
- Start date, optional end date, amount, account, category, active/paused state.
- When opened, process due occurrences deterministically, including missed dates, with duplicate prevention.
- Support pause, resume, edit, and cancel; distinguish edits to one generated occurrence from future rule changes.
- No background processing while the HTML app is closed; reminders depend on browser support and are not promised.

### Statistics and reports

- Daily, weekly, monthly, yearly, and custom date ranges.
- Donut chart for expense categories; drill down to subcategories.
- Bar charts comparing income and expenses across periods.
- Trend charts and account balance history.
- Budget progress and historical comparisons.
- Filter by account, category, period, and reporting currency.
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
10. **Reporting clarity:** distinguish total assets/active balances, monthly cash flow, and liabilities; do not sum debt as positive wealth without defined semantics.

## Data model

Proposed logical IndexedDB object stores (validate against actual implementation before modifying):

```text
accounts
  id, name, type, currency, openingBalance, archived,
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

Schema details are illustrative, not authoritative. Prefer indexed lookups on dates, account IDs, category IDs, and recurrence identifiers. Maintain a schema version and incremental, non-destructive migrations.

## Technical architecture

- HTML5, CSS3, vanilla JavaScript, IndexedDB.
- No framework, bundler, npm install, backend, external CDN, or runtime network dependency.
- The app must be **directly openable via `index.html`**, without a local HTTP server.
- For `file://` compatibility, avoid ES module imports; use classic scripts in a documented dependency order.
- Separate database operations, financial domain logic, UI rendering, and event handling into maintainable files.
- Keep all assets local, and avoid accidental network requests.
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

## Privacy, security, and backups

### Privacy

All financial records stay on-device by default. No cloud sync, account login, third-party analytics, or transmission of financial information.

### Optional PIN lock

- Disabled by default; 4- or 6-digit PIN, inactivity timeout, change/disable after verification, and retry delays.
- Never store the plaintext PIN; use an appropriate password-derived verifier.
- **A PIN gate does not encrypt IndexedDB.** Do not market it as encryption or protection from users with local storage access. Encryption at rest would require a separate design and recovery policy.

### JSON backup and restore

- Export accounts, transactions, splits, categories, budgets, recurring rules, exchange rates, settings, and supported attachments.
- Include backup format version, export timestamp, and integrity/validation metadata.
- Validate backup structure and references before import; do not overwrite without explicit confirmation.
- Document whether restoration replaces or merges data; avoid accidental duplicate records.

### CSV

- Export transactions in spreadsheet-compatible format with dates, account/currency, categories, splits, and transfer representation documented.
- Import transactions using column mapping, validation, preview, and duplicate detection.
- Do not claim CSV contains a complete application backup.

## Non-goals

Explicitly excluded unless the product owner changes the requirements:

- Credit cards, statements, credit limits, and credit-card installments.
- Manual balance adjustments.
- Budget carry-over.
- Dark mode or system theme switching.
- Dedicated net-worth dashboard.
- Backend server, mandatory accounts, cloud sync, or bank API connections.
- Online-only functionality or mandatory internet access.

## Development roadmap and feature tracker

**Important:** This tracker begins conservatively because the current local Git code has not been audited. An agent must inspect and test the implementation before changing a feature to `Implemented`.

| ID | Area | Feature | Status | Verification notes |
| --- | --- | --- | --- | --- |
| F01 | Foundation | Direct-open offline HTML application | Planned | Verify on target browsers |
| F02 | Foundation | Modular CSS and JavaScript | Planned | Inspect script order |
| F03 | Foundation | Versioned IndexedDB persistence | Planned | Reload and migration tests |
| F04 | Design | Responsive premium blue light UI | Planned | Mobile and desktop review |
| F05 | Navigation | Five primary sections | Planned | All routes/actions functional |
| F06 | Accounts | Create/edit accounts and opening balances | Planned | Balance tests |
| F07 | Accounts | Archive and restore accounts | Planned | Historical data preserved |
| F08 | Currency | Native currencies and base reporting currency | Planned | Rate handling verified |
| F09 | Currency | Cross-currency transfers | Planned | Both ledger sides verified |
| F10 | Transactions | Income, expenses, transfers CRUD | Planned | CRUD and totals tested |
| F11 | Transactions | Split transactions | Planned | Exact allocation sums |
| F12 | Transactions | History, calendar, search and filters | Planned | Date/filter edge cases |
| F13 | Categories | Custom categories, subcategories, icons, colors | In progress | Reference safety |
| F14 | Budgets | Overall and category monthly budgets | Planned | No carry-over |
| F15 | Recurring | Recurring income and expenses | Planned | Idempotent catch-up |
| F16 | Statistics | Donut, bar, trends, drilldowns | Planned | Reconcile with ledger |
| F17 | Data | Complete JSON backup and restore | Planned | Round-trip test |
| F18 | Data | CSV export and import | Planned | Mapping/duplicates |
| F19 | Security | Optional PIN lock | Planned | Clear security limitations |
| F20 | Quality | Error states, accessibility, responsive QA | Planned | Browser verification |

### Release phases

1. **Foundation:** F01–F05.
2. **Financial core:** F06–F11 and F13.
3. **History and analytics:** F12, F16.
4. **Budgets and automation:** F14–F15.
5. **Data management and security:** F17–F19.
6. **Stabilization:** F20, financial edge cases, migration/restore testing.

## Acceptance criteria and test scenarios

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

1. **Read** `AGENTS.md`, this README, and the relevant implementation before coding.
2. **Identify scope**: which requirements and feature IDs are affected.
3. **Implement narrowly**, preserving financial data and unrelated behavior.
4. **Test** the affected flow and financial calculations; distinguish automated tests from manual verification.
5. **Update this README in the same change** if functionality, architecture, data model, constraints, status, or user-facing behavior changed.
6. **Update the feature tracker** only when code evidence and appropriate verification justify the new status; do not mark a feature implemented just because a UI placeholder exists.
7. **Update acceptance criteria** when new rules or edge cases are introduced.
8. **Record product decisions** and any unresolved questions below.
9. **Append a concise change-log entry** with date, affected feature IDs, summary, and verification.
10. **Report** what changed, what was tested, what remains incomplete, and any storage/migration risks.

Do not erase agreed requirements simply because they are not implemented. Do not claim tests were run if they were not. Do not silently change excluded features. Keep documentation accurate and readable; avoid wholesale rewrites for small changes.

**Suggested one-time Codex instruction to add to `AGENTS.md`:**

> Treat README.md as the living product specification. For every feature addition, behavior change, bug fix affecting documented behavior, schema change, or status change, update the relevant README sections, feature tracker, acceptance criteria, and change log in the same task. Never mark a feature implemented without verifying it against the code and tests.

### Initial repository audit task

Before treating any feature as complete, ask Codex:

> Audit the current repository against README.md. Do not implement new features. For each feature ID, identify the implementation files and whether the feature is functional, partial, absent, or unverified. Update the feature tracker with evidence and accurate statuses, then summarize the highest-priority gaps. Do not delete existing data or make unrelated changes.

## Decisions and open questions

### Confirmed decisions

| Decision | Choice |
| --- | --- |
| App name | Flow Money Manager |
| Design | Blue and white, light only |
| Runtime | Direct-open local HTML, no server |
| Stack | Vanilla HTML/CSS/JS + IndexedDB |
| Default base currency | EUR |
| Accounts | Cash, bank, savings, investment, loan, custom |
| Credit cards | Excluded |
| Account archiving | Included |
| Manual balance adjustments | Excluded |
| Split income/expenses | Included |
| Category icons/colors | Included |
| Recurring income/expenses | Included |
| Monthly budget carry-over | Excluded |
| Dedicated net worth | Excluded initially |
| Backups | JSON backup/restore + CSV import/export |
| App lock | Optional PIN |
| Navigation | Home, Transactions, Statistics, Accounts, More |

### Open questions requiring a future decision

- How should loan accounts represent liabilities, repayments, and interest?
- How should investment valuations be entered without manual balance adjustments?
- Which rate/date convention should historical multi-currency reporting use, and how should missing rates be handled?
- Should archived accounts count in historical all-account balance snapshots even when excluded from current active totals?
- What are the exact semantics of recurring edits to one occurrence versus future occurrences?
- Should JSON restoration support merge, replace, or both, and how are conflicts resolved?
- Which browser/OS combinations are officially supported for direct `file://` IndexedDB persistence?
- Should a forgotten PIN allow reset without deleting data, given that the PIN is not encryption?

## Change log

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

- Added transaction time, payee, and description fields to the implementation and documented transaction model.
- Added payee reuse suggestions from existing transaction and recurring payees.
- Renamed the previous note behavior to description while preserving existing `note` values as legacy fallback data.
- **Verification:** JavaScript syntax checks and source search for updated transaction/export paths.

### 2026-10-13 — Specification v1.0

- Consolidated agreed product scope, navigation, blue design, financial rules, and excluded features.
- Added a conservative feature tracker pending repository audit.
- Added acceptance tests, agent update workflow, and unresolved architectural decisions.
- **Verification:** documentation only; no claim of current implementation completeness.

---

**Documentation rule:** After every meaningful development task, keep this README synchronized with the actual code. A feature is only `Implemented` when it has been verified, not merely requested.
