# Test Plan — Underwriter Decision Tool (Apps Script)

## Setup

- Complete INSTALL.md steps
- Ensure Underwriters tab has all 18 rows imported
- Open sidebar: Underwriter Tool → Open Sidebar

---

## 1. State Matching

| # | UW States column | Filter input | Expected |
|---|---|---|---|
| S1 | `OR, WA, NC, SC, TN, MO, OH` | `OR` | ✓ match (isExact=true → ranked higher) |
| S2 | `OR, WA, NC, SC, TN, MO, OH` | `FL` | ✗ no match |
| S3 | `ALL STATES` or `ALL` | `FL` | ✓ match (isExact=false) |
| S4 | `SC, NC, OH, MO, TN` | `WA` | ✗ no match |
| S5 | *(blank)* | `OR` | ✓ match (blank = no restriction) |
| S6 | *(no filter — blank input)* | *(empty)* | All UW shown |
| S7 | Mixed case `or, Wa` | `OR` | ✓ match (case-insensitive tokenize) |
| S8 | Semicolon-separated `OR;WA;NC` | `WA` | ✓ match (tokenizer handles `;`) |
| S9 | Newline-separated | `NC` | ✓ match (tokenizer handles `\n`) |

---

## 2. LOB / Equipment Matching

| # | Lines Written | Business Types | Filter LOB | Expected |
|---|---|---|---|---|
| L1 | `ALL` | *(any)* | `Dry Van` | ✓ match (ALL covers all) |
| L2 | *(blank)* | `Dry Van, Reefer, Flatbed` | `Dry Van` | ✓ match (exact token) |
| L3 | *(blank)* | `Dry Van, Reefer` | `Flatbed` | ✗ no match |
| L4 | `AL, GL` | `Dry Van` | `GL` | ✓ match (found in Lines Written) |
| L5 | `AL, GL` | `Dry Van` | `Reefer` | ✗ no match |
| L6 | *(no filter selected)* | *(any)* | *(blank)* | All UW shown |
| L7 | ALL | *(blank)* | `WC` | ✓ (ALL matches any) |

---

## 3. New Venture

