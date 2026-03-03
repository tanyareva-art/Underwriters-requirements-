# Underwriter Decision Tool — Installation Guide

> **For non-developers.** The tool runs entirely inside your shared Google Sheet — no software to install, no logins beyond your normal Google Workspace account.

---

## What you'll need

- The shared Google Sheet (already in your shared Drive folder)
- A Google Workspace account with Editor access to the sheet
- The two code files from this repo: `Code.gs` and `Sidebar.html`

---

## Part 1 — Open the Apps Script Editor

1. Open the shared Google Sheet in your browser.
2. In the top menu click **Extensions → Apps Script**.
3. A new browser tab opens showing the Apps Script editor.
   It will have a default file called `Code.gs` with a placeholder function — that's normal.

---

## Part 2 — Paste Code.gs

1. In the Apps Script editor, click on **Code.gs** in the left file list.
2. **Select all** existing code in the editor (Ctrl+A / Cmd+A) and **delete** it.
3. Copy the **entire contents** of `Code.gs` from this repo.
4. Paste it into the editor.
5. Press **Ctrl+S** (or Cmd+S) to save. Name the project **"Underwriter Decision Tool"** if prompted.

---

## Part 3 — Add Sidebar.html

1. In the left file list, click the **＋** button next to "Files".
2. Choose **HTML**.
3. Name the new file exactly **`Sidebar`** (no extension — the editor adds `.html` automatically).
4. **Select all** the placeholder code in the new file and **delete** it.
5. Copy the **entire contents** of `Sidebar.html` from this repo.
6. Paste it in. Press **Ctrl+S** to save.

Your file list should now show: `Code.gs` and `Sidebar.html`.

---

## Part 4 — Run Setup (creates the required tabs)

1. In the Apps Script editor, make sure **`Code.gs`** is selected.
2. In the function dropdown at the top (it says "Select function"), choose **`setupTool`**.
3. Click the **▶ Run** button.
4. A permissions dialog will appear — click **Review permissions** → select your Google account → click **Allow**.
   *(This is a one-time step. The script only accesses your current spreadsheet.)*
5. A dialog on your sheet will confirm that tabs were created.

---

## Part 5 — Import the underwriter data

**Option A — Import from Drive (recommended)**

1. Upload `data/underwriters.csv` (from this repo) to any folder in your Google Drive.
2. Back in the Google Sheet, click **Underwriter Tool → Import underwriters.csv from Drive**.
   *(If you don't see the menu yet, reload the sheet tab first — see Part 6.)*
3. Type the file name (`underwriters.csv`) when prompted and click **OK**.
4. A confirmation dialog shows how many rows were imported.

**Option B — Paste manually**

1. Open the **Underwriters** tab of the sheet.
2. In a separate window, open `data/underwriters.csv` (from this repo) in any text editor or spreadsheet app.
3. Copy all rows **below the header** (row 1 already has headers from `setupTool`).
4. Paste starting at cell **A2** of the Underwriters tab.

---

## Part 6 — Reload the sheet and open the sidebar

1. Close the Apps Script editor tab.
2. **Reload** the Google Sheet tab (press F5 or Cmd+R).
3. After a few seconds you'll see a new menu: **Underwriter Tool**.
4. Click **Underwriter Tool → Open Sidebar**.
5. The sidebar opens on the right. Fill in filters and see results instantly.

> The sidebar stays open until you close it. All 6 employees can use the same sheet simultaneously — each person's searches are logged to the SearchLogs tab under their own Google account email.

---

## Part 7 — (Optional) Edit the LOB dropdown

The Equipment/LOB dropdown in the sidebar is controlled by the **Settings** tab.

1. Open the **Settings** tab of the sheet.
2. Find the row where column A = `lob_options`.
3. Edit column B — it's a comma-separated list of options.
4. Reload the sidebar to pick up changes.

---

## Part 8 — Viewing audit logs

Open the **SearchLogs** tab. Each row is one search:

| Column | Contains |
|---|---|
| Timestamp | ISO date/time of the search |
| Employee Email | Signed-in Google account (from the server, not spoofable) |
| State … Keywords | The filter values selected |
| Results Count | How many underwriters matched |

**No client PII is stored** — no client names, DOT numbers, or personal information.

---

## Permissions the script requests

When you run `setupTool` for the first time, Google asks you to grant:

| Permission | Why |
|---|---|
| See, edit, create, and delete spreadsheets | Read/write the Underwriters, Settings, and SearchLogs tabs |
| Display and run third-party web content | Show the sidebar HTML |
| See your primary Google Account email address | Write your email to SearchLogs for audit purposes |
| Connect to an external service | Required for DriveApp when importing the CSV |

These permissions are scoped to **this spreadsheet only** and are standard for any Apps Script tool.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Underwriter Tool" menu not showing | Reload the spreadsheet. If it still doesn't show, check that `onOpen()` exists in Code.gs and re-save. |
| Sidebar shows "Error loading data" | Make sure the Underwriters tab exists and has the correct header row. Re-run `setupTool`. |
| "No underwriter data found" notice in sidebar | The Underwriters tab is empty — complete Part 5 (import data). |
| Import says "File not found" | The CSV must be in your Google Drive (not just local). Upload it to Drive first. |
| A new employee can't see the sidebar | They must have **Editor** access to the sheet, then reload it to see the menu. |
| Searches not appearing in SearchLogs | The script may not have been authorized. Have the affected employee run any function once via the Apps Script editor. Alternatively, just using the sidebar once after authorization is enough. |

---

## Architecture

```
Google Sheet (shared Drive folder)
├── Underwriters tab  ← source of truth; edit via the sheet directly
├── Settings tab      ← lob_options and admin list
└── SearchLogs tab    ← append-only; one row per search

Apps Script (bound to the sheet)
├── Code.gs           ← server-side: menu, data access, audit log, setup, importer
└── Sidebar.html      ← client-side: filter UI, matching logic, rendering, export

Data flow:
  Sidebar loads → calls getInitialData() once → all UW data in memory
  User changes filter → matching runs locally in browser (instant)
  After 1 s idle → logSearch() called server-side (async, non-blocking)
```

No external services, no databases, no logins beyond normal Google Workspace SSO.
