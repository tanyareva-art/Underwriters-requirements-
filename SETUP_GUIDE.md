# Underwriter Decision Tool — Setup Guide

> **For non-developers.** Follow every step in order. Estimated time: 30–45 minutes (one-time).

---

## Prerequisites

| What you need | Where to get it |
|---|---|
| A Google Workspace account (admin or regular) | Your IT department |
| Access to [Google Cloud Console](https://console.cloud.google.com) | Any browser |
| The Windows installer (`.exe`) | From your IT department or build output |

---

## Part 1 — Google Cloud Project

### 1.1 Create a Project

1. Go to **console.cloud.google.com** and sign in with a company Google account.
2. Click the project selector at the top → **New Project**.
3. Name it `Underwriter Decision Tool` (or anything you like) → **Create**.
4. Make sure the new project is selected in the dropdown.

### 1.2 Enable the Google Sheets API

1. In the left menu: **APIs & Services → Library**.
2. Search for **Google Sheets API** → click it → **Enable**.

### 1.3 Configure the OAuth Consent Screen

> This controls who can sign in.

1. **APIs & Services → OAuth consent screen**.
2. User Type: choose **Internal** *(This restricts sign-in to your Google Workspace domain only — no one outside can authenticate)*.
3. Click **Create**.
4. Fill in:
   - **App name**: `Underwriter Decision Tool`
   - **User support email**: your email
   - **Developer contact email**: your email
5. Click **Save and Continue** through all steps (no extra scopes or test users needed for Internal apps).

### 1.4 Create OAuth 2.0 Credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Desktop app**.
3. Name: `Underwriter Decision Tool Desktop`.
4. Click **Create**.
5. A dialog shows your **Client ID** and **Client Secret** — copy both somewhere safe (e.g., a password manager).
   - Client ID looks like: `123456789012-abcdefghijk.apps.googleusercontent.com`
   - Client Secret looks like: `GOCSPX-AbCdEfGhIjK…`

> ⚠️ **Never share the Client Secret publicly.** For a desktop app it cannot be truly hidden from the machine it runs on, but it should not be posted online.

---

## Part 2 — Create the Google Sheet

1. Go to **sheets.google.com** → click **+** (Blank spreadsheet).
2. Name it `Underwriter Decision Tool`.
3. Copy the **Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/  ← COPY THIS PART →  /edit
   ```
   Example ID: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`
4. **Share the sheet** (File → Share) with all employees who will use the tool, giving them **Editor** access. *(Editor access is required so the app can write audit logs to SearchLogs.)*

---

## Part 3 — Install and First-Run Setup

### 3.1 Install the App

Run the Windows installer (`.exe`) and follow the wizard. A desktop shortcut will be created.

### 3.2 First-Run Setup (Admin does this once)

1. Launch **Underwriter Decision Tool**.
2. On the Login screen, fill in:
   - **Google Workspace Domain**: `yourcompany.com` (just the domain, no `@`)
   - **OAuth Client ID**: paste from Step 1.4
   - **OAuth Client Secret**: paste from Step 1.4
3. Click **Sign in with Google** — your default browser will open a Google sign-in page.
4. Sign in with your company account and click **Allow**.
5. The browser will show "Authentication successful!" — switch back to the app.
6. On the Setup screen, paste the **Sheet ID** from Part 2.
7. Click **Connect & Initialize**. The app will:
   - Create three tabs: `Underwriters`, `Settings`, `SearchLogs`
   - Import all bundled underwriter data
8. Click **Open the Tool** when done.

### 3.3 Make Yourself an Admin

1. In the app, go to **Admin → Settings**.
2. In the **Admin Emails** box, add your email address (and any others who should have admin access).
3. Click **Save Settings**.
4. Sign out and sign back in — you will now see the **Admin** tab.

---

## Part 4 — Distribute to Employees

1. Give each employee the Windows installer `.exe`.
2. They install and launch the app.
3. On their first run they enter the same **Domain**, **Client ID**, and **Client Secret** as above.
4. They sign in with their company Google account.
5. They paste the same **Sheet ID**.
6. After first-run setup, the app will remember everything — future launches go straight to the Search screen.

> **Tip:** Pre-configure the Client ID, Client Secret, and Sheet ID for employees by creating a documented internal wiki page they can copy/paste from.

---

## Part 5 — Admin Operations

### Adding / Editing / Deleting Underwriters

- Open the app → click **Admin** in the header.
- Use the **Underwriters** tab to add, edit, or delete rows.
- All changes write back to Google Sheets immediately.

### Editing LOB / Equipment Dropdown

- **Admin → Settings → Equipment / LOB Dropdown Options**
- Edit the comma-separated list and click **Save Settings**.
- Employees will see the updated list on their next search.

### Viewing Audit Logs

- Open the Google Sheet directly → **SearchLogs** tab.
- Each row is one search: timestamp, employee email, all filter values, and result count.
- No client PII is stored.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "Access restricted to @domain accounts" | Employee is signing in with a personal Gmail — they must use their company account |
| "Not authenticated. Please sign in." | Token expired — click Sign Out and sign in again |
| Sheet tabs already exist | Safe to re-run setup — existing tabs are not overwritten |
| "CSV not found" on import | Make sure the installer was built with the `data/underwriters.csv` file present |
| App shows blank after sign-in | Check the Sheet ID is correct and the sheet is shared with the user's account |

---

## Architecture Summary

```
┌──────────────────────────────────────────────────┐
│  Electron Desktop App (Windows)                  │
│                                                  │
│  Renderer (React + Tailwind)                     │
│  ├── Login screen       (OAuth credentials)      │
│  ├── Setup wizard       (first-run init)         │
│  ├── Employee view      (filter + search)        │
│  └── Admin view         (CRUD + settings)        │
│                                                  │
│  Main process (Node.js)                          │
│  ├── auth.js            (Google OAuth PKCE-like) │
│  ├── sheets.js          (Sheets API read/write)  │
│  └── main.js            (IPC, window, store)     │
│                                                  │
│  electron-store         (local: tokens, IDs)     │
└──────────────────────────────────────┬───────────┘
                                       │ HTTPS
                         ┌─────────────▼──────────┐
                         │  Google APIs            │
                         │  ├── OAuth 2.0          │
                         │  └── Sheets API v4      │
                         └─────────────────────────┘
                                       │
                         ┌─────────────▼──────────┐
                         │  Google Sheet           │
                         │  ├── Underwriters tab   │
                         │  ├── Settings tab       │
                         │  └── SearchLogs tab     │
                         └─────────────────────────┘
```

**Data flow:** All underwriter data lives in Google Sheets (source of truth). The app fetches it on each session. Filtering and ranking run locally in the app (fast, no round-trips per filter change). Searches are logged asynchronously to the SearchLogs tab.
