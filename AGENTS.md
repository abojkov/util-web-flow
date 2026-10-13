# AGENTS.md — Money Manager

## 1. Project Overview

Money Manager is a modern, mobile-first, fully offline personal finance application inspired by Realbyte Money Manager.

The application allows users to manage accounts, income, expenses, transfers, budgets, recurring transactions, and financial statistics.

The application must have its own original design and implementation.

## 2. Technology Stack

- HTML5
- CSS3
- Vanilla JavaScript
- IndexedDB for persistent data
- No frontend frameworks
- No backend or database server
- No build tools or compilation
- No external CDN dependencies
- No npm dependencies unless explicitly approved

### Execution Requirements

The application must be directly openable by opening `index.html` in a browser.

- Do not require localhost or an HTTP server.
- Do not use ES module imports that may fail under `file://`.
- Prefer classic JavaScript scripts with explicit dependency ordering.
- Keep all assets and dependencies local.
- Do not introduce runtime network requests.
- Document browser-specific limitations, particularly IndexedDB persistence under `file://`.

## 3. Architecture

Maintain a modular, maintainable codebase.

Recommended structure:

```text
/
├── index.html
├── css/
│   ├── variables.css
│   ├── layout.css
│   └── components.css
├── js/
│   ├── app.js
│   ├── db.js
│   ├── storage.js
│   ├── accounts.js
│   ├── transactions.js
│   ├── categories.js
│   ├── budgets.js
│   ├── statistics.js
│   └── ui.js
└── AGENTS.md
```

Keep database operations, business logic, and UI rendering separated.

Avoid unnecessary global variables, duplicated code, and tightly coupled components.

Do not introduce architectural complexity without a clear benefit.

## 4. Design System

The application uses a premium, modern blue-and-white design.

### Appearance

- Light mode only.
- Blue as the primary accent color.
- White and very light gray backgrounds.
- Subtle borders and shadows.
- Rounded cards, inputs, and modals.
- Clean typography and consistent spacing.
- Modern financial dashboard aesthetics.

### UX Requirements

- Mobile-first, optimized for iPhone.
- Fully responsive on desktop and tablet.
- Bottom navigation on mobile.
- Sidebar navigation on desktop when appropriate.
- Touch-friendly buttons and inputs.
- Consistent spacing and alignment.
- Clear empty states.
- Accessible labels and meaningful error messages.
- Custom confirmation dialogs instead of browser `alert()` and `confirm()` where practical.

### Navigation

Five primary sections:

1. Home
2. Transactions
3. Statistics
4. Accounts
5. More

Do not add new primary navigation tabs without approval.

## 5. Financial Accounts

Supported account types:

- Cash
- Bank accounts
- Savings accounts
- Investment accounts
- Loan accounts
- Custom account types

Credit cards are explicitly excluded.

### Account Rules

- Every account has a currency.
- EUR is the default currency.
- Accounts can have an opening balance.
- Accounts can be archived and restored.
- Archived accounts retain their complete transaction history.
- Archived accounts are excluded from active-account totals by default.
- Accounts with existing transactions must not be deleted without an explicit safe data-handling strategy.
- Do not implement manual balance adjustments.

Balances must be calculated consistently from opening balances and recorded transactions.

## 6. Multi-Currency Support

Support multiple currencies, including EUR, USD, GBP, CHF, and MKD.

- Every account has a native currency.
- Users can select a base reporting currency.
- Transfers between currencies must support explicit exchange rates.
- Preserve the original amounts and conversion information.
- Do not silently apply fabricated exchange rates.
- Historical calculations must use a documented, consistent conversion policy.
- Avoid floating-point errors in financial calculations.
- Prefer integer minor units or an appropriate exact-decimal strategy.

## 7. Transactions

Support three transaction types:

- Income
- Expense
- Transfer

### Transaction Fields

- Unique ID
- Type
- Amount
- Date
- Account
- Category and optional subcategory
- Description or notes
- Optional attachments
- Created and updated timestamps

Transfers must identify both source and destination accounts.

### Business Rules

- Income increases the account balance.
- Expenses decrease the account balance.
- Transfers decrease the source account and increase the destination account.
- Transfers must not be counted as ordinary income or expenses.
- Do not double-count transactions.
- Validate amounts, dates, accounts, and category relationships.
- Use atomic IndexedDB transactions when updating related records.

### Split Transactions

Support splitting income and expenses into multiple categories.

- A split transaction remains one financial transaction.
- Each split has its own category, optional subcategory, amount, and description.
- Split amounts must sum exactly to the transaction total.
- Account balances must only change by the transaction total.
- Statistics and budgets must use individual split amounts.
- Transfers cannot be split.

## 8. Categories

Support customizable income and expense categories.

- Unlimited custom categories and subcategories.
- Custom icons and colors.
- Create, edit, delete, and reorder.
- Optional starter categories.
- Prevent deletion from silently corrupting historical transactions.
- Preserve category relationships in reports and backups.

## 9. Budgets

Support:

- Overall monthly budgets.
- Category-specific monthly budgets.
- Spending progress.
- Remaining amounts.
- Overspending indicators.
- Historical budget comparisons.

### Budget Rules

- Budgets reset independently each month.
- No budget carry-over.
- Unused amounts do not transfer to the following month.
- Overspending does not reduce future budgets.
- Split transactions contribute to their respective categories.
- Transfers are excluded from expense budgets.

