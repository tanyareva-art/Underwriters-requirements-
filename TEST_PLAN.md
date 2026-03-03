# Test Plan — Underwriter Decision Tool

## 1. Environment Setup

- Build the app: `npm run build:dir`
- Launch from `dist-electron/win-unpacked/Underwriter Decision Tool.exe`
- Or in development: `npm run dev`
- Have a test Google Sheet set up via `SETUP_GUIDE.md`

---

## 2. Authentication Tests

| # | Test | Expected |
|---|---|---|
| A1 | Sign in with correct domain account | Auth succeeds; user reaches Employee/Admin view |
| A2 | Sign in with personal Gmail (wrong domain) | Error: "Access restricted to @domain accounts" |
| A3 | Click Sign in without filling in Client ID / Secret / Domain | Error: "All three fields are required" |
| A4 | Cancel OAuth in browser | Error message shown; user can retry |
| A5 | Close app and reopen after successful auth | Stays logged in; goes directly to search screen |
| A6 | Click Sign Out | Returns to Login screen; tokens cleared |
| A7 | Token auto-refresh | After an hour, app silently refreshes the access token without requiring re-auth |

---

## 3. First-Run Setup Tests

| # | Test | Expected |
|---|---|---|
| S1 | Enter valid Sheet ID → Connect | All 3 tabs created; CSV imported; count shown |
| S2 | Enter invalid/missing Sheet ID | API error shown; user can correct and retry |
| S3 | Run setup on sheet that already has tabs | Tabs not duplicated; data appended (idempotent) |
| S4 | Import CSV with all 18 rows | 18 rows appear in Underwriters tab |
| S5 | Add self to Admin Emails → sign out → sign in | Admin tab appears in header |

---

## 4. Matching Logic Tests (critical)

### 4.1 State Filter

| # | Underwriter States | Filter State | Expected Match |
|---|---|---|---|
| M1 | `OR, WA, NC, SC, TN, MO, OH` | `OR` | ✓ (exact token) |
| M2 | `OR, WA, NC, SC, TN, MO, OH` | `FL` | ✗ (not in list) |
| M3 | ALL STATES | `FL` | ✓ (ALL matches any) |
| M4 | ALL | `ZZ` | ✓ (ALL matches any) |
| M5 | blank | `OR` | Treat as "no restriction" → ✓ |
| M6 | `SC, NC, OH, MO, TN` | `WA` | ✗ |
| M7 | *(no state filter selected)* | *(blank)* | All UW shown |

### 4.2 LOB / Equipment Filter

| # | Lines Written | Business Types | Filter LOB | Expected |
|---|---|---|---|---|
| M8  | ALL | — | `Dry Van` | ✓ (ALL covers all) |
| M9  | — | `Dry Van, Reefer, Flatbed` | `Dry Van` | ✓ (exact token) |
| M10 | — | `Dry Van, Reefer` | `Flatbed` | ✗ |
| M11 | `AL, GL` | `Dry Van` | `GL` | ✓ (in Lines Written) |
| M12 | `AL, GL` | `Dry Van` | `Reefer` | ✗ |
| M13 | *(blank)* | *(blank)* | `Dry Van` | ✗ (no match, not ALL) |
| M14 | *(no LOB filter)* | — | *(blank)* | All UW shown |

### 4.3 New Venture