| # | UW "New Venture OK" | Filter | Expected |
|---|---|---|---|
| NV1 | `YES` | `YES` | ✓ match |
| NV2 | `NO` | `YES` | ✗ blocked |
| NV3 | *(blank)* | `YES` | ✗ blocked (blank ≠ YES) |
| NV4 | `NO` | `NO` | ✓ (NO filter doesn't block) |
| NV5 | `NO` | *(blank)* | ✓ (blank doesn't block) |
| NV6 | `YES` | `NO` | ✓ |

---

## 4. Years in Business

| # | UW Min Years | Filter value | Expected |
|---|---|---|---|
| Y1 | `2` | `2` | ✓ (equal passes) |
| Y2 | `2` | `3` | ✓ (user ≥ min) |
| Y3 | `2` | `1` | ✗ (user < min) |
| Y4 | `0` | `0` | ✓ |
| Y5 | *(blank)* | `0` | ✓ (blank min = 0) |
| Y6 | `3` | *(blank)* | ✗ (blank = 0; 0 < 3 → blocked — conservative default) |

---

## 5. Driver CDL Experience

| # | UW Driver Min | Filter | Expected |
|---|---|---|---|
| D1 | `2` | `2` | ✓ |
| D2 | `2` | `1` | ✗ |
| D3 | *(blank)* | `0` | ✓ |
| D4 | `2` | *(blank)* | ✗ (blank = 0; 0 < 2) |

---

## 6. Requirements (Loss Runs / IFTA / MVR)

| # | UW Requires | User Filter | Expected |
|---|---|---|---|
| R1 | `YES` | `YES` | ✓ match |
| R2 | `YES` | `NO` | ✗ hard block |
| R3 | `YES` | *(blank)* | ✓ permissive default |
| R4 | `NO` | `NO` | ✓ |
| R5 | `NO` | `YES` | ✓ |
| R6 | *(blank)* | `NO` | ✓ (blank = not required) |

---

## 7. Special Restrictions

| # | Scenario | Expected |
|---|---|---|
| SR1 | UW has text in Special Restrictions | Never blocks; shown as ⚠ amber pill |
| SR2 | UW has no Special Restrictions | No warning pill shown for that field |
| SR3 | All filters match except restrictions | UW still appears; restriction pill displayed |

---

## 8. Keywords

| # | Keyword input | Expected |
|---|---|---|
| K1 | `Canal` | Only UW whose combined data contains "canal" (case-insensitive) |
| K2 | `canal flatbed` | Both words must appear (AND logic) |
| K3 | *(blank)* | No keyword filter — all matching UW shown |
| K4 | `Nirvana` | Matches UW with Nirvana in any column |

---

## 9. Ranking

| # | Setup | Expected order |
|---|---|---|
| RK1 | Two matches: one explicit state `OR`, one `ALL STATES` | Explicit state first |
| RK2 | Two matches: one explicit LOB, one `ALL` | Explicit LOB first |
| RK3 | Same specificity, one has 2 warnings, other has 0 | Fewer warnings first |
| RK4 | Same everything — names "Zeta" and "Alpha" | Alpha first |
| RK5 | Re-run same search | Results identical (stable sort) |

---

## 10. Combined multi-filter tests

| # | Filters | Expected |
|---|---|---|
| C1 | State=`OR`, LOB=`Dry Van`, NV=`YES` | Only UW that cover OR, accept Dry Van, AND allow new ventures |
| C2 | State=`WA`, Yrs=`4`, LR=`YES`, IFTA=`YES` | Lori (PIU) and Brian (RPS) should both appear; both require 4 yrs in WA |
| C3 | State=`OR`, NV=`YES`, Yrs=`0` | Progressive, Geico, National General, BHHC, Mike Kerr, others with NV=YES |
| C4 | All filters blank | All 18 underwriters, sorted alphabetically |
| C5 | State=`FL` (no UW covers FL) | 0 matches; empty state message shown |

---

## 11. UI / UX

| # | Test | Expected |
|---|---|---|
| U1 | Change any filter | Results update within ~300 ms (debounced) |
| U2 | "Why matched" section | Green pills accurately describe each match reason |
| U3 | "Warnings" section | Amber pills for requirements + restrictions; ⚠ red pill for Special Restrictions |
| U4 | 0 results | Empty state with "Clear all filters" link |
| U5 | Click "Copy CSV" | Clipboard contains header + result rows as valid CSV |
| U6 | Click "Export" | Browser downloads `underwriter-results.csv` |
| U7 | Click "✕ Clear all filters" | All fields reset; all UW shown |
| U8 | Email shown as clickable mailto link | Clicking opens default email client |
| U9 | State autocomplete datalist | Typing `O` shows `OH`, `OR` suggestions |

---

## 12. Audit Logging

| # | Test | Expected |
|---|---|---|
| AL1 | Perform a search | New row appears in SearchLogs within ~2 seconds |
| AL2 | Log row content | Timestamp (ISO), correct employee email, all filter values, result count |
| AL3 | Log has no client PII | No client name, DOT, phone, or personal info in any column |
| AL4 | Rapid filter changes | Only one log row per settled search (1 s debounce) |
| AL5 | Log write fails (permissions issue) | Sidebar continues to work; error swallowed silently |

---

## 13. Setup & Admin

| # | Test | Expected |
|---|---|---|
| A1 | Run `setupTool` on empty sheet | Creates Underwriters, Settings, SearchLogs tabs with correct headers |
| A2 | Run `setupTool` when tabs already exist | No duplicates; existing data preserved |
| A3 | Import via Drive — file not found | Clear error dialog; no crash |
| A4 | Import valid CSV | Correct row count reported; rows visible in Underwriters tab |
| A5 | Edit `lob_options` in Settings tab | After closing and reopening sidebar, new option appears in dropdown |
| A6 | Add/edit rows directly in Underwriters tab | Sidebar reflects changes on next open (data fetched on load) |

---

## 14. Edge Cases

| # | Scenario | Expected |
|---|---|---|
| E1 | UW with `ALL STATES` and explicit state UW both match | Explicit state ranks first |
| E2 | Spaces around state tokens `" OR , WA "` | Trimmed correctly → matches `OR` filter |
| E3 | States separated by `/` | Tokenizer splits on `/` → correct match |
| E4 | Min Years blank | Treated as 0; never blocks based on years |
| E5 | Min Driver Exp blank | Treated as 0; never blocks |
| E6 | 6 employees searching simultaneously | Each sees their own results; SearchLogs captures each person's email independently |
| E7 | Underwriter row with all blank fields | Appears for any search with no hard-block filters active |
| E8 | Keywords with extra spaces `"  dry  van  "` | Split on whitespace → each term searched independently |
| E9 | UW deleted from sheet by admin | Sidebar reflects change on next open |
| E10 | Sheet temporarily slow / timeout | Sidebar shows error message; retry by closing and reopening |