## 10. Recurring Transactions

Support recurring income and expenses.

Frequencies:

- Daily
- Weekly
- Monthly
- Yearly

Requirements:

- Optional start and end dates.
- Pause and resume.
- Edit and delete recurring rules.
- Avoid duplicate generated transactions.
- Process due occurrences when the application opens.
- Handle missed occurrences deterministically.
- No background server or scheduler is required.

## 11. Dashboard

The Home dashboard displays:

- Combined active-account balance.
- Monthly income.
- Monthly expenses.
- Net cash flow.
- Quick transaction actions.
- Spending breakdown.
- Recent transactions.
- Account filter.
- Month navigation.

All Accounts is the default filter.

Combined balances use the selected base currency. Individual account views use the account's native currency.

## 12. Statistics

Support:

- Daily, weekly, monthly, yearly, and custom date ranges.
- Income versus expenses.
- Expense distribution by category.
- Category and subcategory breakdowns.
- Donut charts.
- Bar charts.
- Financial trends.
- Account balance history.
- Budget performance.
- Account and category filters.

Do not implement a dedicated net-worth dashboard unless requested.

## 13. Data Persistence

IndexedDB is the primary data store.

LocalStorage may be used for nonessential preferences only.

### Database Requirements

- Version the IndexedDB schema.
- Use safe, incremental migrations.
- Never delete existing financial records during schema upgrades.
- Handle asynchronous operations and errors.
- Preserve referential integrity in application logic.
- Avoid unnecessary full-database reads.
- Use indexes for common queries.
- Do not silently fall back to temporary in-memory storage when persistent storage fails.

### Initial State

The application must start with:

- No accounts.
- No transactions.
- No budgets.
- No financial records.

Optional starter categories are allowed.

Never populate the database with demo transactions or fictional balances.

## 14. Import and Export

Support:

- Complete JSON backup.
- JSON restoration.
- CSV transaction export.
- CSV transaction import.
- Column mapping.
- Import validation.
- Duplicate detection.

Backups must preserve IDs, relationships, currencies, and settings.

Validate imported data before modifying the database.

Never overwrite existing data without explicit user confirmation.

## 15. Security

Support an optional application PIN lock.

- Disabled by default.
- Four- or six-digit PIN.
- Configurable auto-lock.
- Change and disable PIN after verification.
- Temporary delays after repeated failed attempts.
- Do not store plaintext PINs.
- Do not claim that a PIN screen encrypts IndexedDB.
- Treat actual encryption as a separate feature requiring appropriate key management.

Do not use third-party analytics or transmit financial information externally.

## 16. Code Quality

When implementing changes:

- Read the relevant existing code first.
- Follow established project conventions.
- Prefer small, focused modifications.
- Do not rewrite unrelated files.
- Avoid unnecessary dependencies.
- Avoid duplicated business logic.
- Use descriptive variable and function names.
- Handle errors explicitly.
- Use reusable functions and components.
- Keep functions focused and testable.
- Avoid introducing regressions.

Use comments to explain non-obvious business rules, not trivial syntax.

## 17. Testing

Before completing a task:

- Check JavaScript syntax.
- Verify that referenced files exist.
- Check script dependency ordering.
- Validate relevant financial calculations.
- Test empty states.
- Test invalid inputs.
- Test create, edit, and delete flows where applicable.
- Verify that records persist after page reload.
- Check responsive behavior when browser testing is available.
- Check that no runtime network dependencies were introduced.

Never claim a feature was tested unless it was actually tested.

## 18. Git and Change Management

- Keep changes small and reviewable.
- Do not modify unrelated files.
- Do not reformat entire files unnecessarily.
- Preserve existing user data.
- Do not create Git commits unless explicitly requested.
- Do not force-push or rewrite Git history.
- Do not delete untracked files without approval.

## 19. Explicitly Excluded Features

Do not implement these unless the user explicitly changes the requirements:

- Credit cards or credit card billing.
- Manual balance adjustments.
- Budget carry-over.
- Dark mode.
- Dedicated net-worth dashboard.
- Backend servers.
- Mandatory user accounts or cloud authentication.
- Cloud synchronization.
- External analytics or tracking.

##20. Documentation Maintenance

Treat README.md as the living product specification
and source of truth for application functionality.

Whenever you implement a feature, modify existing
functionality, change the database schema, or fix
a bug affecting documented behavior:

- Update the relevant README.md sections.
- Update feature implementation statuses.
- Document new functionality and business rules.
- Update acceptance criteria when necessary.
- Add an entry to the changelog.
- Keep documentation consistent with actual code.
- Never mark a feature as implemented unless verified.
- Do not remove planned features without approval.

Documentation updates are part of completing a task,
not a separate optional step.

## 21. Codex Working Instructions

For every task:

1. Inspect relevant files and understand the current implementation.
2. Identify the smallest safe set of changes.
3. Preserve existing functionality and the blue design.
4. Implement the requested change.
5. Run available relevant validation.
6. Review the Git diff.
7. Summarize what changed.
8. Report what was tested and what could not be tested.
9. Mention any remaining limitations or follow-up work.

Do not implement unrelated features or make major architectural decisions without approval.

The highest priorities are financial correctness, data integrity, offline compatibility, usability, and maintainability.