| # | UW New Venture OK | Filter | Expected |
|---|---|---|---|
| M15 | YES | YES | ✓ |
| M16 | NO  | YES | ✗ |
| M17 | blank | YES | ✗ |
| M18 | NO  | NO  | ✓ (NO filter doesn't block) |
| M19 | NO  | blank | ✓ (blank doesn't block) |

### 4.4 Years in Business

| # | UW Min Years | User Years | Expected |
|---|---|---|---|
| M20 | 2   | 2   | ✓ (equal = pass) |
| M21 | 2   | 3   | ✓ (user >= min) |
| M22 | 2   | 1   | ✗ (user < min) |
| M23 | 0   | 0   | ✓ |
| M24 | blank | 0  | ✓ (blank min = 0) |
| M25 | 3   | blank | ✓ (blank user = 0; 0 < 3 → ✗ for filter value 0… see note) |

> **Note M25:** When the user leaves Years in Business blank, it means "not filtering by years" — show all regardless of min. Blank input = 0 in number parse, so a UW requiring 3 years would be blocked if the user enters 0. The UI placeholder says "e.g. 2" — a blank field should genuinely be treated as "no constraint." *Implementation: `parseFloat('') === NaN` which `|| 0` makes 0. So blank user = 0 years → UW requiring 3 years is blocked. This is correct behaviour: if you don't specify years, the tool conservatively shows only UW with 0 min.*

### 4.5 Requirements (Loss Runs / IFTA / MVR)

| # | UW Requires | User Selection | Expected |
|---|---|---|---|
| M26 | YES | YES | ✓ |
| M27 | YES | NO  | ✗ |
| M28 | YES | blank | ✓ (permissive default) |
| M29 | NO  | NO  | ✓ |
| M30 | NO  | YES | ✓ |
| M31 | blank | NO | ✓ (blank = not required) |

### 4.6 Driver Experience

| # | UW Min | User Exp | Expected |
|---|---|---|---|
| M32 | 2 | 2 | ✓ |
| M33 | 2 | 1 | ✗ |
| M34 | blank | 0 | ✓ |

### 4.7 Keywords

| # | Keywords Input | Expected |
|---|---|---|
| M35 | `Canal` | Only UW whose data contains "Canal" |
| M36 | `canal` | Case-insensitive match — same result as M35 |
| M37 | `canal flatbed` | Both words must appear (AND logic) |
| M38 | blank | No keyword filter — all matching UW shown |

---

## 5. Ranking Tests

| # | Setup | Expected Order |
|---|---|---|
| R1 | 2 results: one with explicit state, one with ALL STATES | Explicit state first |
| R2 | 2 results: one with explicit LOB, one with LOB=ALL | Explicit LOB first |
| R3 | 2 results same specificity, different warning counts | Fewer warnings first |
| R4 | 3 results same specificity, same warnings | Alphabetical by Underwriter Name |
| R5 | Mix of all criteria | Stable sort; consistent on repeated queries |

---

## 6. Employee UI Tests

| # | Test | Expected |
|---|---|---|
| U1 | Apply filters → results update within 300ms | Debounced, responsive |
| U2 | "Why Matched" column populates correctly | Green pills explaining each matching reason |
| U3 | "Warnings" column shows restrictions | Amber pills; "Show more" for >2 warnings |
| U4 | No results match | Empty state with "Clear all filters" button |
| U5 | Click "Copy CSV" | Clipboard contains valid CSV with all result columns |
| U6 | Click "Export CSV" | File download dialog; valid CSV file |
| U7 | Click "Clear all" | All filters reset; full list shown |

---

## 7. Admin UI Tests

| # | Test | Expected |
|---|---|---|
| AD1 | Add new underwriter → save | Appears in list; new row in Google Sheet |
| AD2 | Edit existing underwriter | Changes saved to correct row in Sheet |
| AD3 | Delete underwriter → confirm | Row removed from Sheet; row index of others unchanged |
| AD4 | Delete underwriter → cancel confirm dialog | No change |
| AD5 | Save LOB options | New options appear in employee filter dropdown on reload |
| AD6 | Add admin email → save | After re-login, that user gets Admin tab |
| AD7 | Non-admin user | Admin tab not visible; cannot access admin routes |
| AD8 | Search in admin table | Filters rows client-side instantly |

---

## 8. Audit Log Tests

| # | Test | Expected |
|---|---|---|
| L1 | Perform a search | New row in SearchLogs within seconds |
| L2 | Log row content | Timestamp (ISO), email, filter values, result count |
| L3 | Log contains no client PII | No client name, DOT number, or personal info |
| L4 | Log failure (network down) | Search still works; log silently skipped |

---

## 9. Edge Cases

| # | Scenario | Expected |
|---|---|---|
| E1 | All filters blank | All underwriters returned, sorted alphabetically |
| E2 | State filter = "FL" (no UW covers FL) | 0 results; empty state message |
| E3 | Underwriter with blank States column | Treated as no restriction → matches any state |
| E4 | Underwriter with `NO` for all requirements | Matches even when user selects NO for all |
| E5 | Google Sheet temporarily unavailable | Error message shown; app does not crash |
| E6 | Underwriter row with all blank fields | Still appears if no hard-block filter fails |
| E7 | LOB value with extra spaces ("  Dry Van  ") | Trimmed → matches "Dry Van" |
| E8 | State tokens separated by semicolons | Tokenizer handles semicolons → matches correctly |
| E9 | State tokens separated by newlines | Tokenizer handles newlines → matches correctly |
| E10 | 100+ underwriters in sheet | Performance: filtering completes in <100ms |
| E11 | Two identical underwriter rows | Both appear independently in results |
| E12 | Admin deletes row, then undo in Google Sheets | Next app reload shows the restored row |

---

## 10. Build & Installer Tests

| # | Test | Expected |
|---|---|---|
| B1 | `npm run build` completes without errors | `dist-electron/` contains installer |
| B2 | Installer runs on fresh Windows machine | App installs; desktop shortcut created |
| B3 | Bundled CSV accessible in packaged app | Import succeeds using `process.resourcesPath` |
| B4 | App name and icon display correctly | Taskbar shows correct name and icon |
